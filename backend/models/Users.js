// VERSION: v1.14.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
const mongoose = require('mongoose');
const { getMongoUri } = require('../config/mongodb');

// Configurar conexão específica para o database console_config
// Lazy loading: conexão criada apenas quando o modelo é usado pela primeira vez
const CONFIG_DB_NAME = process.env.CONSOLE_CONFIG_DB || 'console_config';
let configConnection = null;

// Função para obter conexão (lazy loading)
const getConfigConnection = () => {
  if (!configConnection) {
    // MONGO_ENV deve ser configurada via variável de ambiente (secrets)
    // Validação feita apenas quando a conexão é realmente necessária
    const MONGODB_URI = getMongoUri();
    configConnection = mongoose.createConnection(MONGODB_URI, {
      dbName: CONFIG_DB_NAME,
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  }
  return configConnection;
};

const userSchema = new mongoose.Schema({
  _userMail: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  _userId: {
    type: String,
    required: true,
    unique: true
  },
  _userRole: {
    type: String,
    required: true,
    default: 'viewer'
  },
  _userClearance: {
    artigos: { type: Boolean, default: false },
    velonews: { type: Boolean, default: false },
    botPerguntas: { type: Boolean, default: false },
    botAnalises: { type: Boolean, default: false },
    hubAnalises: { type: Boolean, default: false },
    chamadosInternos: { type: Boolean, default: false },
    igp: { type: Boolean, default: false },
    qualidade: { type: Boolean, default: false },
    capacity: { type: Boolean, default: false },
    config: { type: Boolean, default: false },
    servicos: { type: Boolean, default: false },
    academy: { type: Boolean, default: false }
  },
  _userTickets: {
    artigos: { type: Boolean, default: false },
    processos: { type: Boolean, default: false },
    roteiros: { type: Boolean, default: false },
    treinamentos: { type: Boolean, default: false },
    funcionalidades: { type: Boolean, default: false },
    recursos: { type: Boolean, default: false },
    gestao: { type: Boolean, default: false },
    rhFin: { type: Boolean, default: false },
    facilities: { type: Boolean, default: false }
  },
  _funcoesAdministrativas: {
    avaliador: { type: Boolean, default: false },
    auditoria: { type: Boolean, default: false },
    relatoriosGestao: { type: Boolean, default: false }
  }
}, {
  timestamps: true,
  versionKey: false,
  collection: 'users'
});

// Índices para otimização
userSchema.index({ _userMail: 1 });
userSchema.index({ _userId: 1 });
userSchema.index({ _userRole: 1 });

// Modelo - criado com lazy loading
let UsersModel = null;

const getModel = () => {
  if (!UsersModel) {
    const connection = getConfigConnection();
    UsersModel = connection.model('Users', userSchema, 'users');
  }
  return UsersModel;
};

module.exports = new Proxy({}, {
  get: (target, prop) => {
    const model = getModel();
    return model[prop];
  }
});
