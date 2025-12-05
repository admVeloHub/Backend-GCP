// VERSION: v1.0.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
/**
 * Script para configurar CORS no bucket de imagens do GCS
 * Execute: node scripts/configure-images-cors.js
 */

require('dotenv').config();
const { configureBucketImagesCORS } = require('../config/gcs');

async function main() {
  try {
    console.log('🔧 Configurando CORS no bucket de imagens...');
    
    // Configurar CORS com origens padrão (inclui localhost)
    const corsConfig = await configureBucketImagesCORS();
    
    console.log('✅ CORS configurado com sucesso!');
    console.log('📋 Configuração aplicada:', JSON.stringify(corsConfig, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao configurar CORS:', error);
    process.exit(1);
  }
}

main();

