// VERSION: v1.0.0 | DATE: 2026-04-16 | AUTHOR: VeloHub Development Team
/**
 * Configura CORS no bucket de troféus Academy (GCS_BUCKET_NAME3 / mediabank_academy).
 * Necessário para PUT direto do browser (signed URL) com Content-Type.
 * Execute: node scripts/configure-academy-cors.js
 */

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

const { configureBucketAcademyTrophiesCORS } = require('../config/gcs');

async function main() {
  try {
    console.log('🔧 Configurando CORS no bucket de troféus Academy (GCS_BUCKET_NAME3)...');

    const corsConfig = await configureBucketAcademyTrophiesCORS();

    console.log('✅ CORS configurado com sucesso!');
    console.log('📋 Configuração aplicada:', JSON.stringify(corsConfig, null, 2));

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao configurar CORS:', error);
    process.exit(1);
  }
}

main();
