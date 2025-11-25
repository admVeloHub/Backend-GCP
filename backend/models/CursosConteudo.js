// VERSION: v1.4.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
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

// Schema para lessonContent (array de objetos com url)
const lessonContentSchema = new mongoose.Schema({
  url: {
    type: String,
    required: [true, 'URL do conteúdo é obrigatória'],
    trim: true
  }
}, { _id: false });

// Schema para lessons
const lessonSchema = new mongoose.Schema({
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
  }
}, { _id: false });

// Schema para sections (Tema/Subtítulo)
const sectionSchema = new mongoose.Schema({
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
  },
  lessons: {
    type: [lessonSchema],
    required: [true, 'Seção deve ter pelo menos uma aula'],
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: 'Seção deve ter pelo menos uma aula'
    }
  }
}, { _id: false });

// Schema para modules
const moduleSchema = new mongoose.Schema({
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
  isActive: {
    type: Boolean,
    default: true
  },
  sections: {
    type: [sectionSchema],
    required: [true, 'Módulo deve ter pelo menos uma seção'],
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: 'Módulo deve ter pelo menos uma seção'
    }
  }
}, { _id: false });

// Schema principal para cursos_conteudo
const cursosConteudoSchema = new mongoose.Schema({
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
  modules: {
    type: [moduleSchema],
    required: [true, 'Curso deve ter pelo menos um módulo'],
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: 'Curso deve ter pelo menos um módulo'
    }
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
  collection: 'cursos_conteudo',
  minimize: false  // Garantir que campos vazios/null sejam salvos
});

// Índices para otimização
cursosConteudoSchema.index({ cursoNome: 1 });
cursosConteudoSchema.index({ cursoClasse: 1 });
cursosConteudoSchema.index({ isActive: 1 });
cursosConteudoSchema.index({ courseOrder: 1 });
cursosConteudoSchema.index({ createdAt: -1 });

// Nota: Incremento de versão é feito manualmente no método updateCurso
// para garantir que sempre obtenhamos a versão atual antes de incrementar

// Métodos estáticos do modelo
cursosConteudoSchema.statics.createCurso = async function(cursoData) {
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

cursosConteudoSchema.statics.getAll = async function() {
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

cursosConteudoSchema.statics.getById = async function(id) {
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

cursosConteudoSchema.statics.getByCursoNome = async function(cursoNome) {
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

cursosConteudoSchema.statics.getActiveCourses = async function() {
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

cursosConteudoSchema.statics.getByCursoClasse = async function(cursoClasse) {
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

cursosConteudoSchema.statics.updateCurso = async function(id, updateData) {
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

cursosConteudoSchema.statics.deleteCurso = async function(id) {
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
let CursosConteudoModel = null;

const getModel = () => {
  if (!CursosConteudoModel) {
    const connection = getAcademyConnection();
    CursosConteudoModel = connection.model('CursosConteudo', cursosConteudoSchema, 'cursos_conteudo');
  }
  return CursosConteudoModel;
};

module.exports = new Proxy({}, {
  get: (target, prop) => {
    const model = getModel();
    return model[prop];
  }
});

