// VERSION: v1.2.0 | DATE: 2026-07-22 | AUTHOR: VeloHub Development Team
// CHANGELOG: v1.2.0 - useDb no pool Mongoose principal (evita createConnection extra que falhava no Cloud Run)
// CHANGELOG: v1.1.0 - ensureFuncionariosConnectionReady() para evitar timeout em rotas Qualidade
// CHANGELOG: v1.0.1 - asPromise().catch evita unhandledRejection quando SRV/DNS falha
const mongoose = require('mongoose');
const { getMongoUri } = require('./mongodb');
const { FUNCIONARIOS_DB_NAME } = require('./funcionariosCollections');

let funcionariosConnection = null;

const getFuncionariosConnection = () => {
  if (!funcionariosConnection) {
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Mongoose principal não conectado. Aguarde ensureFuncionariosConnectionReady().');
    }
    funcionariosConnection = mongoose.connection.useDb(FUNCIONARIOS_DB_NAME, { useCache: true });
    console.log(`✅ Mongoose useDb (${FUNCIONARIOS_DB_NAME}) pronto no pool compartilhado`);
  }
  return funcionariosConnection;
};

/** Aguarda Mongoose principal + useDb(console_funcionarios) antes de operações. */
const ensureFuncionariosConnectionReady = async () => {
  const MONGODB_URI = getMongoUri();
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(MONGODB_URI, {
      dbName: process.env.MONGODB_DB_NAME || 'console_conteudo',
    });
  }
  return getFuncionariosConnection();
};

module.exports = {
  getFuncionariosConnection,
  ensureFuncionariosConnectionReady,
  FUNCIONARIOS_DB_NAME,
};
