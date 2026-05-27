// VERSION: v1.0.0 | DATE: 2026-04-27 | AUTHOR: VeloHub Development Team
// Conexão lazy para database console_config (valores_campos, users, etc.)
const mongoose = require('mongoose');
const { getMongoUri } = require('./mongodb');

const CONFIG_DB_NAME = process.env.CONSOLE_CONFIG_DB || 'console_config';
let configConnection = null;

const getConfigConnection = () => {
  if (!configConnection) {
    const MONGODB_URI = getMongoUri();
    configConnection = mongoose.createConnection(MONGODB_URI, {
      dbName: CONFIG_DB_NAME,
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  }
  return configConnection;
};

module.exports = {
  getConfigConnection,
  CONFIG_DB_NAME
};
