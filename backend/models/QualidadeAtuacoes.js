// VERSION: v1.4.0 | DATE: 2025-11-25 | AUTHOR: VeloHub Development Team
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
        console.log('✅ Conexão MongoDB (QualidadeAtuacoes) estabelecida');
      });

      analisesConnection.on('error', (error) => {
        console.error('❌ Erro na conexão MongoDB (QualidadeAtuacoes):', error);
      });

      analisesConnection.on('disconnected', () => {
        console.warn('⚠️ Conexão MongoDB (QualidadeAtuacoes) desconectada');
      });
    } catch (error) {
      console.error('❌ Erro ao criar conexão MongoDB (QualidadeAtuacoes):', error);
      throw error;
    }
  }
  return analisesConnection;
};

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

// Modelo - criado com lazy loading
let QualidadeAtuacoesModel = null;

const getModel = () => {
  if (!QualidadeAtuacoesModel) {
    const connection = getAnalisesConnection();
    QualidadeAtuacoesModel = connection.model('QualidadeAtuacoes', qualidadeAtuacoesSchema, 'qualidade_atuacoes');
  }
  return QualidadeAtuacoesModel;
};

module.exports = new Proxy({}, {
  get: (target, prop) => {
    const model = getModel();
    return model[prop];
  }
});
