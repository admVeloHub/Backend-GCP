// VERSION: v2.0.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
const mongoose = require('mongoose');
// ✅ USAR CONEXÃO COMPARTILHADA para garantir que populate funcione corretamente
const { getAnalisesConnection } = require('../config/analisesConnection');

// Schema para critérios de qualidade
const criteriosQualidadeSchema = new mongoose.Schema({
  saudacaoAdequada: { type: Boolean, default: false },
  escutaAtiva: { type: Boolean, default: false },
  clarezaObjetividade: { type: Boolean, default: false },
  resolucaoQuestao: { type: Boolean, default: false },
  dominioAssunto: { type: Boolean, default: false },
  empatiaCordialidade: { type: Boolean, default: false },
  direcionouPesquisa: { type: Boolean, default: false },
  procedimentoIncorreto: { type: Boolean, default: false },
  encerramentoBrusco: { type: Boolean, default: false }
}, { _id: false });

// Schema para timestamps das palavras
const timestampSchema = new mongoose.Schema({
  word: String,
  startTime: Number,
  endTime: Number
}, { _id: false });

// Schema para análise de emoção
const emotionSchema = new mongoose.Schema({
  tom: String,
  empatia: Number,
  profissionalismo: Number
}, { _id: false });

// Schema para nuance
const nuanceSchema = new mongoose.Schema({
  clareza: Number,
  tensao: Number
}, { _id: false });

// Schema principal para resultados da análise de áudio
const audioAnaliseResultSchema = new mongoose.Schema({
  avaliacaoMonitorId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'QualidadeAvaliacao'
  },
  nomeArquivo: {
    type: String,
    required: true,
    trim: true
  },
  gcsUri: {
    type: String,
    required: true
  },
  transcription: {
    type: String,
    required: true
  },
  timestamps: [timestampSchema],
  emotion: emotionSchema,
  nuance: nuanceSchema,
  qualityAnalysis: {
    criterios: criteriosQualidadeSchema,
    pontuacao: {
      type: Number,
      min: -160, // Permitir valores negativos (compatível com worker)
      max: 100
    },
    confianca: {
      type: Number,
      min: 0,
      max: 100
    },
    palavrasCriticas: [String],
    calculoDetalhado: [String],
    analysis: String
  },
  gptAnalysis: { // Análise GPT (opcional)
    criterios: criteriosQualidadeSchema,
    pontuacao: {
      type: Number,
      min: -160,
      max: 100
    },
    palavrasCriticas: [String],
    recomendacoes: [String],
    confianca: {
      type: Number,
      min: 0,
      max: 100
    },
    validacaoGemini: {
      concorda: Boolean,
      diferencas: [String]
    },
    analysis: String
  },
  pontuacaoConsensual: { // Pontuação consensual (média entre Gemini e GPT)
    type: Number,
    min: -160,
    max: 100
  },
  processingTime: {
    type: Number // em segundos
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'audio_analise_results'
});

// Índices
audioAnaliseResultSchema.index({ avaliacaoMonitorId: 1 });
audioAnaliseResultSchema.index({ nomeArquivo: 1 });
audioAnaliseResultSchema.index({ createdAt: -1 });

// Modelo - criado com lazy loading
let AudioAnaliseResultModel = null;

const getModel = () => {
  if (!AudioAnaliseResultModel) {
    try {
      const connection = getAnalisesConnection();
      
      // Validar que conexão existe e está válida
      if (!connection) {
        throw new Error('Conexão MongoDB não foi criada');
      }
      
      AudioAnaliseResultModel = connection.model('AudioAnaliseResult', audioAnaliseResultSchema);
    } catch (error) {
      console.error('❌ Erro ao inicializar modelo AudioAnaliseResult:', error);
      throw error;
    }
  }
  return AudioAnaliseResultModel;
};

// Criar função construtora que delega para o modelo real
const AudioAnaliseResultConstructor = function(...args) {
  const model = getModel();
  if (!model) {
    throw new Error('Modelo AudioAnaliseResult não foi inicializado');
  }
  return new model(...args);
};

// Copiar propriedades estáticas do modelo para o construtor
Object.setPrototypeOf(AudioAnaliseResultConstructor.prototype, mongoose.Model.prototype);

module.exports = new Proxy(AudioAnaliseResultConstructor, {
  get: (target, prop) => {
    // Propriedades especiais do Proxy
    if (prop === Symbol.toStringTag) {
      return 'AudioAnaliseResult';
    }
    
    const model = getModel();
    if (!model) {
      throw new Error('Modelo AudioAnaliseResult não foi inicializado');
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

