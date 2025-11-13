// VERSION: v1.0.0 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team
// Script para identificar todos os campos que não seguem o padrão padronizado

const { MongoClient } = require('mongodb');

// Configuração de conexão
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://REDACTED_ATLAS_URI';

async function identifyNonStandardFields() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🔍 Identificando campos fora do padrão...\n');
    
    await client.connect();
    
    const collections = [
      {
        name: 'Bot_perguntas',
        db: 'console_conteudo',
        collection: 'Bot_perguntas',
        standardFields: ['_id', 'pergunta', 'resposta', 'palavrasChave', 'sinonimos', 'tabulacao', 'createdAt', 'updatedAt', '_sheetRow']
      },
      {
        name: 'Velonews',
        db: 'console_conteudo',
        collection: 'Velonews',
        standardFields: ['_id', 'titulo', 'conteudo', 'isCritical', 'createdAt', 'updatedAt']
      },
      {
        name: 'qualidade_funcionarios',
        db: 'console_analises',
        collection: 'qualidade_funcionarios',
        standardFields: ['_id', 'colaboradorNome', 'empresa', 'dataContratado', 'createdAt', 'updatedAt']
      },
      {
        name: 'qualidade_avaliacoes_gpt',
        db: 'console_analises',
        collection: 'qualidade_avaliacoes_gpt',
        standardFields: ['_id', 'avaliacao_id', 'analiseGPT', 'pontuacaoGPT', 'criteriosGPT', 'confianca', 'createdAt', 'updatedAt']
      }
    ];
    
    for (const collectionInfo of collections) {
      console.log(`🔍 Analisando ${collectionInfo.name}...`);
      
      const db = client.db(collectionInfo.db);
      const collection = db.collection(collectionInfo.collection);
      
      // Buscar alguns documentos para análise
      const sampleDocs = await collection.find({}).limit(5).toArray();
      
      if (sampleDocs.length === 0) {
        console.log(`   📊 Collection vazia - nenhum documento para analisar`);
        continue;
      }
      
      console.log(`   📊 Analisando ${sampleDocs.length} documentos de amostra...`);
      
      // Coletar todos os campos únicos encontrados
      const allFields = new Set();
      sampleDocs.forEach(doc => {
        Object.keys(doc).forEach(field => {
          allFields.add(field);
        });
      });
      
      // Identificar campos não padronizados
      const nonStandardFields = Array.from(allFields).filter(field => 
        !collectionInfo.standardFields.includes(field)
      );
      
      console.log(`   📋 Campos encontrados: ${Array.from(allFields).join(', ')}`);
      console.log(`   ✅ Campos padronizados: ${collectionInfo.standardFields.join(', ')}`);
      
      if (nonStandardFields.length > 0) {
        console.log(`   ❌ Campos FORA DO PADRÃO: ${nonStandardFields.join(', ')}`);
        
        // Mostrar exemplos de documentos com campos não padronizados
        for (const nonStandardField of nonStandardFields) {
          const docsWithField = await collection.find({ [nonStandardField]: { $exists: true } }).limit(3).toArray();
          console.log(`   🔍 Campo "${nonStandardField}" encontrado em ${docsWithField.length} documentos`);
          
          if (docsWithField.length > 0) {
            console.log(`   📄 Exemplo de valor: "${docsWithField[0][nonStandardField]}"`);
          }
        }
      } else {
        console.log(`   ✅ Todos os campos estão padronizados!`);
      }
      
      console.log('');
    }
    
  } catch (error) {
    console.error('💥 Erro na identificação:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Executar identificação se chamado diretamente
if (require.main === module) {
  identifyNonStandardFields()
    .then(() => {
      console.log('🏁 Identificação de campos não padronizados finalizada');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Falha na identificação:', error);
      process.exit(1);
    });
}

module.exports = { identifyNonStandardFields };

