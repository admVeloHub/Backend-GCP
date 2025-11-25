// VERSION: v1.5.0 | DATE: 2025-11-25 | AUTHOR: VeloHub Development Team
const mongoose = require('mongoose');
const { getMongoUri } = require('../config/mongodb');

// Configurar conexão específica para console_analises
// Lazy loading: conexão criada apenas quando o modelo é usado pela primeira vez
const ANALISES_DB_NAME = process.env.CONSOLE_ANALISES_DB || 'console_analises';
let analisesConnection = null;

// Função para obter conexão (lazy loading)
const getAnalisesConnection = () => {
  if (!analisesConnection) {
    try {
      const MONGODB_URI = getMongoUri();
      if (!MONGODB_URI) {
        throw new Error('MONGO_ENV não configurada');
      }
      
      analisesConnection = mongoose.createConnection(MONGODB_URI, {
        dbName: ANALISES_DB_NAME,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      analisesConnection.on('connected', () => {
        console.log('✅ Conexão MongoDB (QualidadeFuncoes) estabelecida');
      });

      analisesConnection.on('error', (error) => {
        console.error('❌ Erro na conexão MongoDB (QualidadeFuncoes):', error);
      });

      analisesConnection.on('disconnected', () => {
        console.warn('⚠️ Conexão MongoDB (QualidadeFuncoes) desconectada');
      });
    } catch (error) {
      console.error('❌ Erro ao criar conexão MongoDB (QualidadeFuncoes):', error);
      throw error;
    }
  }
  return analisesConnection;
};

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

// Modelo - criado com lazy loading
let QualidadeFuncoesModel = null;

const getModel = () => {
  if (!QualidadeFuncoesModel) {
    const connection = getAnalisesConnection();
    QualidadeFuncoesModel = connection.model('QualidadeFuncoes', qualidadeFuncoesSchema, 'qualidade_funcoes');
  }
  return QualidadeFuncoesModel;
};

module.exports = new Proxy({}, {
  get: (target, prop) => {
    const model = getModel();
    return model[prop];
  }
});
