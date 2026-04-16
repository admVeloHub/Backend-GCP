// VERSION: v1.2.0 | DATE: 2026-04-10 | AUTHOR: VeloHub Development Team
/**
 * Script para configurar CORS no bucket do GCS
 *
 * Uso:
 *   node scripts/configure-gcs-cors.js
 *
 * Ou com variáveis de ambiente:
 *   GCP_PROJECT_ID=velohub-471220 GCS_BUCKET_NAME=qualidade_audio_envio node scripts/configure-gcs-cors.js
 *
 * Ou no PowerShell:
 *   $env:GCP_PROJECT_ID="velohub-471220"; $env:GCS_BUCKET_NAME="qualidade_audio_envio"; node scripts/configure-gcs-cors.js
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

// Verificar se as variáveis necessárias estão configuradas
if (!process.env.GCP_PROJECT_ID || !process.env.GCS_BUCKET_NAME) {
  console.error('❌ Erro: Variáveis de ambiente não configuradas!\n');
  console.log('Por favor, configure as seguintes variáveis:');
  console.log('  - GCP_PROJECT_ID');
  console.log('  - GCS_BUCKET_NAME\n');
  console.log('Opções:');
  console.log('1. Definir variáveis em FONTE DA VERDADE/.env (ver VARIAVEIS_AMBIENTE.md) ou criar local com:');
  console.log('   GCP_PROJECT_ID=velohub-471220');
  console.log('   GCS_BUCKET_NAME=qualidade_audio_envio\n');
  console.log('2. Ou definir via variáveis de ambiente:');
  console.log('   PowerShell:');
  console.log('   $env:GCP_PROJECT_ID="velohub-471220"');
  console.log('   $env:GCS_BUCKET_NAME="qualidade_audio_envio"\n');
  console.log('   Bash/Linux:');
  console.log('   export GCP_PROJECT_ID=velohub-471220');
  console.log('   export GCS_BUCKET_NAME=qualidade_audio_envio\n');
  process.exit(1);
}

const { configureBucketCORS, getBucketCORS } = require('../backend/config/gcs');

async function main() {
  try {
    console.log('🔧 Configurando CORS no bucket do GCS...\n');
    console.log(`📦 Projeto: ${process.env.GCP_PROJECT_ID}`);
    console.log(`🪣 Bucket: ${process.env.GCS_BUCKET_NAME}\n`);
    
    // Verificar configuração atual
    console.log('📋 Verificando configuração CORS atual...');
    const currentCORS = await getBucketCORS();
    console.log('Configuração atual:', JSON.stringify(currentCORS, null, 2));
    console.log('');
    
    // Configurar CORS
    console.log('⚙️  Aplicando nova configuração CORS...');
    const corsConfig = await configureBucketCORS();
    
    console.log('\n✅ CORS configurado com sucesso!');
    console.log('📋 Configuração aplicada:');
    console.log(JSON.stringify(corsConfig, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erro ao configurar CORS:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

main();

