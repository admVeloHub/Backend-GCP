// VERSION: v1.0.0 | DATE: 2026-03-26 | AUTHOR: VeloHub Development Team
/**
 * Migração extra: alinha artigos cujo categoria_id não bate exatamente com o mapa
 * (ex.: 01_crédito vs 01_Crédito), usando título, id legado case-insensitive e sufixo snake_case.
(function loadVelohubFonteEnv(here) {
  const path = require('path');
  const fs = require('fs');
  let d = here;
  for (let i = 0; i < 14; i++) {
    const loader = path.join(d, 'FONTE DA VERDADE', 'bootstrapFonteEnv.cjs');
    if (fs.existsSync(loader)) {
      require(loader).loadFrom(here);
      return;
    }
    const parent = path.dirname(d);
    if (parent === d) break;
    d = parent;
  }
})(__dirname);

 *
 * Uso: MONGO_ENV obrigatório.
 *   node scripts/migrate-artigos-categorias-fix-orphans.js
 */
const { connectToDatabase, closeDatabase, getDatabase } = require('../config/database');
const { ObjectId } = require('mongodb');

const SINGLETON_ID = new ObjectId('674e2f0d0001000000000001');
const COL_CATEGORIAS = 'artigos_categorias';
const COL_ARTIGOS = 'Artigos';

function tituloParaSnakeCase(str) {
  if (!str || typeof str !== 'string') return '';
  const normalized = str.normalize('NFD').replace(/\p{M}/gu, '');
  let s = normalized.toLowerCase().trim();
  s = s.replace(/[^a-z0-9]+/g, '_');
  s = s.replace(/^_+|_+$/g, '');
  s = s.replace(/_+/g, '_');
  return s || '';
}

function padOrdem(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 1) return '01';
  return String(x).padStart(2, '0');
}

function stripNumericPrefix(categoria_id) {
  if (!categoria_id || typeof categoria_id !== 'string') return '';
  return categoria_id.replace(/^\d+_/, '');
}

/**
 * Encontra categoria canônica para um artigo ainda com id legado / variante.
 */
function resolveCategory(art, categorias) {
  const cid = (art.categoria_id || '').trim();
  const ctit = (art.categoria_titulo || '').trim();

  const canonicalIds = new Set(categorias.map((c) => c.categoria_id));
  if (cid && canonicalIds.has(cid)) {
    return null;
  }

  // 1) Por categoria_titulo (case-insensitive)
  if (ctit) {
    const lower = ctit.toLowerCase();
    const byTitle = categorias.find(
      (c) => (c.categoria_titulo || '').trim().toLowerCase() === lower
    );
    if (byTitle) return byTitle;
  }

  // 2) Formato NN_título (igual ao doc de categorias, case-insensitive)
  for (const c of categorias) {
    const ord = c.Ordem ?? c.ordem;
    const legacy = `${padOrdem(ord)}_${c.categoria_titulo}`;
    if (cid && legacy.toLowerCase() === cid.toLowerCase()) {
      return c;
    }
  }

  // 3) Sufixo após NN_ em snake_case === categoria_id canônico
  if (cid) {
    const suffix = stripNumericPrefix(cid);
    const snakeFromSuffix = tituloParaSnakeCase(suffix);
    if (snakeFromSuffix) {
      const bySnake = categorias.find((c) => c.categoria_id === snakeFromSuffix);
      if (bySnake) return bySnake;
    }
  }

  // 4) NN_... com mesmo número da Ordem: sufixo contido no título (ex.: 07_manual de voz → Manual de Voz e Estilo)
  const ordMatch = cid.match(/^(\d+)_/);
  if (ordMatch) {
    const ordArt = parseInt(ordMatch[1], 10);
    const catByOrd = categorias.find((c) => (c.Ordem ?? c.ordem) === ordArt);
    if (catByOrd) {
      const suffix = stripNumericPrefix(cid);
      const norm = (s) =>
        s
          .normalize('NFD')
          .replace(/\p{M}/gu, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '');
      const ns = norm(suffix);
      const nt = norm(catByOrd.categoria_titulo || '');
      if (ns.length >= 6 && nt.includes(ns)) {
        return catByOrd;
      }
    }
  }

  return null;
}

async function main() {
  if (!process.env.MONGO_ENV) {
    console.error('❌ MONGO_ENV não configurada.');
    process.exit(1);
  }

  await connectToDatabase();
  const db = getDatabase();

  const catCol = db.collection(COL_CATEGORIAS);
  const doc = await catCol.findOne({ _id: SINGLETON_ID });
  if (!doc || !Array.isArray(doc.Categorias) || doc.Categorias.length === 0) {
    console.error('❌ Singleton artigos_categorias inválido.');
    await closeDatabase();
    process.exit(1);
  }

  const categorias = [...doc.Categorias].sort(
    (a, b) => (a.Ordem ?? a.ordem ?? 0) - (b.Ordem ?? b.ordem ?? 0)
  );
  const canonicalIds = new Set(categorias.map((c) => c.categoria_id));

  const artigosCol = db.collection(COL_ARTIGOS);
  const all = await artigosCol.find({}).toArray();
  const now = new Date();

  let fixed = 0;
  let stillOrphan = 0;

  for (const art of all) {
    const cid = (art.categoria_id || '').trim();
    if (cid && canonicalIds.has(cid)) {
      continue;
    }

    const cat = resolveCategory(art, categorias);
    if (!cat) {
      stillOrphan += 1;
      console.warn(
        `⚠️ Sem resolução: _id=${art._id} categoria_id=${JSON.stringify(art.categoria_id)} categoria_titulo=${JSON.stringify(art.categoria_titulo)}`
      );
      continue;
    }

    await artigosCol.updateOne(
      { _id: art._id },
      {
        $set: {
          categoria_id: cat.categoria_id,
          categoria_titulo: cat.categoria_titulo,
          updatedAt: now
        }
      }
    );
    fixed += 1;
    console.log(
      `✅ _id=${art._id}  ${JSON.stringify(cid)} → ${cat.categoria_id}`
    );
  }

  console.log(`\n📊 Corrigidos: ${fixed}  |  Ainda sem match: ${stillOrphan}`);
  await closeDatabase();
  process.exit(stillOrphan > 0 ? 0 : 0);
}

main().catch(async (err) => {
  console.error('❌ Erro:', err);
  try {
    await closeDatabase();
  } catch (e) {
    /* ignore */
  }
  process.exit(1);
});
