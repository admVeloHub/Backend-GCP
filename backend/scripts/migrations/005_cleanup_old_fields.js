// VERSION: v1.0.0 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team
// Script para limpar campos antigos que ainda estão presentes após a migração

const { MongoClient } = require('mongodb');

// Configuração de conexão
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://REDACTED_ATLAS_URI';

async function cleanupOldFields() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🧹 Iniciando limpeza de campos antigos...\n');
    
    await client.connect();
    
    const cleanups = [
      {
        name: 'Bot_perguntas',
        db: 'console_conteudo',
        collection: 'Bot_perguntas',
        oldFields: ['Pergunta', 'Resposta', 'Palavras-chave', 'Sinonimos', 'Tabulação', 'Tabulacoes']
      },
      {
        name: 'Velonews',
        db: 'console_conteudo',
        collection: 'Velonews',
        oldFields: ['title', 'content']
      },
      {
        name: 'qualidade_funcionarios',
        db: 'console_analises',
        collection: 'qualidade_funcionarios',
        oldFields: ['nomeCompleto']
      },
      {
        name: 'qualidade_avaliacoes_gpt',
        db: 'console_analises',
        collection: 'qualidade_avaliacoes_gpt',
        oldFields: ['avaliacaoId']
      }
    ];
    
    let totalCleaned = 0;
    
    for (const cleanup of cleanups) {
      console.log(`🧹 Limpando ${cleanup.name}...`);
      
      const db = client.db(cleanup.db);
      const collection = db.collection(cleanup.collection);
      
      // Buscar documentos que ainda têm campos antigos
      const oldFieldsQuery = {};
      cleanup.oldFields.forEach(field => {
        oldFieldsQuery[field] = { $exists: true };
      });
      
      const documentsToClean = await collection.find(oldFieldsQuery).toArray();
      
      console.log(`   📊 Encontrados ${documentsToClean.length} documentos com campos antigos`);
      
      if (documentsToClean.length === 0) {
        console.log(`   ✅ Nenhum documento precisa ser limpo`);
        continue;
      }
      
      let cleanedCount = 0;
      let errorCount = 0;
      
      for (const doc of documentsToClean) {
        try {
          // Criar objeto $unset para remover campos antigos
          const unsetFields = {};
          cleanup.oldFields.forEach(field => {
            unsetFields[field] = "";
          });
          
          await collection.updateOne(
            { _id: doc._id },
            { 
              $unset: unsetFields,
              $set: { updatedAt: new Date() }
            }
          );
          
          cleanedCount++;
          console.log(`   ✅ Documento ${doc._id} limpo com sucesso`);
          
        } catch (error) {
          errorCount++;
          console.error(`   ❌ Erro ao limpar documento ${doc._id}:`, error.message);
        }
      }
      
      console.log(`   📈 Resumo da limpeza:`);
      console.log(`   ✅ Documentos limpos: ${cleanedCount}`);
      console.log(`   ❌ Erros: ${errorCount}`);
      
      totalCleaned += cleanedCount;
      console.log('');
    }
    
    console.log('=' .repeat(60));
    console.log('📊 RESUMO FINAL DA LIMPEZA');
    console.log('=' .repeat(60));
    console.log(`✅ Total de documentos limpos: ${totalCleaned}`);
    
    if (totalCleaned > 0) {
      console.log('🎉 Limpeza concluída com sucesso!');
      console.log('🔄 Todos os campos antigos foram removidos.');
    } else {
      console.log('✅ Nenhum campo antigo encontrado - já estava limpo!');
    }
    
    return totalCleaned;
    
  } catch (error) {
    console.error('💥 Erro fatal na limpeza:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Executar limpeza se chamado diretamente
if (require.main === module) {
  cleanupOldFields()
    .then((totalCleaned) => {
      console.log('\n🏁 Script de limpeza finalizado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Falha na limpeza:', error);
      process.exit(1);
    });
}

module.exports = { cleanupOldFields };

