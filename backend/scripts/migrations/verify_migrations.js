// VERSION: v1.0.0 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team
// Script para verificar se as migrações foram executadas corretamente

const { MongoClient } = require('mongodb');

// Configuração de conexão
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://REDACTED_ATLAS_URI';

async function verifyMigrations() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🔍 Verificando se as migrações foram executadas corretamente...\n');
    
    await client.connect();
    
    const checks = [
      {
        name: 'Bot_perguntas',
        db: 'console_conteudo',
        collection: 'Bot_perguntas',
        oldFields: ['Pergunta', 'Resposta', 'Palavras-chave', 'Sinonimos', 'Tabulação'],
        newFields: ['pergunta', 'resposta', 'palavrasChave', 'sinonimos', 'tabulacao']
      },
      {
        name: 'Velonews',
        db: 'console_conteudo',
        collection: 'Velonews',
        oldFields: ['title', 'content'],
        newFields: ['titulo', 'conteudo']
      },
      {
        name: 'qualidade_funcionarios',
        db: 'console_analises',
        collection: 'qualidade_funcionarios',
        oldFields: ['nomeCompleto'],
        newFields: ['colaboradorNome']
      },
      {
        name: 'qualidade_avaliacoes_gpt',
        db: 'console_analises',
        collection: 'qualidade_avaliacoes_gpt',
        oldFields: ['avaliacaoId'],
        newFields: ['avaliacao_id']
      }
    ];
    
    let allPassed = true;
    
    for (const check of checks) {
      console.log(`📋 Verificando ${check.name}...`);
      
      const db = client.db(check.db);
      const collection = db.collection(check.collection);
      
      // Verificar se ainda existem campos antigos
      const oldFieldsQuery = {};
      check.oldFields.forEach(field => {
        oldFieldsQuery[field] = { $exists: true };
      });
      
      const oldFieldsCount = await collection.countDocuments(oldFieldsQuery);
      
      // Verificar se existem campos novos
      const newFieldsQuery = {};
      check.newFields.forEach(field => {
        newFieldsQuery[field] = { $exists: true };
      });
      
      const newFieldsCount = await collection.countDocuments(newFieldsQuery);
      const totalCount = await collection.countDocuments({});
      
      console.log(`   📊 Total de documentos: ${totalCount}`);
      console.log(`   ❌ Documentos com campos antigos: ${oldFieldsCount}`);
      console.log(`   ✅ Documentos com campos novos: ${newFieldsCount}`);
      
      if (oldFieldsCount > 0) {
        console.log(`   ⚠️  ATENÇÃO: Ainda existem ${oldFieldsCount} documentos com campos antigos!`);
        allPassed = false;
      } else if (newFieldsCount > 0) {
        console.log(`   ✅ OK: Todos os documentos usam campos padronizados`);
      } else if (totalCount === 0) {
        console.log(`   ℹ️  Collection vazia - nada para verificar`);
      } else {
        console.log(`   ⚠️  ATENÇÃO: Nenhum documento com campos novos encontrado!`);
        allPassed = false;
      }
      
      console.log('');
    }
    
    console.log('=' .repeat(60));
    if (allPassed) {
      console.log('🎉 VERIFICAÇÃO CONCLUÍDA: Todas as migrações foram executadas com sucesso!');
      console.log('✅ O MongoDB está totalmente padronizado e pronto para uso.');
    } else {
      console.log('⚠️  VERIFICAÇÃO CONCLUÍDA: Algumas migrações precisam ser executadas.');
      console.log('🔧 Execute os scripts de migração para corrigir os problemas identificados.');
    }
    console.log('=' .repeat(60));
    
    return allPassed;
    
  } catch (error) {
    console.error('💥 Erro na verificação:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Executar verificação se chamado diretamente
if (require.main === module) {
  verifyMigrations()
    .then((allPassed) => {
      console.log('\n🏁 Verificação finalizada');
      process.exit(allPassed ? 0 : 1);
    })
    .catch((error) => {
      console.error('💥 Falha na verificação:', error);
      process.exit(1);
    });
}

module.exports = { verifyMigrations };
