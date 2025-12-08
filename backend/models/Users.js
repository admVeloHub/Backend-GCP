// VERSION: v1.15.0 | DATE: 2025-11-25 | AUTHOR: VeloHub Development Team
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
    academy: { type: Boolean, default: false },
    whatsapp: { type: Boolean, default: false }
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
    try {
      const connection = getConfigConnection();
      
      // Validar que conexão existe e está válida
      if (!connection) {
        throw new Error('Conexão MongoDB não foi criada');
      }
      
      UsersModel = connection.model('Users', userSchema, 'users');
    } catch (error) {
      console.error('❌ Erro ao inicializar modelo Users:', error);
      throw error;
    }
  }
  return UsersModel;
};

// Criar função construtora que delega para o modelo real
const UsersConstructor = function(...args) {
  const model = getModel();
  if (!model) {
    throw new Error('Modelo Users não foi inicializado');
  }
  return new model(...args);
};

// Copiar propriedades estáticas do modelo para o construtor
Object.setPrototypeOf(UsersConstructor.prototype, mongoose.Model.prototype);

module.exports = new Proxy(UsersConstructor, {
  get: (target, prop) => {
    // Propriedades especiais do Proxy
    if (prop === Symbol.toStringTag) {
      return 'Users';
    }
    
    const model = getModel();
    if (!model) {
      throw new Error('Modelo Users não foi inicializado');
    }
    
    // Se a propriedade existe no modelo, retornar do modelo
    if (prop in model || typeof model[prop] !== 'undefined') {
      const value = model[prop];
      // Bind métodos para manter contexto correto
      if (typeof value === 'function' && prop !== 'constructor') {
        return value.bind(model);
      }
      return value;
    }
    
    // Caso contrário, retornar do target (função construtora)
    return target[prop];
  },
  construct: (target, args) => {
    const model = getModel();
    return new model(...args);
  }
});
