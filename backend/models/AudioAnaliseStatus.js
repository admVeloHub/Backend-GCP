// VERSION: v1.7.0 | DATE: 2025-11-25 | AUTHOR: VeloHub Development Team
// ⚠️ DEPRECATED: Este modelo foi fundido em QualidadeAvaliacao.js
// Os campos nomeArquivo, sent, treated foram movidos para qualidade_avaliacoes
// como nomeArquivoAudio, audioSent, audioTreated
// Este arquivo é mantido apenas para compatibilidade durante a migração
// TODO: Remover após migração completa e validação

const mongoose = require('mongoose');
// ✅ USAR CONEXÃO COMPARTILHADA para garantir que populate funcione corretamente
const { getAnalisesConnection } = require('../config/analisesConnection');

// Schema para controle de envio e exibição do status do processamento de áudio
// ⚠️ DEPRECATED - Use QualidadeAvaliacao com campos audioSent, audioTreated, nomeArquivoAudio
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

