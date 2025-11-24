// VERSION: v1.2.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
const mongoose = require('mongoose');

// Configurar conexão específica para console_analises
// MONGODB_URI deve ser configurada via variável de ambiente (secrets)
if (!process.env.MONGODB_URI) {
  throw new Error('❌ MONGODB_URI não configurada. Configure a variável de ambiente MONGODB_URI.');
}
const MONGODB_URI = process.env.MONGODB_URI;
const ANALISES_DB_NAME = process.env.CONSOLE_ANALISES_DB || 'console_analises';

// Criar conexão específica para análises
const analisesConnection = mongoose.createConnection(MONGODB_URI, {
  dbName: ANALISES_DB_NAME
});

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

// Modelo
const AudioAnaliseStatus = analisesConnection.model('AudioAnaliseStatus', audioAnaliseStatusSchema);

module.exports = AudioAnaliseStatus;

