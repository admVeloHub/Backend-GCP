// VERSION: v1.1.0 | DATE: 2026-05-29 | AUTHOR: VeloHub Development Team
// CHANGELOG: v1.1.0 - ensureFuncionariosConnectionReady() para evitar timeout em rotas Qualidade
// CHANGELOG: v1.0.1 - asPromise().catch evita unhandledRejection quando SRV/DNS falha
const mongoose = require('mongoose');
const { getMongoUri } = require('./mongodb');
const { FUNCIONARIOS_DB_NAME } = require('./funcionariosCollections');

let funcionariosConnection = null;

const getFuncionariosConnection = () => {
  if (!funcionariosConnection) {
    const MONGODB_URI = getMongoUri();
    if (!MONGODB_URI) {
      throw new Error('MONGO_ENV não configurada');
    }

    funcionariosConnection = mongoose.createConnection(MONGODB_URI, {
      dbName: FUNCIONARIOS_DB_NAME,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    funcionariosConnection.on('connected', () => {
      console.log(`✅ Conexão MongoDB (${FUNCIONARIOS_DB_NAME}) estabelecida`);
    });

    funcionariosConnection.on('error', (error) => {
      console.error(`❌ Erro na conexão MongoDB (${FUNCIONARIOS_DB_NAME}):`, error);
    });

    void funcionariosConnection.asPromise().catch((err) => {
      console.error(`❌ Falha assíncrona MongoDB (${FUNCIONARIOS_DB_NAME}):`, err.message);
    });
  }
  return funcionariosConnection;
};

/** Aguarda conexão pronta antes de operações Mongoose (evita buffer/timeout de 30s+). */
const ensureFuncionariosConnectionReady = async () => {
  const conn = getFuncionariosConnection();
  if (conn.readyState === 1) return conn;
  await conn.asPromise();
  return conn;
};

module.exports = {
  getFuncionariosConnection,
  ensureFuncionariosConnectionReady,
  FUNCIONARIOS_DB_NAME,
};
