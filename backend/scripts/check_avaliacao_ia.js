// VERSION: v1.0.0 | DATE: 2026-04-09 | AUTHOR: VeloHub Development Team
// Uso: a partir de backend/ → node scripts/check_avaliacao_ia.js
// Carrega .env do diretório pai (Dev - SKYNET/.env).

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

const path = require('path');

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
