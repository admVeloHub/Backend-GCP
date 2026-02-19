// VERSION: v2.3.2 | DATE: 2025-02-11 | AUTHOR: VeloHub Development Team
// CHANGELOG: v2.3.2 - Removido completamente campo dominioAssunto do schema. Campo não existe mais no modelo.
// CHANGELOG: v2.3.1 - Removida obrigatoriedade (required: true) dos campos booleanos. Checkboxes sempre enviam true ou false, nunca null/undefined. Todos os campos booleanos agora têm default: false.
// CHANGELOG: v2.3.0 - Substituído dominioAssunto por registroAtendimento, adicionado conformidadeTicket -15pts, atualizadas pontuações
const mongoose = require('mongoose');
// ✅ USAR CONEXÃO COMPARTILHADA para garantir que populate funcione corretamente
const { getAnalisesConnection } = require('../config/analisesConnection');

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
  registroAtendimento: {
    type: Boolean,
    default: false
  },
  naoConsultouBot: {
    type: Boolean,
    default: false
  },
  conformidadeTicket: {
    type: Boolean,
    default: false
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
  // Campos de status de áudio (fundidos de audio_analise_status)
  nomeArquivoAudio: {
    type: String,
    default: null,
    trim: true
  },
  audioSent: {
    type: Boolean,
    default: false
  },
  audioTreated: {
    type: Boolean,
    default: false
  },
  audioCreatedAt: {
    type: Date,
    default: null
  },
  audioUpdatedAt: {
    type: Date,
    default: null
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
qualidadeAvaliacaoSchema.index({ audioSent: 1 });
qualidadeAvaliacaoSchema.index({ audioTreated: 1 });
qualidadeAvaliacaoSchema.index({ nomeArquivoAudio: 1 });

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
