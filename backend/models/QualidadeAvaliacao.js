// VERSION: v1.9.0 | DATE: 2025-11-25 | AUTHOR: VeloHub Development Team
const mongoose = require('mongoose');
const { getMongoUri } = require('../config/mongodb');

// Configurar conexão específica para console_analises
// Lazy loading: conexão criada apenas quando o modelo é usado pela primeira vez
const ANALISES_DB_NAME = process.env.CONSOLE_ANALISES_DB || 'console_analises';
let analisesConnection = null;

// Função para obter conexão (lazy loading)
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
        console.log('✅ Conexão MongoDB (QualidadeAvaliacao) estabelecida');
      });

      analisesConnection.on('error', (error) => {
        console.error('❌ Erro na conexão MongoDB (QualidadeAvaliacao):', error);
      });

      analisesConnection.on('disconnected', () => {
        console.warn('⚠️ Conexão MongoDB (QualidadeAvaliacao) desconectada');
      });
    } catch (error) {
      console.error('❌ Erro ao criar conexão MongoDB (QualidadeAvaliacao):', error);
      throw error;
    }
  }
  return analisesConnection;
};

// Schema principal para qualidade_avaliacoes
const qualidadeAvaliacaoSchema = new mongoose.Schema({
  colaboradorNome: {
    type: String,
    required: true,
    trim: true
  },
  avaliador: {
    type: String,
    required: true,
    trim: true
  },
  mes: {
    type: String,
    required: true,
    trim: true
  },
  ano: {
    type: Number,
    required: true
  },
  saudacaoAdequada: {
    type: Boolean,
    required: true
  },
  escutaAtiva: {
    type: Boolean,
    required: true
  },
  resolucaoQuestao: {
    type: Boolean,
    required: true
  },
  empatiaCordialidade: {
    type: Boolean,
    required: true
  },
  direcionouPesquisa: {
    type: Boolean,
    required: true
  },
  procedimentoIncorreto: {
    type: Boolean,
    required: true
  },
  encerramentoBrusco: {
    type: Boolean,
    required: true
  },
  clarezaObjetividade: {
    type: Boolean,
    required: true
  },
  dominioAssunto: {
    type: Boolean,
    required: true
  },
  observacoes: {
    type: String,
    default: '',
    trim: true
  },
  dataLigacao: {
    type: Date,
    required: true
  },
  pontuacaoTotal: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware para atualizar updatedAt antes de salvar
qualidadeAvaliacaoSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Middleware para atualizar updatedAt antes de atualizar
qualidadeAvaliacaoSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

// Índices para otimização de consultas
qualidadeAvaliacaoSchema.index({ colaboradorNome: 1 });
qualidadeAvaliacaoSchema.index({ avaliador: 1 });
qualidadeAvaliacaoSchema.index({ mes: 1, ano: 1 });
qualidadeAvaliacaoSchema.index({ createdAt: -1 });

// Modelo - criado com lazy loading
let QualidadeAvaliacaoModel = null;

const getModel = () => {
  if (!QualidadeAvaliacaoModel) {
    try {
      const connection = getAnalisesConnection();
      
      // Validar que conexão existe e está válida
      if (!connection) {
        throw new Error('Conexão MongoDB não foi criada');
      }
      
      QualidadeAvaliacaoModel = connection.model('QualidadeAvaliacao', qualidadeAvaliacaoSchema, 'qualidade_avaliacoes');
    } catch (error) {
      console.error('❌ Erro ao inicializar modelo QualidadeAvaliacao:', error);
      throw error;
    }
  }
  return QualidadeAvaliacaoModel;
};

// Criar função construtora que delega para o modelo real
const QualidadeAvaliacaoConstructor = function(...args) {
  const model = getModel();
  if (!model) {
    throw new Error('Modelo QualidadeAvaliacao não foi inicializado');
  }
  return new model(...args);
};

// Copiar propriedades estáticas do modelo para o construtor
Object.setPrototypeOf(QualidadeAvaliacaoConstructor.prototype, mongoose.Model.prototype);

module.exports = new Proxy(QualidadeAvaliacaoConstructor, {
  get: (target, prop) => {
    // Propriedades especiais do Proxy
    if (prop === Symbol.toStringTag) {
      return 'QualidadeAvaliacao';
    }
    
    const model = getModel();
    if (!model) {
      throw new Error('Modelo QualidadeAvaliacao não foi inicializado');
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
