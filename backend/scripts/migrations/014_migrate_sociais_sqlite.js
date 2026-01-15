// VERSION: v1.0.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
// MIGRAÇÃO: SQLite (social_metrics.db) → MongoDB (console_sociais.sociais_metricas)

// Carregar variáveis de ambiente
const path = require('path');
const fs = require('fs');
try {
  require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
  require('dotenv').config();
} catch (error) {
  // Ignorar erro se dotenv não conseguir carregar
}

const { MongoClient } = require('mongodb');
const { getMongoUri } = require('../../config/mongodb');
const sqlite3 = require('sqlite3').verbose();

const SOCIAIS_DB_NAME = process.env.CONSOLE_SOCIAIS_DB || 'console_sociais';
const COLLECTION_NAME = 'sociais_metricas';

// Caminho para o arquivo SQLite (ajustar conforme necessário)
const SQLITE_DB_PATH = path.join(__dirname, '../../../../Redes/social_metrics.db');

async function migrateSociaisSQLite() {
  let mongoClient = null;
  let sqliteDb = null;
  
  try {
    console.log('🔄 [MIGRAÇÃO] Iniciando migração de SQLite para MongoDB');
    console.log(`📁 SQLite: ${SQLITE_DB_PATH}`);
    console.log(`🗄️ MongoDB: ${SOCIAIS_DB_NAME}.${COLLECTION_NAME}`);
    
    // Verificar se arquivo SQLite existe
    if (!fs.existsSync(SQLITE_DB_PATH)) {
      console.log(`⚠️ [MIGRAÇÃO] Arquivo SQLite não encontrado: ${SQLITE_DB_PATH}`);
      console.log('⚠️ [MIGRAÇÃO] Pulando migração - nenhum dado para migrar');
      return;
    }
    
    // Conectar ao MongoDB
    const MONGODB_URI = getMongoUri();
    mongoClient = new MongoClient(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    await mongoClient.connect();
    console.log('✅ Conectado ao MongoDB');
    
    const db = mongoClient.db(SOCIAIS_DB_NAME);
    const collection = db.collection(COLLECTION_NAME);
    
    // Conectar ao SQLite
    sqliteDb = new sqlite3.Database(SQLITE_DB_PATH, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        throw new Error(`Erro ao conectar ao SQLite: ${err.message}`);
      }
      console.log('✅ Conectado ao SQLite');
    });
    
    // Ler dados do SQLite
    const sqliteData = await new Promise((resolve, reject) => {
      sqliteDb.all('SELECT * FROM tabulations ORDER BY timestamp DESC', [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
    
    console.log(`📊 [MIGRAÇÃO] Encontrados ${sqliteData.length} registros no SQLite`);
    
    if (sqliteData.length === 0) {
      console.log('✅ [MIGRAÇÃO] Nenhum dado para migrar');
      return;
    }
    
    // Verificar se já existem dados no MongoDB
    const existingCount = await collection.countDocuments();
    if (existingCount > 0) {
      console.log(`⚠️ [MIGRAÇÃO] Já existem ${existingCount} registros no MongoDB`);
      console.log('⚠️ [MIGRAÇÃO] A migração adicionará novos registros sem duplicar');
    }
    
    let migrados = 0;
    let erros = 0;
    let ignorados = 0;
    
    // Mapear e migrar dados
    for (const row of sqliteData) {
      try {
        // Mapear campos do SQLite para MongoDB
        const mongoDoc = {
          clientName: row.client_name || '',
          socialNetwork: row.social_network || '',
          messageText: row.message_text || '',
          rating: row.rating ? parseInt(row.rating.replace('⭐', '').trim()) : null,
          contactReason: row.reason || null,
          sentiment: row.sentiment || null,
          directedCenter: row.destination_center ? row.destination_center.trim().length > 0 : false,
          link: row.link || null,
          createdAt: row.timestamp ? new Date(row.timestamp) : new Date(),
          updatedAt: new Date()
        };
        
        // Validar campos obrigatórios
        if (!mongoDoc.clientName || !mongoDoc.socialNetwork || !mongoDoc.messageText) {
          console.log(`⚠️ [MIGRAÇÃO] Registro ignorado (campos obrigatórios ausentes): ID ${row.id}`);
          ignorados++;
          continue;
        }
        
        // Validar enums
        const validNetworks = ['WhatsApp', 'Instagram', 'Facebook', 'TikTok', 'Messenger', 'YouTube', 'PlayStore'];
        if (!validNetworks.includes(mongoDoc.socialNetwork)) {
          console.log(`⚠️ [MIGRAÇÃO] Rede social inválida: ${mongoDoc.socialNetwork} (ID ${row.id})`);
          // Tentar corrigir mapeamentos comuns
          const networkMap = {
            'Playstore': 'PlayStore',
            'playstore': 'PlayStore',
            'youtube': 'YouTube',
            'instagram': 'Instagram',
            'facebook': 'Facebook',
            'tiktok': 'TikTok',
            'messenger': 'Messenger',
            'whatsapp': 'WhatsApp'
          };
          if (networkMap[mongoDoc.socialNetwork]) {
            mongoDoc.socialNetwork = networkMap[mongoDoc.socialNetwork];
          } else {
            ignorados++;
            continue;
          }
        }
        
        // Validar rating se PlayStore
        if (mongoDoc.socialNetwork === 'PlayStore' && !mongoDoc.rating) {
          console.log(`⚠️ [MIGRAÇÃO] Rating ausente para PlayStore (ID ${row.id})`);
        }
        
        if (mongoDoc.rating && (mongoDoc.rating < 1 || mongoDoc.rating > 5)) {
          console.log(`⚠️ [MIGRAÇÃO] Rating inválido: ${mongoDoc.rating} (ID ${row.id})`);
          mongoDoc.rating = null;
        }
        
        // Verificar se já existe (baseado em clientName + socialNetwork + createdAt aproximado)
        const existing = await collection.findOne({
          clientName: mongoDoc.clientName,
          socialNetwork: mongoDoc.socialNetwork,
          messageText: mongoDoc.messageText,
          createdAt: {
            $gte: new Date(mongoDoc.createdAt.getTime() - 60000), // 1 minuto antes
            $lte: new Date(mongoDoc.createdAt.getTime() + 60000)  // 1 minuto depois
          }
        });
        
        if (existing) {
          console.log(`⚠️ [MIGRAÇÃO] Registro já existe (duplicado): ${mongoDoc.clientName} - ${mongoDoc.socialNetwork}`);
          ignorados++;
          continue;
        }
        
        // Inserir no MongoDB
        await collection.insertOne(mongoDoc);
        migrados++;
        
        if (migrados % 10 === 0) {
          console.log(`📊 [MIGRAÇÃO] Progresso: ${migrados} migrados...`);
        }
      } catch (error) {
        console.error(`❌ [MIGRAÇÃO] Erro ao migrar registro ID ${row.id}:`, error.message);
        erros++;
      }
    }
    
    // Criar índices
    console.log('📊 [MIGRAÇÃO] Criando índices...');
    await collection.createIndex({ socialNetwork: 1 });
    await collection.createIndex({ createdAt: -1 });
    await collection.createIndex({ sentiment: 1 });
    await collection.createIndex({ contactReason: 1 });
    console.log('✅ [MIGRAÇÃO] Índices criados');
    
    console.log('\n✅ [MIGRAÇÃO] Migração concluída!');
    console.log(`📊 [MIGRAÇÃO] Resumo:`);
    console.log(`   - Migrados: ${migrados}`);
    console.log(`   - Ignorados: ${ignorados}`);
    console.log(`   - Erros: ${erros}`);
    console.log(`   - Total no MongoDB: ${await collection.countDocuments()}`);
    
  } catch (error) {
    console.error('❌ [MIGRAÇÃO] Erro na migração:', error);
    throw error;
  } finally {
    // Fechar conexões
    if (sqliteDb) {
      sqliteDb.close((err) => {
        if (err) {
          console.error('Erro ao fechar SQLite:', err);
        } else {
          console.log('🔌 SQLite fechado');
        }
      });
    }
    
    if (mongoClient) {
      await mongoClient.close();
      console.log('🔌 MongoDB fechado');
    }
  }
}

// Executar migração se chamado diretamente
if (require.main === module) {
  migrateSociaisSQLite()
    .then(() => {
      console.log('✅ Migração finalizada com sucesso');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erro na migração:', error);
      process.exit(1);
    });
}

module.exports = { migrateSociaisSQLite };
