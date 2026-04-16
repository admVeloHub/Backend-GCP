// VERSION: v1.0.0 | DATE: 2026-03-26 | AUTHOR: VeloHub Development Team
/**
 * Migração one-shot:
 * 1) artigos_categorias: extrai Ordem do prefixo numérico de categoria_id, novo id = snake_case(título)
 * 2) Artigos: atualiza categoria_id (e categoria_titulo) conforme mapa old→new
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
 * Uso: MONGO_ENV obrigatório. node scripts/migrate-artigos-categorias-ordem-snake.js
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

function uniqueSnakeIdsForTitles(titulos) {
  const used = new Set();
  const result = [];
  for (const t of titulos) {
    let base = tituloParaSnakeCase(t);
    if (!base) base = 'categoria';
    let candidate = base;
    let n = 2;
    while (used.has(candidate)) {
      candidate = `${base}_${n}`;
      n += 1;
    }
    used.add(candidate);
    result.push(candidate);
  }
  return result;
}

function extractOrdemFromLegacyId(categoria_id) {
  if (!categoria_id || typeof categoria_id !== 'string') return null;
  const m = categoria_id.match(/^(\d+)_/);
  if (m) return parseInt(m[1], 10);
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
    console.error('❌ Documento singleton ou Categorias vazio.');
    await closeDatabase();
    process.exit(1);
  }

  const oldList = doc.Categorias.map((c, idx) => ({
    old_categoria_id: c.categoria_id,
    categoria_titulo: c.categoria_titulo || '',
    ordem:
      typeof c.Ordem === 'number'
        ? c.Ordem
        : typeof c.ordem === 'number'
          ? c.ordem
          : extractOrdemFromLegacyId(c.categoria_id) ?? idx + 1,
    stableIdx: idx
  }));

  oldList.sort((a, b) => {
    if (a.ordem !== b.ordem) return a.ordem - b.ordem;
    return a.stableIdx - b.stableIdx;
  });

  const titulos = oldList.map((r) => r.categoria_titulo.trim());
  for (let i = 0; i < titulos.length; i++) {
    if (!titulos[i]) {
      console.error(`❌ Título vazio na posição ${i + 1}. Corrija manualmente antes da migração.`);
      await closeDatabase();
      process.exit(1);
    }
  }

  const newIds = uniqueSnakeIdsForTitles(titulos);
  const newCategorias = oldList.map((row, i) => ({
    Ordem: i + 1,
    categoria_titulo: titulos[i],
    categoria_id: newIds[i]
  }));

  const mapOldToNew = {};
  oldList.forEach((row, i) => {
    mapOldToNew[row.old_categoria_id] = {
      categoria_id: newCategorias[i].categoria_id,
      categoria_titulo: newCategorias[i].categoria_titulo
    };
  });

  console.log('📋 Mapa old → new (amostra):');
  Object.entries(mapOldToNew).slice(0, 5).forEach(([k, v]) => {
    console.log(`   ${k} → ${v.categoria_id}`);
  });

  const now = new Date();
  await catCol.updateOne(
    { _id: SINGLETON_ID },
    { $set: { Categorias: newCategorias, updatedAt: now } }
  );
  console.log('✅ artigos_categorias atualizado.');

  const artigosCol = db.collection(COL_ARTIGOS);
  let updated = 0;
  let orphan = 0;

  const allArtigos = await artigosCol.find({}).toArray();
  for (const art of allArtigos) {
    const oldId = art.categoria_id;
    if (!oldId) continue;
    if (!mapOldToNew[oldId]) {
      orphan += 1;
      console.warn(
        `⚠️ Artigo órfão (categoria_id não no mapa): _id=${art._id} categoria_id=${oldId}`
      );
      continue;
    }
    const n = mapOldToNew[oldId];
    await artigosCol.updateOne(
      { _id: art._id },
      {
        $set: {
          categoria_id: n.categoria_id,
          categoria_titulo: n.categoria_titulo,
          updatedAt: now
        }
      }
    );
    updated += 1;
  }

  console.log(`✅ Artigos atualizados: ${updated}`);
  if (orphan > 0) {
    console.log(
      `⚠️ Total de artigos com categoria_id não mapeada (revisar): ${orphan}`
    );
  }

  await closeDatabase();
  process.exit(0);
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
