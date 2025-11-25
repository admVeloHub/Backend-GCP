// VERSION: v2.7.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
const mongoose = require('mongoose');
const { getMongoUri } = require('../config/mongodb');

// Configurar conexões específicas para os databases
// Lazy loading: conexões criadas apenas quando os modelos são usados pela primeira vez
const CONFIG_DB_NAME = process.env.CONSOLE_CONFIG_DB || 'console_config';
const ANALISES_DB_NAME = process.env.CONSOLE_ANALISES_DB || 'console_analises';
let configConnection = null;
let analisesConnection = null;

// Função para obter conexão de configuração (lazy loading)
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

// Função para obter conexão de análises (lazy loading)
const getAnalisesConnection = () => {
  if (!analisesConnection) {
    const MONGODB_URI = getMongoUri();
    analisesConnection = mongoose.createConnection(MONGODB_URI, {
      dbName: ANALISES_DB_NAME,
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  }
  return analisesConnection;
};

// Schema para status dos módulos (documento com _id: "status")
const moduleStatusSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  _trabalhador: {
    type: String,
    required: true,
    default: 'on',
    enum: ['on', 'off', 'revisao']
  },
  _pessoal: {
    type: String,
    required: true,
    default: 'on',
    enum: ['on', 'off', 'revisao']
  },
  _antecipacao: {
    type: String,
    required: true,
    default: 'on',
    enum: ['on', 'off', 'revisao']
  },
  _pgtoAntecip: {
    type: String,
    required: true,
    default: 'on',
    enum: ['on', 'off', 'revisao']
  },
  _irpf: {
    type: String,
    required: true,
    default: 'on',
    enum: ['on', 'off', 'revisao']
  },
  _seguro: {
    type: String,
    required: true,
    default: 'on',
    enum: ['on', 'off', 'revisao']
  }
}, {
  timestamps: true,
  collection: 'module_status'
});

// Schema para perguntas frequentes do bot (documento com _id: "faq")
const faqSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  dados: {
    type: [String],
    required: true,
    validate: {
      validator: function(v) {
        return v.length <= 10; // Máximo 10 perguntas
      },
      message: 'Máximo de 10 perguntas permitidas'
    }
  },
  totalPerguntas: {
    type: Number,
    required: true,
    min: 0
  }
}, {
  timestamps: true,
  collection: 'faq_bot'
});

// Índices para otimização do schema de status
moduleStatusSchema.index({ _trabalhador: 1 });
moduleStatusSchema.index({ _pessoal: 1 });
moduleStatusSchema.index({ _antecipacao: 1 });
moduleStatusSchema.index({ _pgtoAntecip: 1 });
moduleStatusSchema.index({ _irpf: 1 });
moduleStatusSchema.index({ _seguro: 1 });
moduleStatusSchema.index({ updatedAt: -1 });

// Índices para otimização do schema FAQ
faqSchema.index({ totalPerguntas: 1 });
faqSchema.index({ updatedAt: -1 });

// Modelos - criados com lazy loading
let ModuleStatusModel = null;
let FAQModel = null;

const getModuleStatusModel = () => {
  if (!ModuleStatusModel) {
    const connection = getConfigConnection();
    ModuleStatusModel = connection.model('ModuleStatus', moduleStatusSchema, 'module_status');
  }
  return ModuleStatusModel;
};

const getFAQModel = () => {
  if (!FAQModel) {
    const connection = getAnalisesConnection();
    FAQModel = connection.model('FAQ', faqSchema, 'faq_bot');
  }
  return FAQModel;
};

// Exportar ambos os modelos com Proxy para lazy loading
module.exports = {
  ModuleStatus: new Proxy({}, {
    get: (target, prop) => {
      const model = getModuleStatusModel();
      return model[prop];
    }
  }),
  FAQ: new Proxy({}, {
    get: (target, prop) => {
      const model = getFAQModel();
      return model[prop];
    }
  })
};
