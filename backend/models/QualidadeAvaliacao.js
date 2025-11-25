// VERSION: v1.8.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
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
    const connection = getAnalisesConnection();
    QualidadeAvaliacaoModel = connection.model('QualidadeAvaliacao', qualidadeAvaliacaoSchema, 'qualidade_avaliacoes');
  }
  return QualidadeAvaliacaoModel;
};

module.exports = new Proxy({}, {
  get: (target, prop) => {
    const model = getModel();
    return model[prop];
  }
});
