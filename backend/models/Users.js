// VERSION: v1.12.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
const mongoose = require('mongoose');

// Configurar conexão específica para o database console_config
const CONFIG_DB_NAME = process.env.CONSOLE_CONFIG_DB || 'console_config';
// MONGODB_URI deve ser configurada via variável de ambiente (secrets)
if (!process.env.MONGODB_URI) {
  throw new Error('❌ MONGODB_URI não configurada. Configure a variável de ambiente MONGODB_URI.');
}
const MONGODB_URI = process.env.MONGODB_URI;

// Criar conexão específica para o database de configuração
const configConnection = mongoose.createConnection(MONGODB_URI, {
  dbName: CONFIG_DB_NAME,
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const userSchema = new mongoose.Schema({
  _userMail: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  _userId: {
    type: String,
    required: true,
    unique: true
  },
  _userRole: {
    type: String,
    required: true,
    default: 'viewer'
  },
  _userClearance: {
    artigos: { type: Boolean, default: false },
    velonews: { type: Boolean, default: false },
    botPerguntas: { type: Boolean, default: false },
    botAnalises: { type: Boolean, default: false },
    hubAnalises: { type: Boolean, default: false },
    chamadosInternos: { type: Boolean, default: false },
    igp: { type: Boolean, default: false },
    qualidade: { type: Boolean, default: false },
    capacity: { type: Boolean, default: false },
    config: { type: Boolean, default: false },
    servicos: { type: Boolean, default: false },
    academy: { type: Boolean, default: false }
  },
  _userTickets: {
    artigos: { type: Boolean, default: false },
    processos: { type: Boolean, default: false },
    roteiros: { type: Boolean, default: false },
    treinamentos: { type: Boolean, default: false },
    funcionalidades: { type: Boolean, default: false },
    recursos: { type: Boolean, default: false },
    gestao: { type: Boolean, default: false },
    rhFin: { type: Boolean, default: false },
    facilities: { type: Boolean, default: false }
  },
  _funcoesAdministrativas: {
    avaliador: { type: Boolean, default: false },
    auditoria: { type: Boolean, default: false },
    relatoriosGestao: { type: Boolean, default: false }
  }
}, {
  timestamps: true,
  versionKey: false,
  collection: 'users'
});

// Índices para otimização
userSchema.index({ _userMail: 1 });
userSchema.index({ _userId: 1 });
userSchema.index({ _userRole: 1 });

module.exports = configConnection.model('Users', userSchema, 'users');
