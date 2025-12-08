// VERSION: v1.0.0 | DATE: 2025-02-02 | AUTHOR: VeloHub Development Team
const mongoose = require('mongoose');
const { getMongoUri } = require('../config/mongodb');

// Configurar conexão específica para o database academy_registros
const ACADEMY_REGISTROS_DB_NAME = process.env.ACADEMY_REGISTROS_DB || 'academy_registros';
let academyConnection = null;

const getAcademyConnection = () => {
  if (!academyConnection) {
    const MONGODB_URI = getMongoUri();
    academyConnection = mongoose.createConnection(MONGODB_URI, {
      dbName: ACADEMY_REGISTROS_DB_NAME,
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  }
  return academyConnection;
};

// Schema para secoes
const secoesSchema = new mongoose.Schema({
  moduloId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'ID do módulo é obrigatório'],
    ref: 'Modulos'
  },
  temaNome: {
    type: String,
    required: [true, 'Nome do tema é obrigatório'],
    trim: true
  },
  temaOrder: {
    type: Number,
    required: [true, 'Ordem do tema é obrigatória'],
    min: [1, 'Ordem deve ser maior que zero']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  hasQuiz: {
    type: Boolean,
    default: false
  },
  quizId: {
    type: String,
    default: null,
    trim: true
  }
}, {
  timestamps: true,
  versionKey: false,
  collection: 'secoes',
  minimize: false
});

// Índices para otimização
secoesSchema.index({ moduloId: 1 });
secoesSchema.index({ temaOrder: 1 });
secoesSchema.index({ moduloId: 1, temaOrder: 1 });

// Métodos estáticos do modelo
secoesSchema.statics.createSecao = async function(secaoData) {
  try {
    const secao = new this(secaoData);
    await secao.save();
    return {
      success: true,
      data: secao,
      message: 'Seção criada com sucesso'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao criar seção'
    };
  }
};

secoesSchema.statics.getByModuloId = async function(moduloId) {
  try {
    const secoes = await this.find({ moduloId: moduloId }).sort({ temaOrder: 1 });
    return {
      success: true,
      data: secoes,
      count: secoes.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao buscar seções por módulo'
    };
  }
};

secoesSchema.statics.getById = async function(id) {
  try {
    const secao = await this.findById(id);
    if (!secao) {
      return {
        success: false,
        error: 'Seção não encontrada'
      };
    }
    return {
      success: true,
      data: secao
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao obter seção'
    };
  }
};

secoesSchema.statics.updateSecao = async function(id, updateData) {
  try {
    const secao = await this.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    if (!secao) {
      return {
        success: false,
        error: 'Seção não encontrada'
      };
    }
    
    return {
      success: true,
      data: secao,
      message: 'Seção atualizada com sucesso'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao atualizar seção'
    };
  }
};

secoesSchema.statics.deleteSecao = async function(id) {
  try {
    const secao = await this.findByIdAndDelete(id);
    if (!secao) {
      return {
        success: false,
        error: 'Seção não encontrada'
      };
    }
    return {
      success: true,
      message: 'Seção deletada com sucesso'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao deletar seção'
    };
  }
};

secoesSchema.statics.deleteByModuloId = async function(moduloId) {
  try {
    const result = await this.deleteMany({ moduloId: moduloId });
    return {
      success: true,
      deletedCount: result.deletedCount,
      message: `${result.deletedCount} seção(ões) deletada(s) com sucesso`
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao deletar seções por módulo'
    };
  }
};

// Modelo - criado com lazy loading
let SecoesModel = null;

const getModel = () => {
  if (!SecoesModel) {
    try {
      const connection = getAcademyConnection();
      
      if (!connection) {
        throw new Error('Conexão MongoDB não foi criada');
      }
      
      SecoesModel = connection.model('Secoes', secoesSchema, 'secoes');
    } catch (error) {
      console.error('❌ Erro ao inicializar modelo Secoes:', error);
      throw error;
    }
  }
  return SecoesModel;
};

const SecoesConstructor = function(...args) {
  const model = getModel();
  if (!model) {
    throw new Error('Modelo Secoes não foi inicializado');
  }
  return new model(...args);
};

Object.setPrototypeOf(SecoesConstructor.prototype, mongoose.Model.prototype);

module.exports = new Proxy(SecoesConstructor, {
  get: (target, prop) => {
    if (prop === Symbol.toStringTag) {
      return 'Secoes';
    }
    
    const model = getModel();
    if (!model) {
      throw new Error('Modelo Secoes não foi inicializado');
    }
    
    if (prop in model || typeof model[prop] !== 'undefined') {
      const value = model[prop];
      if (typeof value === 'function' && prop !== 'constructor') {
        return value.bind(model);
      }
      return value;
    }
    
    return target[prop];
  },
  construct: (target, args) => {
    const model = getModel();
    return new model(...args);
  }
});

