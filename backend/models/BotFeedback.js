// VERSION: v1.2.0 | DATE: 2025-11-26 | AUTHOR: VeloHub Development Team
const mongoose = require('mongoose');

const botFeedbackSchema = new mongoose.Schema({
  colaboradorNome: {
    type: String,
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    index: true
  },
  messageId: {
    type: String,
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    index: true,
    default: null
  },
  source: {
    type: String,
    required: true,
    index: true
  },
  resolvido: {
    type: Boolean,
    default: false,
    index: true
  },
  details: {
    feedbackType: {
      type: String,
      required: true,
      index: true
    },
    comment: {
      type: String,
      default: ''
    },
    question: {
      type: String,
      default: ''
    },
    answer: {
      type: String,
      default: ''
    },
    aiProvider: {
      type: String,
      default: null
    },
    responseSource: {
      type: String,
      default: ''
    }
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'bot_feedback'
});

// Índices para performance
botFeedbackSchema.index({ colaboradorNome: 1, createdAt: -1 });
botFeedbackSchema.index({ 'details.feedbackType': 1, createdAt: -1 });
botFeedbackSchema.index({ action: 1, createdAt: -1 });
botFeedbackSchema.index({ sessionId: 1, createdAt: -1 });

// Métodos estáticos para consultas otimizadas
botFeedbackSchema.statics.getFeedbackMetrics = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: '$details.feedbackType',
        count: { $sum: 1 },
        colaboradores: { $addToSet: '$colaboradorNome' }
      }
    },
    {
      $project: {
        _id: 0,
        feedbackType: '$_id',
        count: 1,
        colaboradores: { $size: '$colaboradores' }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
};

botFeedbackSchema.statics.getFeedbackByPeriod = function(startDate, endDate, groupBy = 'day') {
  let groupFormat;
  
  switch (groupBy) {
    case 'day':
      groupFormat = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' }
      };
      break;
    case 'week':
      groupFormat = {
        year: { $year: '$createdAt' },
        week: { $week: '$createdAt' }
      };
      break;
    case 'month':
      groupFormat = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' }
      };
      break;
    default:
      groupFormat = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' }
      };
  }

  return this.aggregate([
    {
      $match: {
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: groupFormat,
        positive: {
          $sum: {
            $cond: [{ $eq: ['$details.feedbackType', 'positive'] }, 1, 0]
          }
        },
        negative: {
          $sum: {
            $cond: [{ $eq: ['$details.feedbackType', 'negative'] }, 1, 0]
          }
        },
        neutral: {
          $sum: {
            $cond: [{ $eq: ['$details.feedbackType', 'neutral'] }, 1, 0]
          }
        },
        total: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
    }
  ]);
};

botFeedbackSchema.statics.getTopColaboradores = function(startDate, endDate, limit = 10) {
  return this.aggregate([
    {
      $match: {
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: '$colaboradorNome',
        totalFeedbacks: { $sum: 1 },
        positiveFeedbacks: {
          $sum: {
            $cond: [{ $eq: ['$details.feedbackType', 'positive'] }, 1, 0]
          }
        },
        negativeFeedbacks: {
          $sum: {
            $cond: [{ $eq: ['$details.feedbackType', 'negative'] }, 1, 0]
          }
        }
      }
    },
    {
      $addFields: {
        satisfactionRate: {
          $cond: [
            { $gt: ['$totalFeedbacks', 0] },
            {
              $multiply: [
                { $divide: ['$positiveFeedbacks', '$totalFeedbacks'] },
                100
              ]
            },
            0
          ]
        }
      }
    },
    {
      $sort: { satisfactionRate: -1, totalFeedbacks: -1 }
    },
    {
      $limit: limit
    }
  ]);
};

botFeedbackSchema.statics.getRecentFeedbacks = function(startDate, endDate, limit = 20) {
  return this.find({
    createdAt: {
      $gte: startDate,
      $lte: endDate
    }
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .select('colaboradorNome action details.feedbackType details.comment createdAt')
  .lean();
};

// Métodos CRUD
botFeedbackSchema.statics.getAll = async function() {
  try {
    const feedbacks = await this.find({}).sort({ createdAt: -1 }).lean();
    return {
      success: true,
      data: feedbacks,
      count: feedbacks.length
    };
  } catch (error) {
    console.error('Erro ao listar todos os feedbacks:', error);
    return {
      success: false,
      error: 'Erro interno do servidor'
    };
  }
};

botFeedbackSchema.statics.getById = async function(id) {
  try {
    const feedback = await this.findById(id).lean();
    if (!feedback) {
      return {
        success: false,
        error: 'Feedback não encontrado'
      };
    }
    return {
      success: true,
      data: feedback
    };
  } catch (error) {
    console.error('Erro ao obter feedback por ID:', error);
    return {
      success: false,
      error: 'Erro interno do servidor'
    };
  }
};

botFeedbackSchema.statics.create = async function(feedbackData) {
  try {
    const feedback = new this({
      colaboradorNome: feedbackData.colaboradorNome,
      action: feedbackData.action || 'feedback_given',
      messageId: feedbackData.messageId,
      sessionId: feedbackData.sessionId || null,
      source: feedbackData.source,
      resolvido: feedbackData.resolvido || false,
      details: {
        feedbackType: feedbackData.details?.feedbackType,
        comment: feedbackData.details?.comment || '',
        question: feedbackData.details?.question || '',
        answer: feedbackData.details?.answer || '',
        aiProvider: feedbackData.details?.aiProvider || null,
        responseSource: feedbackData.details?.responseSource || ''
      }
    });
    
    const savedFeedback = await feedback.save();
    return {
      success: true,
      data: savedFeedback,
      message: 'Feedback criado com sucesso'
    };
  } catch (error) {
    console.error('Erro ao criar feedback:', error);
    return {
      success: false,
      error: 'Erro interno do servidor'
    };
  }
};

botFeedbackSchema.statics.update = async function(id, updateData) {
  try {
    const feedback = await this.findById(id);
    if (!feedback) {
      return {
        success: false,
        error: 'Feedback não encontrado'
      };
    }
    
    if (updateData.colaboradorNome !== undefined) feedback.colaboradorNome = updateData.colaboradorNome;
    if (updateData.action !== undefined) feedback.action = updateData.action;
    if (updateData.messageId !== undefined) feedback.messageId = updateData.messageId;
    if (updateData.sessionId !== undefined) feedback.sessionId = updateData.sessionId;
    if (updateData.source !== undefined) feedback.source = updateData.source;
    if (updateData.resolvido !== undefined) feedback.resolvido = updateData.resolvido;
    
    if (updateData.details !== undefined) {
      if (updateData.details.feedbackType !== undefined) feedback.details.feedbackType = updateData.details.feedbackType;
      if (updateData.details.comment !== undefined) feedback.details.comment = updateData.details.comment;
      if (updateData.details.question !== undefined) feedback.details.question = updateData.details.question;
      if (updateData.details.answer !== undefined) feedback.details.answer = updateData.details.answer;
      if (updateData.details.aiProvider !== undefined) feedback.details.aiProvider = updateData.details.aiProvider;
      if (updateData.details.responseSource !== undefined) feedback.details.responseSource = updateData.details.responseSource;
    }
    
    feedback.updatedAt = new Date();
    const updatedFeedback = await feedback.save();
    
    return {
      success: true,
      data: updatedFeedback.toObject(),
      message: 'Feedback atualizado com sucesso'
    };
  } catch (error) {
    console.error('Erro ao atualizar feedback:', error);
    return {
      success: false,
      error: 'Erro interno do servidor'
    };
  }
};

botFeedbackSchema.statics.delete = async function(id) {
  try {
    const feedback = await this.findByIdAndDelete(id).lean();
    if (!feedback) {
      return {
        success: false,
        error: 'Feedback não encontrado'
      };
    }
    return {
      success: true,
      data: feedback,
      message: 'Feedback deletado com sucesso'
    };
  } catch (error) {
    console.error('Erro ao deletar feedback:', error);
    return {
      success: false,
      error: 'Erro interno do servidor'
    };
  }
};

const BotFeedback = mongoose.model('BotFeedback', botFeedbackSchema);

module.exports = BotFeedback;
