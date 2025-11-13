// VERSION: v1.0.0 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team
// Script de migração para padronizar campos da collection Velonews

const { MongoClient } = require('mongodb');

// Configuração de conexão
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://REDACTED_ATLAS_URI';
const DB_NAME = process.env.MONGODB_DB_NAME || 'console_conteudo';
const COLLECTION_NAME = 'Velonews';

async function migrateVelonews() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🔄 Iniciando migração da collection Velonews...');
    
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);
    
    // Buscar todos os documentos que ainda usam campos antigos
    const documentsToMigrate = await collection.find({
      $or: [
        { title: { $exists: true } },
        { content: { $exists: true } }
      ]
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
        
        // Migrar campos antigos para novos
        if (doc.title && !doc.titulo) {
          updateFields.titulo = doc.title;
        }
        if (doc.content && !doc.conteudo) {
          updateFields.conteudo = doc.content;
        }
        
        // Garantir que isCritical existe
        if (doc.isCritical === undefined) {
          updateFields.isCritical = false;
        }
        
        // Atualizar apenas updatedAt para hoje (preservar createdAt original)
        updateFields.updatedAt = new Date();
        
        if (Object.keys(updateFields).length > 0) {
          await collection.updateOne(
            { _id: doc._id },
            { 
              $set: updateFields,
              $unset: {
                title: "",
                content: ""
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
      console.log('🎉 Migração da collection Velonews concluída com sucesso!');
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
  migrateVelonews()
    .then(() => {
      console.log('🏁 Script de migração finalizado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Falha na migração:', error);
      process.exit(1);
    });
}

module.exports = { migrateVelonews };
