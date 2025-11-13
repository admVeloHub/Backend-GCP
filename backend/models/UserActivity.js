// VERSION: v1.1.1 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team
const mongoose = require('mongoose');

const userActivitySchema = new mongoose.Schema({
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
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
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
  }
}, {
  timestamps: true,
  collection: 'user_activity'
});

// Índices para performance
userActivitySchema.index({ colaboradorNome: 1, createdAt: -1 });
userActivitySchema.index({ action: 1, createdAt: -1 });
userActivitySchema.index({ source: 1, createdAt: -1 });
userActivitySchema.index({ sessionId: 1, createdAt: -1 });

// Métodos estáticos para consultas otimizadas
userActivitySchema.statics.getMetricsByPeriod = function(period, startDate, endDate) {
  const matchStage = {
    createdAt: {
      $gte: startDate,
      $lte: endDate
    }
  };

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalActivities: { $sum: 1 },
        uniqueUsers: { $addToSet: '$colaboradorNome' },
        uniqueSessions: { $addToSet: '$sessionId' },
        actions: { $push: '$action' },
        sources: { $push: '$source' }
      }
    },
    {
      $project: {
        _id: 0,
        totalActivities: 1,
        uniqueUsers: { $size: '$uniqueUsers' },
        uniqueSessions: { $size: '$uniqueSessions' },
        actions: 1,
        sources: 1
      }
    }
  ]);
};

userActivitySchema.statics.getHourlyDistribution = function(startDate, endDate) {
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
        _id: { $hour: '$createdAt' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: 1
    }
  ]);
};

userActivitySchema.statics.getTopActions = function(startDate, endDate, limit = 10) {
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
        _id: '$action',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: limit
    }
  ]);
};

userActivitySchema.statics.getRecentActivities = function(startDate, endDate, limit = 20) {
  return this.find({
    createdAt: {
      $gte: startDate,
      $lte: endDate
    }
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .select('colaboradorNome action createdAt source details')
  .lean();
};

const UserActivity = mongoose.model('UserActivity', userActivitySchema);

module.exports = UserActivity;
