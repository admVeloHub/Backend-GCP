// VERSION: v3.8.1 | DATE: 2026-06-01 | AUTHOR: VeloHub Development Team
// CHANGELOG: v3.8.1 - getMongoClient exportado (hub_corporate / corporativo legal)
// CHANGELOG: v3.8.0 - getFuncionariosDatabase (console_funcionarios)
const { MongoClient } = require('mongodb');
const { getMongoUri } = require('./mongodb');
const { FUNCIONARIOS_DB_NAME } = require('./funcionariosCollections');

// Configuração do MongoDB
const DB_NAME = process.env.MONGODB_DB_NAME || 'console_conteudo';
const CONFIG_DB_NAME = process.env.CONSOLE_CONFIG_DB || 'console_config';
const ANALISES_DB_NAME = process.env.CONSOLE_ANALISES_DB || 'console_analises';
const ACADEMY_REGISTROS_DB_NAME = process.env.ACADEMY_REGISTROS_DB || 'academy_registros';
const SOCIAIS_DB_NAME = process.env.CONSOLE_SOCIAIS_DB || 'console_sociais';

let client;
let db;
let configDb;
let analisesDb;
let academyDb;
let sociaisDb;
let funcionariosDb;

// Conectar ao MongoDB
const connectToDatabase = async () => {
  try {
    // MONGO_ENV deve ser configurada via variável de ambiente (secrets)
    // Validação movida para dentro da função para permitir carregamento do módulo
    const MONGODB_URI = getMongoUri();
    
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
    
    if (!sociaisDb) {
      sociaisDb = client.db(SOCIAIS_DB_NAME);
    }

    if (!funcionariosDb) {
      funcionariosDb = client.db(FUNCIONARIOS_DB_NAME);
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

// Obter MongoClient (acesso a outros DBs, ex.: hub_corporate)
const getMongoClient = () => {
  if (!client) {
    throw new Error('MongoClient não conectado. Chame connectToDatabase() primeiro.');
  }
  return client;
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

// Obter instância do banco console_sociais
const getSociaisDatabase = () => {
  if (!sociaisDb) {
    throw new Error('Sociais Database não conectado. Chame connectToDatabase() primeiro.');
  }
  return sociaisDb;
};

// Obter instância do banco console_funcionarios (cadastro, sessões, atuações)
const getFuncionariosDatabase = () => {
  if (!funcionariosDb) {
    throw new Error('Funcionarios Database não conectado. Chame connectToDatabase() primeiro.');
  }
  return funcionariosDb;
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
  getMongoClient,
  getConfigDatabase,
  getAnalisesDatabase,
  getAcademyDatabase,
  getSociaisDatabase,
  getFuncionariosDatabase,
  closeDatabase,
  checkDatabaseHealth
};
