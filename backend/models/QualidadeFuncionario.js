// VERSION: v1.6.0 | DATE: 2025-11-25 | AUTHOR: VeloHub Development Team
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
        serverSelectionTimeoutMS: 5000, // Timeout de 5 segundos
        socketTimeoutMS: 45000,
      });

      // Event listeners para debug
      analisesConnection.on('connected', () => {
        console.log('✅ Conexão MongoDB (QualidadeFuncionario) estabelecida');
      });

      analisesConnection.on('error', (error) => {
        console.error('❌ Erro na conexão MongoDB (QualidadeFuncionario):', error);
      });

      analisesConnection.on('disconnected', () => {
        console.warn('⚠️ Conexão MongoDB (QualidadeFuncionario) desconectada');
      });
    } catch (error) {
      console.error('❌ Erro ao criar conexão MongoDB (QualidadeFuncionario):', error);
      throw error;
    }
  }
  return analisesConnection;
};

// Schema para acessos dos funcionários
const acessoSchema = new mongoose.Schema({
  sistema: {
    type: String,
    required: true
  },
  perfil: {
    type: String,
    required: true
  },
  observacoes: {
    type: String,
    default: ''
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Schema principal para qualidade_funcionarios
const qualidadeFuncionarioSchema = new mongoose.Schema({
  colaboradorNome: {
    type: String,
    required: true,
    trim: true
  },
  dataAniversario: {
    type: Date,
    default: null
  },
  empresa: {
    type: String,
    required: true,
    trim: true
  },
  dataContratado: {
    type: Date,
    required: true
  },
  telefone: {
    type: String,
    default: '',
    trim: true
  },
  atuacao: {
    type: mongoose.Schema.Types.Mixed, // Suporta String (antigo) e Array de ObjectIds (novo)
    default: '',
    validate: {
      validator: function(v) {
        // Aceita string vazia, string não vazia, ou array de ObjectIds
        if (typeof v === 'string') return true;
        if (Array.isArray(v)) {
          return v.every(id => mongoose.Types.ObjectId.isValid(id));
        }
        return false;
      },
      message: 'Atuação deve ser uma string ou array de ObjectIds válidos'
    }
  },
  escala: {
    type: String,
    default: '',
    trim: true
  },
  acessos: [acessoSchema],
  desligado: {
    type: Boolean,
    default: false
  },
  dataDesligamento: {
    type: Date,
    default: null
  },
  afastado: {
    type: Boolean,
    default: false
  },
  dataAfastamento: {
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
qualidadeFuncionarioSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Middleware para atualizar updatedAt antes de atualizar
qualidadeFuncionarioSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

// Índices para otimização de consultas
qualidadeFuncionarioSchema.index({ colaboradorNome: 1 });
qualidadeFuncionarioSchema.index({ empresa: 1 });
qualidadeFuncionarioSchema.index({ desligado: 1, afastado: 1 });
qualidadeFuncionarioSchema.index({ createdAt: -1 });

// Modelo - criado com lazy loading
let QualidadeFuncionarioModel = null;

const getModel = () => {
  if (!QualidadeFuncionarioModel) {
    try {
      const connection = getAnalisesConnection();
      QualidadeFuncionarioModel = connection.model('QualidadeFuncionario', qualidadeFuncionarioSchema, 'qualidade_funcionarios');

      // Método estático para obter funcionários ativos (não desligados e não afastados)
      QualidadeFuncionarioModel.getActiveFuncionarios = async function() {
        try {
          const funcionarios = await this.find({
            desligado: { $ne: true },
            afastado: { $ne: true }
          }).select('colaboradorNome').lean();
          
          return {
            success: true,
            data: funcionarios,
            count: funcionarios.length
          };
        } catch (error) {
          console.error('Erro ao obter funcionários ativos:', error);
          return {
            success: false,
            error: 'Erro interno do servidor'
          };
        }
      };
    } catch (error) {
      console.error('❌ Erro ao inicializar modelo QualidadeFuncionario:', error);
      throw error;
    }
  }
  return QualidadeFuncionarioModel;
};

module.exports = new Proxy({}, {
  get: (target, prop) => {
    const model = getModel();
    return model[prop];
  }
});
