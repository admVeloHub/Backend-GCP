// VERSION: v1.0.0 | DATE: 2025-02-02 | AUTHOR: VeloHub Development Team
const mongoose = require('mongoose');
const { getMongoUri } = require('../config/mongodb');

// Configurar conexão específica para o database academy_registros
// Lazy loading: conexão criada apenas quando o modelo é usado pela primeira vez
const ACADEMY_REGISTROS_DB_NAME = process.env.ACADEMY_REGISTROS_DB || 'academy_registros';
let academyConnection = null;

// Função para obter conexão (lazy loading)
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

// Schema principal para cursos
const cursosSchema = new mongoose.Schema({
  cursoClasse: {
    type: String,
    required: [true, 'Classe do curso é obrigatória'],
    enum: {
      values: ['Essencial', 'Atualização', 'Opcional', 'Reciclagem'],
      message: 'Classe do curso deve ser: Essencial, Atualização, Opcional ou Reciclagem'
    }
  },
  cursoNome: {
    type: String,
    required: [true, 'Nome do curso é obrigatório'],
    trim: true
  },
  cursoDescription: {
    type: String,
    required: false,
    trim: true,
    default: undefined
  },
  courseOrder: {
    type: Number,
    required: [true, 'Ordem do curso é obrigatória'],
    min: [1, 'Ordem deve ser maior que zero']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: String,
    required: [true, 'Email do criador é obrigatório'],
    lowercase: true,
    trim: true
  },
  version: {
    type: Number,
    default: 1,
    min: [1, 'Versão deve ser maior que zero']
  }
}, {
  timestamps: true,
  versionKey: false,
  collection: 'cursos',
  minimize: false
});

// Índices para otimização
cursosSchema.index({ cursoNome: 1 });
cursosSchema.index({ cursoClasse: 1 });
cursosSchema.index({ isActive: 1 });
cursosSchema.index({ courseOrder: 1 });
cursosSchema.index({ createdAt: -1 });

// Métodos estáticos do modelo
cursosSchema.statics.createCurso = async function(cursoData) {
  try {
    const curso = new this(cursoData);
    await curso.save();
    return {
      success: true,
      data: curso,
      message: 'Curso criado com sucesso'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao criar curso'
    };
  }
};

cursosSchema.statics.getAll = async function() {
  try {
    const cursos = await this.find({}).sort({ courseOrder: 1, createdAt: -1 });
    return {
      success: true,
      data: cursos,
      count: cursos.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao listar cursos'
    };
  }
};

cursosSchema.statics.getById = async function(id) {
  try {
    const curso = await this.findById(id);
    if (!curso) {
      return {
        success: false,
        error: 'Curso não encontrado'
      };
    }
    return {
      success: true,
      data: curso
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao obter curso'
    };
  }
};

cursosSchema.statics.getByCursoNome = async function(cursoNome) {
  try {
    const cursos = await this.find({ cursoNome: cursoNome }).sort({ courseOrder: 1 });
    return {
      success: true,
      data: cursos,
      count: cursos.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao buscar cursos por nome'
    };
  }
};

cursosSchema.statics.getActiveCourses = async function() {
  try {
    const cursos = await this.find({ isActive: true }).sort({ courseOrder: 1, createdAt: -1 });
    return {
      success: true,
      data: cursos,
      count: cursos.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao buscar cursos ativos'
    };
  }
};

cursosSchema.statics.getByCursoClasse = async function(cursoClasse) {
  try {
    const cursos = await this.find({ cursoClasse: cursoClasse }).sort({ courseOrder: 1 });
    return {
      success: true,
      data: cursos,
      count: cursos.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao buscar cursos por classe'
    };
  }
};

cursosSchema.statics.updateCurso = async function(id, updateData) {
  try {
    // Buscar curso atual para obter a versão
    const cursoAtual = await this.findById(id);
    if (!cursoAtual) {
      return {
        success: false,
        error: 'Curso não encontrado'
      };
    }
    
    // Incrementar versão automaticamente
    const novaVersao = (cursoAtual.version || 1) + 1;
    
    const curso = await this.findByIdAndUpdate(
      id,
      { 
        $set: {
          ...updateData,
          version: novaVersao
        }
      },
      { new: true, runValidators: true }
    );
    
    return {
      success: true,
      data: curso,
      message: 'Curso atualizado com sucesso'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao atualizar curso'
    };
  }
};

cursosSchema.statics.deleteCurso = async function(id) {
  try {
    const curso = await this.findByIdAndDelete(id);
    if (!curso) {
      return {
        success: false,
        error: 'Curso não encontrado'
      };
    }
    return {
      success: true,
      message: 'Curso deletado com sucesso'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao deletar curso'
    };
  }
};

// Modelo - criado com lazy loading
let CursosModel = null;

const getModel = () => {
  if (!CursosModel) {
    try {
      const connection = getAcademyConnection();
      
      if (!connection) {
        throw new Error('Conexão MongoDB não foi criada');
      }
      
      CursosModel = connection.model('Cursos', cursosSchema, 'cursos');
    } catch (error) {
      console.error('❌ Erro ao inicializar modelo Cursos:', error);
      throw error;
    }
  }
  return CursosModel;
};

// Criar função construtora que delega para o modelo real
const CursosConstructor = function(...args) {
  const model = getModel();
  if (!model) {
    throw new Error('Modelo Cursos não foi inicializado');
  }
  return new model(...args);
};

// Copiar propriedades estáticas do modelo para o construtor
Object.setPrototypeOf(CursosConstructor.prototype, mongoose.Model.prototype);

module.exports = new Proxy(CursosConstructor, {
  get: (target, prop) => {
    if (prop === Symbol.toStringTag) {
      return 'Cursos';
    }
    
    const model = getModel();
    if (!model) {
      throw new Error('Modelo Cursos não foi inicializado');
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

