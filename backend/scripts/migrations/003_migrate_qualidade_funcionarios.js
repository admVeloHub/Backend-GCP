// VERSION: v1.0.0 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team
// Script de migração para padronizar campos da collection qualidade_funcionarios

const { MongoClient } = require('mongodb');

// Configuração de conexão
// MONGODB_URI deve ser configurada via variável de ambiente (secrets)
if (!process.env.MONGODB_URI) {
  throw new Error('❌ MONGODB_URI não configurada. Configure a variável de ambiente MONGODB_URI.');
}
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.CONSOLE_ANALISES_DB || 'console_analises';
const COLLECTION_NAME = 'qualidade_funcionarios';

async function migrateQualidadeFuncionarios() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🔄 Iniciando migração da collection qualidade_funcionarios...');
    
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);
    
    // Buscar todos os documentos que ainda usam campo antigo
    const documentsToMigrate = await collection.find({
      nomeCompleto: { $exists: true }
    }).toArray();
    
    console.log(`📊 Encontrados ${documentsToMigrate.length} documentos para migrar`);
    
    if (documentsToMigrate.length === 0) {
      console.log('✅ Nenhum documento precisa ser migrado');
      return;
    }
    
    let migratedCount = 0;
    let errorCount = 0;
    
    for (const doc of documentsToMigrate) {
      try {
        const updateFields = {};
        
        // Migrar campo antigo para novo
        if (doc.nomeCompleto && !doc.colaboradorNome) {
          updateFields.colaboradorNome = doc.nomeCompleto;
        }
        
        // Atualizar apenas updatedAt para hoje (preservar createdAt original)
        updateFields.updatedAt = new Date();
        
        if (Object.keys(updateFields).length > 0) {
          await collection.updateOne(
            { _id: doc._id },
            { 
              $set: updateFields,
              $unset: {
                nomeCompleto: ""
              }
            }
          );
          
          migratedCount++;
          console.log(`✅ Documento ${doc._id} migrado com sucesso`);
        }
        
      } catch (error) {
        errorCount++;
        console.error(`❌ Erro ao migrar documento ${doc._id}:`, error.message);
      }
    }
    
    console.log('\n📈 Resumo da migração:');
    console.log(`✅ Documentos migrados: ${migratedCount}`);
    console.log(`❌ Erros: ${errorCount}`);
    console.log(`📊 Total processado: ${documentsToMigrate.length}`);
    
    if (errorCount === 0) {
      console.log('🎉 Migração da collection qualidade_funcionarios concluída com sucesso!');
    } else {
      console.log('⚠️  Migração concluída com alguns erros. Verifique os logs acima.');
    }
    
  } catch (error) {
    console.error('💥 Erro fatal na migração:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Executar migração se chamado diretamente
if (require.main === module) {
  migrateQualidadeFuncionarios()
    .then(() => {
      console.log('🏁 Script de migração finalizado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Falha na migração:', error);
      process.exit(1);
    });
}

module.exports = { migrateQualidadeFuncionarios };
