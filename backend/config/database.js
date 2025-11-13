// VERSION: v3.4.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
const { MongoClient } = require('mongodb');

// Configuração do MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://REDACTED_ATLAS_URI';
const DB_NAME = process.env.MONGODB_DB_NAME || 'console_conteudo';
const CONFIG_DB_NAME = process.env.CONSOLE_CONFIG_DB || 'console_config';
const ANALISES_DB_NAME = process.env.CONSOLE_ANALISES_DB || 'console_analises';
const ACADEMY_REGISTROS_DB_NAME = process.env.ACADEMY_REGISTROS_DB || 'academy_registros';

let client;
let db;
let configDb;
let analisesDb;
let academyDb;

// Conectar ao MongoDB
const connectToDatabase = async () => {
  try {
    if (!client) {
      client = new MongoClient(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      await client.connect();
      console.log('✅ Conectado ao MongoDB');
    }
    
    if (!db) {
      db = client.db(DB_NAME);
    }
    
    if (!configDb) {
      configDb = client.db(CONFIG_DB_NAME);
    }
    
    if (!analisesDb) {
      analisesDb = client.db(ANALISES_DB_NAME);
    }
    
    if (!academyDb) {
      academyDb = client.db(ACADEMY_REGISTROS_DB_NAME);
    }
    
    return db;
  } catch (error) {
    console.error('❌ Erro ao conectar ao MongoDB:', error);
    throw error;
  }
};

// Obter instância do banco principal
const getDatabase = () => {
  if (!db) {
    throw new Error('Database não conectado. Chame connectToDatabase() primeiro.');
  }
  return db;
};

// Obter instância do banco de configuração
const getConfigDatabase = () => {
  if (!configDb) {
    throw new Error('Config Database não conectado. Chame connectToDatabase() primeiro.');
  }
  return configDb;
};

// Obter instância do banco de análises
const getAnalisesDatabase = () => {
  if (!analisesDb) {
    throw new Error('Analises Database não conectado. Chame connectToDatabase() primeiro.');
  }
  return analisesDb;
};

// Obter instância do banco academy_registros
const getAcademyDatabase = () => {
  if (!academyDb) {
    throw new Error('Academy Database não conectado. Chame connectToDatabase() primeiro.');
  }
  return academyDb;
};

// Fechar conexão
const closeDatabase = async () => {
  if (client) {
    await client.close();
    console.log('🔌 Conexão com MongoDB fechada');
  }
};

// Health check do banco
const checkDatabaseHealth = async () => {
  try {
    const database = getDatabase();
    await database.admin().ping();
    return { status: 'healthy', message: 'MongoDB conectado' };
  } catch (error) {
    return { status: 'unhealthy', message: error.message };
  }
};

module.exports = {
  connectToDatabase,
  getDatabase,
  getConfigDatabase,
  getAnalisesDatabase,
  getAcademyDatabase,
  closeDatabase,
  checkDatabaseHealth
};
