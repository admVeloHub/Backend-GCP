// VERSION: v1.0.0 | DATE: 2026-04-09 | AUTHOR: VeloHub Development Team
// Uso: a partir de backend/ → node scripts/check_avaliacao_ia.js
// Carrega .env do diretório pai (Dev - SKYNET/.env).

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const QualidadeAvaliacao = require('../models/QualidadeAvaliacao');
const { getAnalisesConnection } = require('../config/analisesConnection');

(async () => {
  try {
    const total = await QualidadeAvaliacao.countDocuments({});
    const comCampo = await QualidadeAvaliacao.countDocuments({ avaliacaoIA: { $exists: true } });
    const comNotaNum = await QualidadeAvaliacao.countDocuments({
      avaliacaoIA: { $exists: true, $ne: null, $type: ['double', 'int', 'long', 'decimal'] }
    });
    const amostra = await QualidadeAvaliacao.find({
      avaliacaoIA: { $exists: true, $ne: null }
    })
      .select('avaliacaoIA colaboradorNome audioTreated somenteAnaliseAudioIA')
      .limit(10)
      .lean();

    console.log(
      JSON.stringify(
        {
          database: process.env.CONSOLE_ANALISES_DB || 'console_analises',
          collection: 'qualidade_avaliacoes',
          totalDocumentos: total,
          comCampo_avaliacaoIA: comCampo,
          comNotaNumerica: comNotaNum,
          amostra
        },
        null,
        2
      )
    );
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
