// VERSION: v1.0.0 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team
const mongoose = require('mongoose');

// Configurar conexão específica para console_analises
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://REDACTED_ATLAS_URI';
const ANALISES_DB_NAME = process.env.CONSOLE_ANALISES_DB || 'console_analises';

// Criar conexão específica para análises
const analisesConnection = mongoose.createConnection(MONGODB_URI, {
  dbName: ANALISES_DB_NAME
});

// Schema para qualidade_atuacoes
const qualidadeAtuacoesSchema = new mongoose.Schema({
  funcao: {
    type: String,
    required: true,
    trim: true,
    unique: true
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
qualidadeAtuacoesSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Middleware para atualizar updatedAt antes de atualizar
qualidadeAtuacoesSchema.pre(['updateOne', 'findOneAndUpdate'], function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

module.exports = analisesConnection.model('QualidadeAtuacoes', qualidadeAtuacoesSchema, 'qualidade_atuacoes');
