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

// Schema para lessonContent (array de objetos com url)
const lessonContentSchema = new mongoose.Schema({
  url: {
    type: String,
    required: [true, 'URL do conteúdo é obrigatória'],
    trim: true
  }
}, { _id: false });

// Schema para aulas
const aulasSchema = new mongoose.Schema({
  secaoId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'ID da seção é obrigatório'],
    ref: 'Secoes'
  },
  lessonId: {
    type: String,
    required: [true, 'ID da aula é obrigatório'],
    trim: true
  },
  lessonTipo: {
    type: String,
    required: [true, 'Tipo da aula é obrigatório'],
    enum: {
      values: ['video', 'pdf', 'audio', 'slide', 'document'],
      message: 'Tipo de aula deve ser: video, pdf, audio, slide ou document'
    }
  },
  lessonTitulo: {
    type: String,
    required: [true, 'Título da aula é obrigatório'],
    trim: true
  },
  lessonOrdem: {
    type: Number,
    required: [true, 'Ordem da aula é obrigatória'],
    min: [1, 'Ordem deve ser maior que zero']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lessonContent: {
    type: [lessonContentSchema],
    required: [true, 'Conteúdo da aula é obrigatório'],
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: 'Aula deve ter pelo menos um conteúdo'
    }
  },
  driveId: {
    type: String,
    default: null,
    trim: true
  },
  youtubeId: {
    type: String,
    default: null,
    trim: true
  },
  duration: {
    type: String,
    default: null,
    trim: true
  }
}, {
  timestamps: true,
  versionKey: false,
  collection: 'aulas',
  minimize: false
});

// Índices para otimização
aulasSchema.index({ secaoId: 1 });
aulasSchema.index({ lessonOrdem: 1 });
aulasSchema.index({ secaoId: 1, lessonOrdem: 1 });

// Métodos estáticos do modelo
aulasSchema.statics.createAula = async function(aulaData) {
  try {
    const aula = new this(aulaData);
    await aula.save();
    return {
      success: true,
      data: aula,
      message: 'Aula criada com sucesso'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao criar aula'
    };
  }
};

aulasSchema.statics.getBySecaoId = async function(secaoId) {
  try {
    const aulas = await this.find({ secaoId: secaoId }).sort({ lessonOrdem: 1 });
    return {
      success: true,
      data: aulas,
      count: aulas.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao buscar aulas por seção'
    };
  }
};

aulasSchema.statics.getById = async function(id) {
  try {
    const aula = await this.findById(id);
    if (!aula) {
      return {
        success: false,
        error: 'Aula não encontrada'
      };
    }
    return {
      success: true,
      data: aula
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao obter aula'
    };
  }
};

aulasSchema.statics.updateAula = async function(id, updateData) {
  try {
    const aula = await this.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    if (!aula) {
      return {
        success: false,
        error: 'Aula não encontrada'
      };
    }
    
    return {
      success: true,
      data: aula,
      message: 'Aula atualizada com sucesso'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao atualizar aula'
    };
  }
};

aulasSchema.statics.deleteAula = async function(id) {
  try {
    const aula = await this.findByIdAndDelete(id);
    if (!aula) {
      return {
        success: false,
        error: 'Aula não encontrada'
      };
    }
    return {
      success: true,
      message: 'Aula deletada com sucesso'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao deletar aula'
    };
  }
};

aulasSchema.statics.deleteBySecaoId = async function(secaoId) {
  try {
    const result = await this.deleteMany({ secaoId: secaoId });
    return {
      success: true,
      deletedCount: result.deletedCount,
      message: `${result.deletedCount} aula(s) deletada(s) com sucesso`
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao deletar aulas por seção'
    };
  }
};

// Modelo - criado com lazy loading
let AulasModel = null;

const getModel = () => {
  if (!AulasModel) {
    try {
      const connection = getAcademyConnection();
      
      if (!connection) {
        throw new Error('Conexão MongoDB não foi criada');
      }
      
      AulasModel = connection.model('Aulas', aulasSchema, 'aulas');
    } catch (error) {
      console.error('❌ Erro ao inicializar modelo Aulas:', error);
      throw error;
    }
  }
  return AulasModel;
};

const AulasConstructor = function(...args) {
  const model = getModel();
  if (!model) {
    throw new Error('Modelo Aulas não foi inicializado');
  }
  return new model(...args);
};

Object.setPrototypeOf(AulasConstructor.prototype, mongoose.Model.prototype);

module.exports = new Proxy(AulasConstructor, {
  get: (target, prop) => {
    if (prop === Symbol.toStringTag) {
      return 'Aulas';
    }
    
    const model = getModel();
    if (!model) {
      throw new Error('Modelo Aulas não foi inicializado');
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

