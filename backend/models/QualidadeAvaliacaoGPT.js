// VERSION: v1.6.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
const mongoose = require('mongoose');
const { getMongoUri } = require('../config/mongodb');

// Configurar conexão específica para console_analises
// Lazy loading: conexão criada apenas quando o modelo é usado pela primeira vez
const ANALISES_DB_NAME = process.env.CONSOLE_ANALISES_DB || 'console_analises';
let analisesConnection = null;

// Função para obter conexão (lazy loading)
const getAnalisesConnection = () => {
  if (!analisesConnection) {
    const MONGODB_URI = getMongoUri();
    analisesConnection = mongoose.createConnection(MONGODB_URI, {
      dbName: ANALISES_DB_NAME
    });
  }
  return analisesConnection;
};

// Schema para critérios GPT
const criteriosGPTSchema = new mongoose.Schema({
  saudacaoAdequada: {
    type: Boolean,
    default: false
  },
  escutaAtiva: {
    type: Boolean,
    default: false
  },
  resolucaoQuestao: {
    type: Boolean,
    default: false
  },
  empatiaCordialidade: {
    type: Boolean,
    default: false
  },
  direcionouPesquisa: {
    type: Boolean,
    default: false
  },
  procedimentoIncorreto: {
    type: Boolean,
    default: false
  },
  encerramentoBrusco: {
    type: Boolean,
    default: false
  },
  clarezaObjetividade: {
    type: Boolean,
    default: false
  },
  dominioAssunto: {
    type: Boolean,
    default: false
  }
}, { _id: false });

// Schema principal para qualidade_avaliacoes_gpt
const qualidadeAvaliacaoGPTSchema = new mongoose.Schema({
  avaliacao_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'QualidadeAvaliacao'
  },
  analiseGPT: {
    type: String,
    required: true,
    trim: true
  },
  pontuacaoGPT: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  criteriosGPT: {
    type: criteriosGPTSchema,
    required: true
  },
  confianca: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  palavrasCriticas: [{
    type: String,
    trim: true
  }],
  calculoDetalhado: [{
    type: String,
    trim: true
  }],
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
qualidadeAvaliacaoGPTSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Middleware para atualizar updatedAt antes de atualizar
qualidadeAvaliacaoGPTSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

// Índices para otimização de consultas
qualidadeAvaliacaoGPTSchema.index({ avaliacao_id: 1 });
qualidadeAvaliacaoGPTSchema.index({ pontuacaoGPT: 1 });
qualidadeAvaliacaoGPTSchema.index({ confianca: 1 });
qualidadeAvaliacaoGPTSchema.index({ createdAt: -1 });

// Modelo - criado com lazy loading
let QualidadeAvaliacaoGPTModel = null;

const getModel = () => {
  if (!QualidadeAvaliacaoGPTModel) {
    const connection = getAnalisesConnection();
    QualidadeAvaliacaoGPTModel = connection.model('QualidadeAvaliacaoGPT', qualidadeAvaliacaoGPTSchema, 'qualidade_avaliacoes_gpt');
  }
  return QualidadeAvaliacaoGPTModel;
};

module.exports = new Proxy({}, {
  get: (target, prop) => {
    const model = getModel();
    return model[prop];
  }
});
