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

// Schema para qualidade_funcoes - COMPLIANCE OBRIGATÓRIO
const qualidadeFuncoesSchema = new mongoose.Schema({
  funcao: {
    type: String,
    required: [true, 'Nome da função é obrigatório'],
    trim: true,
    unique: true,
    validate: {
      validator: function(v) {
        return v && v.trim().length > 0;
      },
      message: 'Nome da função não pode estar vazio'
    }
  },
  descricao: {
    type: String,
    default: '',
    trim: true
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
qualidadeFuncoesSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Middleware para atualizar updatedAt antes de atualizar
qualidadeFuncoesSchema.pre(['updateOne', 'findOneAndUpdate'], function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

module.exports = analisesConnection.model('QualidadeFuncoes', qualidadeFuncoesSchema, 'qualidade_funcoes');
