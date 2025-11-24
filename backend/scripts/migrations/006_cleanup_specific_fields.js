// VERSION: v1.0.0 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team
// Script específico para limpar campos antigos específicos que ainda estão presentes

const { MongoClient } = require('mongodb');

// Configuração de conexão
// MONGODB_URI deve ser configurada via variável de ambiente (secrets)
if (!process.env.MONGODB_URI) {
  throw new Error('❌ MONGODB_URI não configurada. Configure a variável de ambiente MONGODB_URI.');
}
const MONGODB_URI = process.env.MONGODB_URI;

async function cleanupSpecificFields() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🧹 Iniciando limpeza específica de campos antigos...\n');
    
    await client.connect();
    
    // Limpeza específica para Bot_perguntas
    console.log('🧹 Limpando campos específicos em Bot_perguntas...');
    
    const db = client.db('console_conteudo');
    const collection = db.collection('Bot_perguntas');
    
    // Buscar documentos que ainda têm campos antigos específicos
    const documentsWithOldFields = await collection.find({
      $or: [
        { "Palavras-chave": { $exists: true } },
        { "Tabulacoes": { $exists: true } },
        { "Pergunta": { $exists: true } },
        { "Resposta": { $exists: true } },
        { "Sinonimos": { $exists: true } },
        { "Tabulação": { $exists: true } }
      ]
    }).toArray();
    
    console.log(`📊 Encontrados ${documentsWithOldFields.length} documentos com campos antigos específicos`);
    
    if (documentsWithOldFields.length === 0) {
      console.log('✅ Nenhum documento com campos antigos específicos encontrado');
      return;
    }
    
    let cleanedCount = 0;
    let errorCount = 0;
    
    for (const doc of documentsWithOldFields) {
      try {
        console.log(`🔍 Processando documento ${doc._id}...`);
        
        // Mostrar campos antigos encontrados
        const oldFields = [];
        if (doc["Palavras-chave"]) oldFields.push('"Palavras-chave"');
        if (doc["Tabulacoes"]) oldFields.push('"Tabulacoes"');
        if (doc["Pergunta"]) oldFields.push('"Pergunta"');
        if (doc["Resposta"]) oldFields.push('"Resposta"');
        if (doc["Sinonimos"]) oldFields.push('"Sinonimos"');
        if (doc["Tabulação"]) oldFields.push('"Tabulação"');
        
        console.log(`   📋 Campos antigos encontrados: ${oldFields.join(', ')}`);
        
        // Criar objeto $unset para remover campos antigos específicos
        const unsetFields = {};
        if (doc["Palavras-chave"]) unsetFields["Palavras-chave"] = "";
        if (doc["Tabulacoes"]) unsetFields["Tabulacoes"] = "";
        if (doc["Pergunta"]) unsetFields["Pergunta"] = "";
        if (doc["Resposta"]) unsetFields["Resposta"] = "";
        if (doc["Sinonimos"]) unsetFields["Sinonimos"] = "";
        if (doc["Tabulação"]) unsetFields["Tabulação"] = "";
        
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
    
    console.log('\n📈 Resumo da limpeza específica:');
    console.log(`✅ Documentos limpos: ${cleanedCount}`);
    console.log(`❌ Erros: ${errorCount}`);
    console.log(`📊 Total processado: ${documentsWithOldFields.length}`);
    
    if (errorCount === 0) {
      console.log('🎉 Limpeza específica concluída com sucesso!');
    } else {
      console.log('⚠️  Limpeza concluída com alguns erros. Verifique os logs acima.');
    }
    
  } catch (error) {
    console.error('💥 Erro fatal na limpeza específica:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Executar limpeza se chamado diretamente
if (require.main === module) {
  cleanupSpecificFields()
    .then(() => {
      console.log('\n🏁 Script de limpeza específica finalizado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Falha na limpeza específica:', error);
      process.exit(1);
    });
}

module.exports = { cleanupSpecificFields };

