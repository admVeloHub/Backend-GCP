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

// Schema para modulos
const modulosSchema = new mongoose.Schema({
  cursoId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'ID do curso é obrigatório'],
    ref: 'Cursos'
  },
  moduleId: {
    type: String,
    required: [true, 'ID do módulo é obrigatório'],
    trim: true
  },
  moduleNome: {
    type: String,
    required: [true, 'Nome do módulo é obrigatório'],
    trim: true
  },
  moduleOrder: {
    type: Number,
    required: [true, 'Ordem do módulo é obrigatória'],
    min: [1, 'Ordem deve ser maior que zero']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  versionKey: false,
  collection: 'modulos',
  minimize: false
});

// Índices para otimização
modulosSchema.index({ cursoId: 1 });
modulosSchema.index({ moduleOrder: 1 });
modulosSchema.index({ cursoId: 1, moduleOrder: 1 });

// Métodos estáticos do modelo
modulosSchema.statics.createModulo = async function(moduloData) {
  try {
    const modulo = new this(moduloData);
    await modulo.save();
    return {
      success: true,
      data: modulo,
      message: 'Módulo criado com sucesso'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao criar módulo'
    };
  }
};

modulosSchema.statics.getByCursoId = async function(cursoId) {
  try {
    const modulos = await this.find({ cursoId: cursoId }).sort({ moduleOrder: 1 });
    return {
      success: true,
      data: modulos,
      count: modulos.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao buscar módulos por curso'
    };
  }
};

modulosSchema.statics.getById = async function(id) {
  try {
    const modulo = await this.findById(id);
    if (!modulo) {
      return {
        success: false,
        error: 'Módulo não encontrado'
      };
    }
    return {
      success: true,
      data: modulo
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao obter módulo'
    };
  }
};

modulosSchema.statics.updateModulo = async function(id, updateData) {
  try {
    const modulo = await this.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    if (!modulo) {
      return {
        success: false,
        error: 'Módulo não encontrado'
      };
    }
    
    return {
      success: true,
      data: modulo,
      message: 'Módulo atualizado com sucesso'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao atualizar módulo'
    };
  }
};

modulosSchema.statics.deleteModulo = async function(id) {
  try {
    const modulo = await this.findByIdAndDelete(id);
    if (!modulo) {
      return {
        success: false,
        error: 'Módulo não encontrado'
      };
    }
    return {
      success: true,
      message: 'Módulo deletado com sucesso'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao deletar módulo'
    };
  }
};

modulosSchema.statics.deleteByCursoId = async function(cursoId) {
  try {
    const result = await this.deleteMany({ cursoId: cursoId });
    return {
      success: true,
      deletedCount: result.deletedCount,
      message: `${result.deletedCount} módulo(s) deletado(s) com sucesso`
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao deletar módulos por curso'
    };
  }
};

// Modelo - criado com lazy loading
let ModulosModel = null;

const getModel = () => {
  if (!ModulosModel) {
    try {
      const connection = getAcademyConnection();
      
      if (!connection) {
        throw new Error('Conexão MongoDB não foi criada');
      }
      
      ModulosModel = connection.model('Modulos', modulosSchema, 'modulos');
    } catch (error) {
      console.error('❌ Erro ao inicializar modelo Modulos:', error);
      throw error;
    }
  }
  return ModulosModel;
};

const ModulosConstructor = function(...args) {
  const model = getModel();
  if (!model) {
    throw new Error('Modelo Modulos não foi inicializado');
  }
  return new model(...args);
};

Object.setPrototypeOf(ModulosConstructor.prototype, mongoose.Model.prototype);

module.exports = new Proxy(ModulosConstructor, {
  get: (target, prop) => {
    if (prop === Symbol.toStringTag) {
      return 'Modulos';
    }
    
    const model = getModel();
    if (!model) {
      throw new Error('Modelo Modulos não foi inicializado');
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

