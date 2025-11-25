// VERSION: v1.3.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
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

// Schema para course_progress
const courseProgressSchema = new mongoose.Schema({
  userEmail: {
    type: String,
    required: [true, 'Email do usuário é obrigatório'],
    lowercase: true,
    trim: true
  },
  subtitle: {
    type: String,
    required: [true, 'Subtítulo da seção é obrigatório'],
    trim: true
  },
  completedVideos: {
    type: Map,
    of: Boolean,
    default: {}
  },
  quizUnlocked: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  versionKey: false,
  collection: 'course_progress'
});

// Índice composto único: userEmail + subtitle
courseProgressSchema.index({ userEmail: 1, subtitle: 1 }, { unique: true });

// Índices para otimização
courseProgressSchema.index({ userEmail: 1 });
courseProgressSchema.index({ subtitle: 1 });
courseProgressSchema.index({ createdAt: -1 });

// Middleware para atualizar completedAt quando todas as aulas forem completadas
courseProgressSchema.pre('save', function(next) {
  if (this.completedVideos) {
    // Converter Map para Array se necessário
    const videos = this.completedVideos instanceof Map 
      ? Array.from(this.completedVideos.values())
      : Object.values(this.completedVideos || {});
    
    const allCompleted = videos.length > 0 && videos.every(v => v === true);
    
    if (allCompleted && !this.completedAt) {
      this.completedAt = new Date();
      this.quizUnlocked = true;
    } else if (!allCompleted) {
      this.completedAt = null;
      this.quizUnlocked = false;
    }
  }
  next();
});

// Métodos estáticos do modelo
courseProgressSchema.statics.createProgress = async function(progressData) {
  try {
    const progress = new this(progressData);
    await progress.save();
    return {
      success: true,
      data: progress,
      message: 'Progresso criado com sucesso'
    };
  } catch (error) {
    if (error.code === 11000) {
      return {
        success: false,
        error: 'Já existe um registro de progresso para este usuário e subtítulo'
      };
    }
    return {
      success: false,
      error: error.message || 'Erro ao criar progresso'
    };
  }
};

courseProgressSchema.statics.getAll = async function() {
  try {
    const progress = await this.find({}).sort({ createdAt: -1 });
    return {
      success: true,
      data: progress,
      count: progress.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao listar progressos'
    };
  }
};

courseProgressSchema.statics.getById = async function(id) {
  try {
    const progress = await this.findById(id);
    if (!progress) {
      return {
        success: false,
        error: 'Progresso não encontrado'
      };
    }
    return {
      success: true,
      data: progress
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao obter progresso'
    };
  }
};

courseProgressSchema.statics.getByUserEmail = async function(userEmail) {
  try {
    const progress = await this.find({ userEmail: userEmail.toLowerCase() }).sort({ createdAt: -1 });
    return {
      success: true,
      data: progress,
      count: progress.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao buscar progressos do usuário'
    };
  }
};

courseProgressSchema.statics.getByUserAndSubtitle = async function(userEmail, subtitle) {
  try {
    const progress = await this.findOne({ 
      userEmail: userEmail.toLowerCase(), 
      subtitle: subtitle 
    });
    if (!progress) {
      return {
        success: false,
        error: 'Progresso não encontrado'
      };
    }
    return {
      success: true,
      data: progress
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao buscar progresso'
    };
  }
};

courseProgressSchema.statics.updateProgress = async function(id, updateData) {
  try {
    const progress = await this.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    if (!progress) {
      return {
        success: false,
        error: 'Progresso não encontrado'
      };
    }
    return {
      success: true,
      data: progress,
      message: 'Progresso atualizado com sucesso'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao atualizar progresso'
    };
  }
};

courseProgressSchema.statics.deleteProgress = async function(id) {
  try {
    const progress = await this.findByIdAndDelete(id);
    if (!progress) {
      return {
        success: false,
        error: 'Progresso não encontrado'
      };
    }
    return {
      success: true,
      message: 'Progresso deletado com sucesso'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao deletar progresso'
    };
  }
};

// Modelo - criado com lazy loading
let CourseProgressModel = null;

const getModel = () => {
  if (!CourseProgressModel) {
    const connection = getAcademyConnection();
    CourseProgressModel = connection.model('CourseProgress', courseProgressSchema, 'course_progress');
  }
  return CourseProgressModel;
};

module.exports = new Proxy({}, {
  get: (target, prop) => {
    const model = getModel();
    return model[prop];
  }
});

