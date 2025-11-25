// VERSION: v1.3.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
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
  audioStatusId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'AudioAnaliseStatus'
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
      min: 0,
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
audioAnaliseResultSchema.index({ audioStatusId: 1 });
audioAnaliseResultSchema.index({ nomeArquivo: 1 });
audioAnaliseResultSchema.index({ createdAt: -1 });

// Modelo - criado com lazy loading
let AudioAnaliseResultModel = null;

const getModel = () => {
  if (!AudioAnaliseResultModel) {
    const connection = getAnalisesConnection();
    AudioAnaliseResultModel = connection.model('AudioAnaliseResult', audioAnaliseResultSchema);
  }
  return AudioAnaliseResultModel;
};

module.exports = new Proxy({}, {
  get: (target, prop) => {
    const model = getModel();
    return model[prop];
  }
});

