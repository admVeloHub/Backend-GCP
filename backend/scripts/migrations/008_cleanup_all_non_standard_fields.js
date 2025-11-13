// VERSION: v1.0.0 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team
// Script para limpar TODOS os campos que não seguem o padrão padronizado

const { MongoClient } = require('mongodb');

// Configuração de conexão
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://REDACTED_ATLAS_URI';

async function cleanupAllNonStandardFields() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🧹 Limpando TODOS os campos fora do padrão...\n');
    
    await client.connect();
    
    const collections = [
      {
        name: 'Bot_perguntas',
        db: 'console_conteudo',
        collection: 'Bot_perguntas',
        standardFields: ['_id', 'pergunta', 'resposta', 'palavrasChave', 'sinonimos', 'tabulacao', 'createdAt', 'updatedAt', '_sheetRow'],
        nonStandardFields: ['Palavras_chave', 'Tabulacoes']
      },
      {
        name: 'qualidade_funcionarios',
        db: 'console_analises',
        collection: 'qualidade_funcionarios',
        standardFields: ['_id', 'colaboradorNome', 'empresa', 'dataContratado', 'createdAt', 'updatedAt'],
        nonStandardFields: ['dataAniversario', 'telefone', 'atuacao', 'escala', 'acessos', 'desligado', 'dataDesligamento', 'afastado', 'dataAfastamento']
      }
    ];
    
    let totalCleaned = 0;
    
    for (const collectionInfo of collections) {
      console.log(`🧹 Limpando ${collectionInfo.name}...`);
      
      const db = client.db(collectionInfo.db);
      const collection = db.collection(collectionInfo.collection);
      
      // Buscar documentos que têm campos não padronizados
      const oldFieldsQuery = {};
      collectionInfo.nonStandardFields.forEach(field => {
        oldFieldsQuery[field] = { $exists: true };
      });
      
      const documentsToClean = await collection.find(oldFieldsQuery).toArray();
      
      console.log(`   📊 Encontrados ${documentsToClean.length} documentos com campos não padronizados`);
      
      if (documentsToClean.length === 0) {
        console.log(`   ✅ Nenhum documento precisa ser limpo`);
        continue;
      }
      
      let cleanedCount = 0;
      let errorCount = 0;
      
      for (const doc of documentsToClean) {
        try {
          // Criar objeto $unset para remover campos não padronizados
          const unsetFields = {};
          collectionInfo.nonStandardFields.forEach(field => {
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
          
          // Mostrar progresso a cada 50 documentos
          if (cleanedCount % 50 === 0) {
            console.log(`   📈 Progresso: ${cleanedCount}/${documentsToClean.length} documentos limpos`);
          }
          
        } catch (error) {
          errorCount++;
          console.error(`   ❌ Erro ao limpar documento ${doc._id}:`, error.message);
        }
      }
      
      console.log(`   📈 Resumo da limpeza:`);
      console.log(`   ✅ Documentos limpos: ${cleanedCount}`);
      console.log(`   ❌ Erros: ${errorCount}`);
      console.log(`   🗑️  Campos removidos: ${collectionInfo.nonStandardFields.join(', ')}`);
      
      totalCleaned += cleanedCount;
      console.log('');
    }
    
    console.log('=' .repeat(60));
    console.log('📊 RESUMO FINAL DA LIMPEZA COMPLETA');
    console.log('=' .repeat(60));
    console.log(`✅ Total de documentos limpos: ${totalCleaned}`);
    
    if (totalCleaned > 0) {
      console.log('🎉 Limpeza completa concluída com sucesso!');
      console.log('🔄 Todos os campos não padronizados foram removidos.');
      console.log('📋 Collections agora seguem 100% o padrão definido!');
    } else {
      console.log('✅ Nenhum campo não padronizado encontrado - já estava limpo!');
    }
    
    return totalCleaned;
    
  } catch (error) {
    console.error('💥 Erro fatal na limpeza completa:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Executar limpeza se chamado diretamente
if (require.main === module) {
  cleanupAllNonStandardFields()
    .then((totalCleaned) => {
      console.log('\n🏁 Script de limpeza completa finalizado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Falha na limpeza completa:', error);
      process.exit(1);
    });
}

module.exports = { cleanupAllNonStandardFields };

