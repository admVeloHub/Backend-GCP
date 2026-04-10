// VERSION: v1.0.0 | DATE: 2026-04-09 | AUTHOR: VeloHub Development Team
// Aplica audio_analise_results_avaliacao_pontuacao.json → qualidade_avaliacoes.avaliacaoIA
// Mapeamento: registros[].avaliacao_id → _id (LISTA_SCHEMAS qualidade_avaliacoes);
//             registros[].pontuacaoCalculada → avaliacaoIA (LISTA_SCHEMAS linha ~284)
// Primeira ocorrência por avaliacao_id vence (export vem ordenado por updatedAt desc no áudio).
//
// Uso a partir de Dev - SKYNET/backend:
//   node scripts/migrations/017_apply_avaliacao_ia_from_json.js [caminho/arquivo.json]
//   node scripts/migrations/017_apply_avaliacao_ia_from_json.js --dry-run

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const QualidadeAvaliacao = require('../../models/QualidadeAvaliacao');
const { getAnalisesConnection } = require('../../config/analisesConnection');

const defaultJsonPath = path.join(
  __dirname,
  '../../../../audio_analise_results_avaliacao_pontuacao.json'
);

function primeiroPorAvaliacaoId(registros) {
  const map = new Map();
  for (const r of registros) {
    const id = r.avaliacao_id != null ? String(r.avaliacao_id).trim() : '';
    if (!id || map.has(id)) continue;
    const p = r.pontuacaoCalculada;
    if (p == null || p === '') continue;
    const num = Number(p);
    if (Number.isNaN(num)) continue;
    map.set(id, num);
  }
  return map;
}

(async () => {
  const dry = process.argv.includes('--dry-run');
  const jsonPath =
    process.argv.find((a) => a.endsWith('.json') && !a.startsWith('--')) || defaultJsonPath;

  if (!fs.existsSync(jsonPath)) {
    console.error('❌ Arquivo não encontrado:', jsonPath);
    process.exit(1);
  }

  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    console.error('❌ JSON inválido:', e.message);
    process.exit(1);
  }

  const registros = Array.isArray(payload.registros) ? payload.registros : [];
  const byId = primeiroPorAvaliacaoId(registros);

  let modified = 0;
  let skippedInvalidId = 0;
  let notFound = 0;
  let errors = 0;

  for (const [avaliacaoIdStr, avaliacaoIA] of byId) {
    if (!mongoose.Types.ObjectId.isValid(avaliacaoIdStr)) {
      skippedInvalidId += 1;
      continue;
    }

    if (dry) {
      modified += 1;
      continue;
    }

    try {
      const res = await QualidadeAvaliacao.updateOne(
        { _id: new mongoose.Types.ObjectId(avaliacaoIdStr) },
        { $set: { avaliacaoIA } }
      );
      if (res.matchedCount === 0) notFound += 1;
      else if (res.modifiedCount > 0) modified += 1;
    } catch (e) {
      errors += 1;
      console.warn('⚠️', avaliacaoIdStr, e.message);
    }
  }

  console.log(
    JSON.stringify(
      {
        jsonPath,
        dryRun: dry,
        entradasNoJson: registros.length,
        idsUnicosComNota: byId.size,
        modificados: dry ? '(dry-run)' : modified,
        avaliacoesNaoEncontradas: dry ? '(dry-run)' : notFound,
        idsInvalidos: skippedInvalidId,
        erros: errors
      },
      null,
      2
    )
  );

  try {
    const c = getAnalisesConnection();
    if (c && typeof c.close === 'function') await c.close();
  } catch (_) {
    /* ignore */
  }
})();
