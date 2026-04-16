// VERSION: v1.0.0 | DATE: 2025-03-19 | AUTHOR: VeloHub Development Team
// Busca documento(s) com tabulação problemática: "Categoria: Teste; Motivo: Tabulação; Detalhe: exibição"

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

const MONGODB_URI = process.env.MONGO_ENV || process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'console_conteudo';
const COLLECTION_NAME = 'Bot_perguntas';

const TABULACAO_PROBLEMA = 'Categoria: Teste; Motivo: Tabulação; Detalhe: exibição';

async function buscar() {
  if (!MONGODB_URI) {
    console.error('❌ Configure MONGO_ENV no .env');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    let docs = await collection.find({
      $or: [
        { tabulacao: { $regex: 'Teste', $options: 'i' } },
        { tabulacao: { $regex: 'exibição', $options: 'i' } },
        { Tabulação: { $regex: 'Teste', $options: 'i' } }
      ]
    }).toArray();

    if (docs.length === 0) {
      docs = await collection.find({
        $or: [
          { tabulacao: /Categoria:/i },
          { tabulacao: /Motivo:/i }
        ]
      }).toArray();
    }

    console.log(`\n🔍 Busca por tabulação problemática ("Categoria: Teste; Motivo: Tabulação; Detalhe: exibição")`);
    console.log(`📊 Encontrados: ${docs.length} documento(s)\n`);

    docs.forEach((doc, i) => {
      console.log('─'.repeat(60));
      console.log(`Documento ${i + 1}:`);
      console.log(`  _id: ${doc._id}`);
      console.log(`  pergunta: ${(doc.pergunta || doc.Pergunta || '').substring(0, 100)}`);
      console.log(`  tabulacao: ${doc.tabulacao || doc.Tabulação || '(vazio)'}`);
      console.log(`  resposta (início): ${(doc.resposta || doc.Resposta || '').substring(0, 150)}...`);
      console.log('─'.repeat(60));
    });
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

buscar();
