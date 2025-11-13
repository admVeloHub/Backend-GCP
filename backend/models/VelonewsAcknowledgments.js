// VERSION: v1.1.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
const { getDatabase } = require('../config/database');

class VelonewsAcknowledgments {
  constructor() {
    this.collectionName = 'velonews_acknowledgments';
  }

  // Obter coleção
  getCollection() {
    const db = getDatabase();
    return db.collection(this.collectionName);
  }

  // Obter confirmações por ID da notícia
  async getByNewsId(newsId) {
    try {
      const collection = this.getCollection();
      const { ObjectId } = require('mongodb');
      const acknowledgments = await collection.find({ newsId: new ObjectId(newsId) }).sort({ acknowledgedAt: -1 }).toArray();
      
      return {
        success: true,
        data: acknowledgments,
        count: acknowledgments.length
      };
    } catch (error) {
      console.error('Erro ao obter confirmações por newsId:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Obter confirmações por email do usuário
  async getByUserEmail(userEmail) {
    try {
      const collection = this.getCollection();
      const acknowledgments = await collection.find({ userEmail }).sort({ acknowledgedAt: -1 }).toArray();
      
      return {
        success: true,
        data: acknowledgments,
        count: acknowledgments.length
      };
    } catch (error) {
      console.error('Erro ao obter confirmações por email:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Verificar se usuário confirmou notícia específica
  async checkAcknowledgment(newsId, userEmail) {
    try {
      const collection = this.getCollection();
      const { ObjectId } = require('mongodb');
      const acknowledgment = await collection.findOne({ 
        newsId: new ObjectId(newsId), 
        userEmail 
      });
      
      return {
        success: true,
        data: {
          acknowledged: !!acknowledgment,
          acknowledgment: acknowledgment || null
        }
      };
    } catch (error) {
      console.error('Erro ao verificar confirmação:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Obter estatísticas de confirmações
  async getStats() {
    try {
      const collection = this.getCollection();
      const totalAcknowledgments = await collection.countDocuments();
      
      // Agrupar por newsId para ver quantas notícias foram confirmadas
      const newsStats = await collection.aggregate([
        {
          $group: {
            _id: '$newsId',
            count: { $sum: 1 },
            firstAcknowledgment: { $min: '$acknowledgedAt' },
            lastAcknowledgment: { $max: '$acknowledgedAt' }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]).toArray();
      
      // Agrupar por usuário para ver quantas confirmações cada usuário fez
      const userStats = await collection.aggregate([
        {
          $group: {
            _id: '$userEmail',
            count: { $sum: 1 },
            firstAcknowledgment: { $min: '$acknowledgedAt' },
            lastAcknowledgment: { $max: '$acknowledgedAt' }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]).toArray();
      
      return {
        success: true,
        data: {
          totalAcknowledgments,
          uniqueNews: newsStats.length,
          uniqueUsers: userStats.length,
          newsStats,
          userStats
        }
      };
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Obter confirmações recentes
  async getRecent(limit = 50) {
    try {
      const collection = this.getCollection();
      const recent = await collection.find({}).sort({ acknowledgedAt: -1 }).limit(limit).toArray();
      
      return {
        success: true,
        data: recent,
        count: recent.length
      };
    } catch (error) {
      console.error('Erro ao obter confirmações recentes:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Contar confirmações
  async count() {
    try {
      const collection = this.getCollection();
      const count = await collection.countDocuments();
      
      return {
        success: true,
        count
      };
    } catch (error) {
      console.error('Erro ao contar confirmações:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Obter todas as confirmações
  async getAll() {
    try {
      const collection = this.getCollection();
      const acknowledgments = await collection.find({}).sort({ acknowledgedAt: -1 }).toArray();
      
      return {
        success: true,
        data: acknowledgments,
        count: acknowledgments.length
      };
    } catch (error) {
      console.error('Erro ao obter todas as confirmações:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }
}

module.exports = new VelonewsAcknowledgments();
