// VERSION: v1.1.0 | DATE: 2026-04-29 | AUTHOR: VeloHub Development Team
// CHANGELOG: v1.1.0 - Coleção default email_config em console_config; _id singleton email_tk_notifications (env override)
/**
 * Singleton de configuração de envio de e-mail (SMTP e/ou Gmail API).
 * DB: console_config. Coleção: VELHUB_EMAIL_CONFIG_COLLECTION | VELHUB_EMAIL_TRANSPORT_COLLECTION | email_config.
 * Documento: VELHUB_EMAIL_CONFIG_DOCUMENT_ID | email_tk_notifications
 */
const mongoose = require('mongoose');
const { getMongoUri } = require('../config/mongodb');

const CONFIG_DB_NAME = process.env.CONSOLE_CONFIG_DB || 'console_config';
/** @see VARIAVEIS_AMBIENTE — coleção onde fica o doc de envio Gmail/SMTP */
const COLLECTION =
  process.env.VELHUB_EMAIL_CONFIG_COLLECTION ||
  process.env.VELHUB_EMAIL_TRANSPORT_COLLECTION ||
  'email_config';
/** _id único do documento (notificações / transporte TK) */
const SINGLETON_ID = process.env.VELHUB_EMAIL_CONFIG_DOCUMENT_ID || 'email_tk_notifications';
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

const emailTransportSchema = new mongoose.Schema(
  {
    _id: { type: String, default: SINGLETON_ID },
    /** 'gmail_api' | 'smtp' — envio atual prioriza gmail_api quando credenciais válidas em MongoDB */
    transportMode: {
      type: String,
      enum: ['gmail_api', 'smtp'],
      default: 'gmail_api'
    },
    /** Remetente exibido (From); editável pela aba Config → Conexões */
    defaultFromEmail: { type: String, default: '', trim: true, lowercase: true },
    /** Conta Workspace/Google a personificar na JWT (domain-wide delegation). Teste pode ser igual ao From. */
    delegatedUserEmail: { type: String, default: '', trim: true, lowercase: true },
    /** Credencial GCP (JSON inteiro da service account; contém client_email / private_key) */
    serviceAccountJson: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  {
    timestamps: true,
    versionKey: false,
    collection: COLLECTION
  }
);

let CachedModel = null;

const getModel = () => {
  if (!CachedModel) {
    const conn = getConfigConnection();
    CachedModel = conn.model('EmailTransportConfig', emailTransportSchema, COLLECTION);
  }
  return CachedModel;
};

async function findSingletonLean() {
  const M = getModel();
  const doc = await M.findById(SINGLETON_ID).lean().exec();
  return doc || null;
}

async function upsertSingleton(data) {
  const M = getModel();
  return M.findOneAndUpdate(
    { _id: SINGLETON_ID },
    { $set: { ...data, _id: SINGLETON_ID } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).exec();
}

module.exports = {
  COLLECTION_NAME: COLLECTION,
  SINGLETON_ID,
  findSingletonLean,
  upsertSingleton,
  findSingleton() {
    return getModel().findById(SINGLETON_ID).exec();
  }
};
