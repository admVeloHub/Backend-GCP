// VERSION: v2.11.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
// CHANGELOG: v2.11.0 - Adicionado campo _dividaZero e removido _saudeSimplificada (reorganização)
const mongoose = require('mongoose');
const { getMongoUri } = require('../config/mongodb');

// Configurar conexões específicas para os databases
// Lazy loading: conexões criadas apenas quando os modelos são usados pela primeira vez
const CONFIG_DB_NAME = process.env.CONSOLE_CONFIG_DB || 'console_config';
let configConnection = null;

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

// ✅ USAR CONEXÃO COMPARTILHADA para console_analises
const { getAnalisesConnection } = require('../config/analisesConnection');

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
  _seguroCred: {
    type: String,
    required: true,
    default: 'on',
    enum: ['on', 'off', 'revisao']
  },
  _seguroCel: {
    type: String,
    required: true,
    default: 'on',
    enum: ['on', 'off', 'revisao']
  },
  _saudeSimplificada: {
    type: String,
    required: true,
    default: 'on',
    enum: ['on', 'off', 'revisao']
  },
  _clubeVelotax: {
    type: String,
    required: true,
    default: 'on',
    enum: ['on', 'off', 'revisao']
  },
  _dividaZero: {
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
moduleStatusSchema.index({ _seguroCred: 1 });
moduleStatusSchema.index({ _seguroCel: 1 });
moduleStatusSchema.index({ _clubeVelotax: 1 });
moduleStatusSchema.index({ _dividaZero: 1 });
moduleStatusSchema.index({ updatedAt: -1 });

// Índices para otimização do schema FAQ
faqSchema.index({ totalPerguntas: 1 });
faqSchema.index({ updatedAt: -1 });

// Modelos - criados com lazy loading
let ModuleStatusModel = null;
let FAQModel = null;

const getModuleStatusModel = () => {
  if (!ModuleStatusModel) {
    try {
      const connection = getConfigConnection();
      
      // Validar que conexão existe e está válida
      if (!connection) {
        throw new Error('Conexão MongoDB não foi criada');
      }
      
      ModuleStatusModel = connection.model('ModuleStatus', moduleStatusSchema, 'module_status');
    } catch (error) {
      console.error('❌ Erro ao inicializar modelo ModuleStatus:', error);
      throw error;
    }
  }
  return ModuleStatusModel;
};

const getFAQModel = () => {
  if (!FAQModel) {
    try {
      const connection = getAnalisesConnection();
      
      // Validar que conexão existe e está válida
      if (!connection) {
        throw new Error('Conexão MongoDB não foi criada');
      }
      
      FAQModel = connection.model('FAQ', faqSchema, 'faq_bot');
    } catch (error) {
      console.error('❌ Erro ao inicializar modelo FAQ:', error);
      throw error;
    }
  }
  return FAQModel;
};

// Criar funções construtoras que delegam para os modelos reais
const ModuleStatusConstructor = function(...args) {
  const model = getModuleStatusModel();
  if (!model) {
    throw new Error('Modelo ModuleStatus não foi inicializado');
  }
  return new model(...args);
};

const FAQConstructor = function(...args) {
  const model = getFAQModel();
  if (!model) {
    throw new Error('Modelo FAQ não foi inicializado');
  }
  return new model(...args);
};

// Copiar propriedades estáticas dos modelos para os construtores
Object.setPrototypeOf(ModuleStatusConstructor.prototype, mongoose.Model.prototype);
Object.setPrototypeOf(FAQConstructor.prototype, mongoose.Model.prototype);

// Exportar ambos os modelos com Proxy para lazy loading
module.exports = {
  ModuleStatus: new Proxy(ModuleStatusConstructor, {
    get: (target, prop) => {
      if (prop === Symbol.toStringTag) {
        return 'ModuleStatus';
      }
      const model = getModuleStatusModel();
      if (!model) {
        throw new Error('Modelo ModuleStatus não foi inicializado');
      }
      if (prop in model || typeof model[prop] !== 'undefined') {
        const value = model[prop];
        if (typeof value === 'function' && prop !== 'constructor') {
          return value.bind(model);
        }
        return value;
      }
      return target[prop];
    },
    construct: (target, args) => {
      const model = getModuleStatusModel();
      return new model(...args);
    }
  }),
  FAQ: new Proxy(FAQConstructor, {
    get: (target, prop) => {
      if (prop === Symbol.toStringTag) {
        return 'FAQ';
      }
      const model = getFAQModel();
      if (!model) {
        throw new Error('Modelo FAQ não foi inicializado');
      }
      if (prop in model || typeof model[prop] !== 'undefined') {
        const value = model[prop];
        if (typeof value === 'function' && prop !== 'constructor') {
          return value.bind(model);
        }
        return value;
      }
      return target[prop];
    },
    construct: (target, args) => {
      const model = getFAQModel();
      return new model(...args);
    }
  })
};
