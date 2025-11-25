// VERSION: v1.6.0 | DATE: 2025-11-25 | AUTHOR: VeloHub Development Team
const mongoose = require('mongoose');
const { getMongoUri } = require('../config/mongodb');

// Configurar conexão específica para console_analises
// Lazy loading: conexão criada apenas quando o modelo é usado pela primeira vez
const ANALISES_DB_NAME = process.env.CONSOLE_ANALISES_DB || 'console_analises';
let analisesConnection = null;

// Função para obter conexão (lazy loading)
const getAnalisesConnection = () => {
  if (!analisesConnection) {
    // MONGO_ENV deve ser configurada via variável de ambiente (secrets)
    // Validação feita apenas quando a conexão é realmente necessária
    const MONGODB_URI = getMongoUri();
    analisesConnection = mongoose.createConnection(MONGODB_URI, {
      dbName: ANALISES_DB_NAME
    });
  }
  return analisesConnection;
};

// Schema para controle de envio e exibição do status do processamento de áudio
const audioAnaliseStatusSchema = new mongoose.Schema({
  nomeArquivo: {
    type: String,
    required: true,
    trim: true
  },
  avaliacaoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QualidadeAvaliacao',
    required: false
  },
  sent: {
    type: Boolean,
    required: true,
    default: false
  },
  treated: {
    type: Boolean,
    required: true,
    default: false
  }
}, {
  timestamps: true, // Adiciona createdAt e updatedAt automaticamente
  collection: 'audio_analise_status'
});

// Índices para otimização de consultas
audioAnaliseStatusSchema.index({ nomeArquivo: 1 });
audioAnaliseStatusSchema.index({ avaliacaoId: 1 });
audioAnaliseStatusSchema.index({ sent: 1 });
audioAnaliseStatusSchema.index({ treated: 1 });
audioAnaliseStatusSchema.index({ createdAt: -1 });

// Métodos estáticos
audioAnaliseStatusSchema.statics.findByNomeArquivo = function(nomeArquivo) {
  return this.findOne({ nomeArquivo });
};

audioAnaliseStatusSchema.statics.findProcessando = function() {
  return this.find({ sent: true, treated: false });
};

audioAnaliseStatusSchema.statics.findConcluidos = function() {
  return this.find({ treated: true });
};

// Método de instância para marcar como enviado
audioAnaliseStatusSchema.methods.marcarComoEnviado = function() {
  this.sent = true;
  this.treated = false;
  return this.save();
};

// Método de instância para marcar como tratado
audioAnaliseStatusSchema.methods.marcarComoTratado = function() {
  this.treated = true;
  return this.save();
};

// Modelo - criado com lazy loading
let AudioAnaliseStatusModel = null;

const getModel = () => {
  if (!AudioAnaliseStatusModel) {
    try {
      const connection = getAnalisesConnection();
      
      // Validar que conexão existe e está válida
      if (!connection) {
        throw new Error('Conexão MongoDB não foi criada');
      }
      
      AudioAnaliseStatusModel = connection.model('AudioAnaliseStatus', audioAnaliseStatusSchema);
    } catch (error) {
      console.error('❌ Erro ao inicializar modelo AudioAnaliseStatus:', error);
      throw error;
    }
  }
  return AudioAnaliseStatusModel;
};

// Criar função construtora que delega para o modelo real
const AudioAnaliseStatusConstructor = function(...args) {
  const model = getModel();
  if (!model) {
    throw new Error('Modelo AudioAnaliseStatus não foi inicializado');
  }
  return new model(...args);
};

// Copiar propriedades estáticas do modelo para o construtor
Object.setPrototypeOf(AudioAnaliseStatusConstructor.prototype, mongoose.Model.prototype);

module.exports = new Proxy(AudioAnaliseStatusConstructor, {
  get: (target, prop) => {
    // Propriedades especiais do Proxy
    if (prop === Symbol.toStringTag) {
      return 'AudioAnaliseStatus';
    }
    
    const model = getModel();
    if (!model) {
      throw new Error('Modelo AudioAnaliseStatus não foi inicializado');
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

