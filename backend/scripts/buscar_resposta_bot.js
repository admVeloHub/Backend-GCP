// VERSION: v1.0.0 | DATE: 2025-03-19 | AUTHOR: VeloHub Development Team
// Script para localizar documento(s) na collection Bot_perguntas pela resposta
// Uso: npm run buscar-resposta-bot (a partir da pasta Dev - SKYNET)
// Requer: MONGO_ENV em FONTE DA VERDADE/.env (mesma variável do backend)

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

const path = require('path');

const { MongoClient } = require('mongodb');

const RESPOSTA_BUSCA = 'Sim. Após a contratação da antecipação, o valor normalmente é creditado em até 30 minutos. Em alguns casos, pode levar até 24 horas, dependendo da validação da operação. O valor é depositado na conta informada no momento da contratação. Caso o prazo seja ultrapassado, entre em contato com a nossa Central de Atendimento para verificar o ocorrido.';

const MONGODB_URI = process.env.MONGO_ENV || process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'console_conteudo';
const COLLECTION_NAME = 'Bot_perguntas';

async function buscarResposta() {
  if (!MONGODB_URI) {
    console.error('❌ Configure MONGO_ENV no .env (backend/ ou raiz do projeto)');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    // Buscar por trecho único da resposta
    const trechoBusca = 'creditado em até 30 minutos';
    const docs = await collection.find({
      $or: [
        { resposta: { $regex: trechoBusca, $options: 'i' } },
        { Resposta: { $regex: trechoBusca, $options: 'i' } }
      ]
    }).toArray();

    console.log(`\n🔍 Busca por resposta contendo: "${trechoBusca}"`);
    console.log(`📊 Encontrados: ${docs.length} documento(s)\n`);

    docs.forEach((doc, i) => {
      console.log('─'.repeat(60));
      console.log(`Documento ${i + 1}:`);
      console.log(`  _id: ${doc._id}`);
      console.log(`  pergunta: ${(doc.pergunta || doc.Pergunta || '').substring(0, 80)}...`);
      console.log(`  tabulacao: ${doc.tabulacao || doc.Tabulação || '(vazio)'}`);
      console.log(`  palavrasChave: ${(doc.palavrasChave || doc['Palavras-chave'] || '').substring(0, 60)}...`);
      console.log(`  resposta (início): ${(doc.resposta || doc.Resposta || '').substring(0, 100)}...`);
      console.log(`  createdAt: ${doc.createdAt}`);
      console.log('─'.repeat(60));
    });

    if (docs.length === 0) {
      // Busca por "30 minutos" - mais específico para o prazo de crédito
      const docs30 = await collection.find({
        $or: [
          { resposta: { $regex: '30 minutos', $options: 'i' } },
          { Resposta: { $regex: '30 minutos', $options: 'i' } }
        ]
      }).toArray();
      if (docs30.length > 0) {
        console.log('\n📋 Documentos com "30 minutos" na resposta:');
        docs30.forEach((doc, i) => {
          console.log('\n' + '─'.repeat(60));
          console.log(`${i + 1}. _id: ${doc._id}`);
          console.log(`   pergunta: ${(doc.pergunta || doc.Pergunta || '').substring(0, 100)}`);
          console.log(`   tabulacao: ${doc.tabulacao || doc.Tabulação || '(vazio)'}`);
          console.log(`   resposta (200 chars): ${(doc.resposta || doc.Resposta || '').substring(0, 200)}...`);
        });
      } else {
        // Fallback: antecipação
        const docs2 = await collection.find({
          $or: [
            { resposta: { $regex: 'antecipação', $options: 'i' } },
            { Resposta: { $regex: 'antecipação', $options: 'i' } }
          ]
        }).toArray();
        if (docs2.length > 0) {
          console.log('\n⚠️ Nenhum match para "30 minutos". Documentos com "antecipação":');
          docs2.slice(0, 5).forEach((doc, i) => {
            console.log(`  ${i + 1}. _id: ${doc._id} | tabulacao: ${doc.tabulacao || '(vazio)'}`);
          });
        }
      }
    }
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

buscarResposta();
