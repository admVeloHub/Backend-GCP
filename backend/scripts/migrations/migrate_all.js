// VERSION: v1.0.0 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team
// Script principal para executar todas as migrações de padronização

const { migrateBotPerguntas } = require('./001_migrate_botperguntas');
const { migrateVelonews } = require('./002_migrate_velonews');
const { migrateQualidadeFuncionarios } = require('./003_migrate_qualidade_funcionarios');
const { migrateQualidadeAvaliacoesGPT } = require('./004_migrate_qualidade_avaliacoes_gpt');

async function runAllMigrations() {
  console.log('🚀 Iniciando migração completa do MongoDB para padrões atualizados...\n');
  
  const startTime = Date.now();
  const migrations = [
    { name: 'Bot_perguntas', fn: migrateBotPerguntas },
    { name: 'Velonews', fn: migrateVelonews },
    { name: 'qualidade_funcionarios', fn: migrateQualidadeFuncionarios },
    { name: 'qualidade_avaliacoes_gpt', fn: migrateQualidadeAvaliacoesGPT }
  ];
  
  let successCount = 0;
  let errorCount = 0;
  const results = [];
  
  for (const migration of migrations) {
    try {
      console.log(`\n📋 Executando migração: ${migration.name}`);
      console.log('=' .repeat(50));
      
      await migration.fn();
      successCount++;
      results.push({ name: migration.name, status: 'success' });
      
    } catch (error) {
      errorCount++;
      results.push({ name: migration.name, status: 'error', error: error.message });
      console.error(`💥 Erro na migração ${migration.name}:`, error.message);
    }
  }
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  console.log('\n' + '=' .repeat(60));
  console.log('📊 RESUMO FINAL DAS MIGRAÇÕES');
  console.log('=' .repeat(60));
  
  results.forEach(result => {
    const status = result.status === 'success' ? '✅' : '❌';
    console.log(`${status} ${result.name}: ${result.status.toUpperCase()}`);
    if (result.error) {
      console.log(`   Erro: ${result.error}`);
    }
  });
  
  console.log('\n📈 Estatísticas:');
  console.log(`✅ Migrações bem-sucedidas: ${successCount}`);
  console.log(`❌ Migrações com erro: ${errorCount}`);
  console.log(`⏱️  Tempo total: ${duration}s`);
  
  if (errorCount === 0) {
    console.log('\n🎉 Todas as migrações foram concluídas com sucesso!');
    console.log('🔄 O MongoDB está agora totalmente padronizado.');
  } else {
    console.log('\n⚠️  Algumas migrações falharam. Verifique os erros acima.');
    console.log('🔧 Execute as migrações individuais para corrigir os problemas.');
  }
  
  return { successCount, errorCount, results };
}

// Executar migrações se chamado diretamente
if (require.main === module) {
  runAllMigrations()
    .then(({ successCount, errorCount }) => {
      console.log('\n🏁 Script de migração finalizado');
      process.exit(errorCount > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('💥 Falha fatal nas migrações:', error);
      process.exit(1);
    });
}

module.exports = { runAllMigrations };
