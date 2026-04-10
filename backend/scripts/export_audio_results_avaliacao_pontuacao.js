// VERSION: v1.0.0 | DATE: 2026-04-09
// Exporta audio_analise_results → JSON com avaliacao_id + pontuacaoCalculada (mapeamento LISTA_SCHEMAS)
// Uso: node scripts/export_audio_results_avaliacao_pontuacao.js [caminhoSaída.json]

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const AudioAnaliseResult = require('../models/AudioAnaliseResult');
const { getAnalisesConnection } = require('../config/analisesConnection');

function pontuacaoCalculadaDe(doc) {
  const raw =
    doc.pontuacaoConsensual ??
    doc.qualityAnalysis?.pontuacao ??
    doc.gptAnalysis?.pontuacao;
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

(async () => {
  const outPath =
    process.argv[2] ||
    path.join(__dirname, '../../../audio_analise_results_avaliacao_pontuacao.json');

  try {
    const docs = await AudioAnaliseResult.find({})
      .select(['avaliacaoMonitorId', 'pontuacaoConsensual', 'qualityAnalysis', 'gptAnalysis', 'updatedAt'])
      .sort({ updatedAt: -1 })
      .lean();

    const registros = docs.map((d) => ({
      avaliacao_id: d.avaliacaoMonitorId != null ? String(d.avaliacaoMonitorId) : null,
      pontuacaoCalculada: pontuacaoCalculadaDe(d)
    }));

    const payload = {
      VERSION: '1.1.0',
      exportedAt: new Date().toISOString(),
      database: process.env.CONSOLE_ANALISES_DB || 'console_analises',
      collection: 'audio_analise_results',
      count: registros.length,
      note:
        'avaliacao_id corresponde a avaliacaoMonitorId no MongoDB. pontuacaoCalculada = pontuacaoConsensual || qualityAnalysis.pontuacao || gptAnalysis.pontuacao',
      registros
    };

    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`✅ ${registros.length} registros → ${outPath}`);
  } catch (e) {
    console.error('ERRO:', e.message);
    process.exitCode = 1;
  } finally {
    try {
      const c = getAnalisesConnection();
      if (c && typeof c.close === 'function') await c.close();
    } catch (_) {
      /* ignore */
    }
  }
})();
