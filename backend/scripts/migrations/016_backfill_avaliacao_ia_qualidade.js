// VERSION: v1.0.0 | DATE: 2026-04-09 | AUTHOR: VeloHub Development Team
// Backfill: qualidade_avaliacoes.avaliacaoIA a partir do último audio_analise_results por avaliacaoMonitorId
// Uso: NODE_ENV=development node scripts/migrations/016_backfill_avaliacao_ia_qualidade.js
// Requer MONGO / conexão igual aos modelos (console_analises).

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const AudioAnaliseResult = require('../../models/AudioAnaliseResult');
const QualidadeAvaliacao = require('../../models/QualidadeAvaliacao');

function notaIAFromResultDoc(doc) {
  const raw =
    doc.pontuacaoConsensual ??
    doc.qualityAnalysis?.pontuacao ??
    doc.gptAnalysis?.pontuacao;
  const n = raw != null ? Number(raw) : NaN;
  return Number.isNaN(n) ? null : n;
}

async function run() {
  console.log('🚀 Backfill qualidade_avaliacoes.avaliacaoIA ← audio_analise_results (último por updatedAt)');

  const docs = await AudioAnaliseResult.find({})
    .sort({ updatedAt: -1 })
    .select(['avaliacaoMonitorId', 'pontuacaoConsensual', 'qualityAnalysis', 'gptAnalysis', 'updatedAt'])
    .lean();

  const bestByAval = new Map();
  for (const doc of docs) {
    const id = doc.avaliacaoMonitorId;
    if (id == null) continue;
    const key = String(id);
    if (bestByAval.has(key)) continue;
    const nota = notaIAFromResultDoc(doc);
    if (nota == null) continue;
    bestByAval.set(key, nota);
  }

  let updated = 0;
  let skipped = 0;
  for (const [key, nota] of bestByAval) {
    const res = await QualidadeAvaliacao.updateOne(
      {
        _id: key,
        $or: [{ avaliacaoIA: { $exists: false } }, { avaliacaoIA: null }]
      },
      { $set: { avaliacaoIA: nota } }
    );
    if (res.modifiedCount > 0) updated += 1;
    else skipped += 1;
  }

  console.log(`✅ Atualizadas: ${updated}; sem mudança (já tinham nota ou avaliação inexistente): ${skipped}`);
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Erro no backfill:', err);
  process.exit(1);
});
