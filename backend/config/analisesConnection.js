// VERSION: v1.0.0 | DATE: 2025-11-25 | AUTHOR: VeloHub Development Team
const mongoose = require('mongoose');
const { getMongoUri } = require('./mongodb');

// Configurar conexão compartilhada para console_analises
// Esta conexão será usada por todos os modelos do console_analises
// Isso garante que o populate funcione corretamente entre modelos relacionados
const ANALISES_DB_NAME = process.env.CONSOLE_ANALISES_DB || 'console_analises';
let analisesConnection = null;

// Função para obter conexão compartilhada (lazy loading)
const getAnalisesConnection = () => {
  if (!analisesConnection) {
    try {
      const MONGODB_URI = getMongoUri();
      if (!MONGODB_URI) {
        throw new Error('MONGO_ENV não configurada');
      }
      
      analisesConnection = mongoose.createConnection(MONGODB_URI, {
        dbName: ANALISES_DB_NAME,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      analisesConnection.on('connected', () => {
        console.log('✅ Conexão MongoDB compartilhada (console_analises) estabelecida');
      });

      analisesConnection.on('error', (error) => {
        console.error('❌ Erro na conexão MongoDB (console_analises):', error);
      });

      analisesConnection.on('disconnected', () => {
        console.warn('⚠️ Conexão MongoDB (console_analises) desconectada');
      });
    } catch (error) {
      console.error('❌ Erro ao criar conexão MongoDB (console_analises):', error);
      throw error;
    }
  }
  return analisesConnection;
};

module.exports = {
  getAnalisesConnection,
  ANALISES_DB_NAME
};

