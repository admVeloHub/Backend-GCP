// VERSION: v1.0.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
const { getSociaisDatabase } = require('../config/database');

class SociaisMetricas {
  constructor() {
    this.collectionName = 'sociais_metricas';
  }

  // Obter coleção
  getCollection() {
    const db = getSociaisDatabase();
    return db.collection(this.collectionName);
  }

  // Criar nova tabulação
  async create(tabulationData) {
    try {
      const collection = this.getCollection();
      
      // Validar campos obrigatórios
      if (!tabulationData.clientName || !tabulationData.socialNetwork || !tabulationData.messageText) {
        return {
          success: false,
          error: 'Campos obrigatórios: clientName, socialNetwork, messageText'
        };
      }

      // Validar enums
      const validNetworks = ['WhatsApp', 'Instagram', 'Facebook', 'TikTok', 'Messenger', 'YouTube', 'PlayStore'];
      if (!validNetworks.includes(tabulationData.socialNetwork)) {
        return {
          success: false,
          error: `socialNetwork deve ser um dos seguintes: ${validNetworks.join(', ')}`
        };
      }

      const validReasons = ['Comercial', 'Suporte', 'Bug', 'Elogio'];
      if (tabulationData.contactReason && !validReasons.includes(tabulationData.contactReason)) {
        return {
          success: false,
          error: `contactReason deve ser um dos seguintes: ${validReasons.join(', ')}`
        };
      }

      const validSentiments = ['Positivo', 'Neutro', 'Negativo'];
      if (tabulationData.sentiment && !validSentiments.includes(tabulationData.sentiment)) {
        return {
          success: false,
          error: `sentiment deve ser um dos seguintes: ${validSentiments.join(', ')}`
        };
      }

      // Validar rating se PlayStore
      if (tabulationData.socialNetwork === 'PlayStore' && !tabulationData.rating) {
        return {
          success: false,
          error: 'rating é obrigatório para PlayStore'
        };
      }

      if (tabulationData.rating && (tabulationData.rating < 1 || tabulationData.rating > 5)) {
        return {
          success: false,
          error: 'rating deve ser um número entre 1 e 5'
        };
      }

      const tabulation = {
        clientName: tabulationData.clientName,
        socialNetwork: tabulationData.socialNetwork,
        messageText: tabulationData.messageText,
        rating: tabulationData.rating || null,
        contactReason: tabulationData.contactReason || null,
        sentiment: tabulationData.sentiment || null,
        directedCenter: tabulationData.directedCenter !== undefined ? Boolean(tabulationData.directedCenter) : false,
        link: tabulationData.link || null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await collection.insertOne(tabulation);
      return {
        success: true,
        data: { ...tabulation, _id: result.insertedId },
        message: 'Tabulação criada com sucesso'
      };
    } catch (error) {
      console.error('Erro ao criar tabulação:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Listar todas as tabulações com filtros
  async getAll(filters = {}) {
    try {
      const collection = this.getCollection();
      
      // Construir query de filtros
      const query = {};
      
      if (filters.socialNetwork && Array.isArray(filters.socialNetwork) && filters.socialNetwork.length > 0) {
        query.socialNetwork = { $in: filters.socialNetwork };
      }
      
      if (filters.contactReason && Array.isArray(filters.contactReason) && filters.contactReason.length > 0) {
        query.contactReason = { $in: filters.contactReason };
      }
      
      if (filters.sentiment && Array.isArray(filters.sentiment) && filters.sentiment.length > 0) {
        query.sentiment = { $in: filters.sentiment };
      }
      
      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) {
          query.createdAt.$gte = new Date(filters.dateFrom);
        }
        if (filters.dateTo) {
          const dateTo = new Date(filters.dateTo);
          dateTo.setHours(23, 59, 59, 999); // Fim do dia
          query.createdAt.$lte = dateTo;
        }
      }

      const tabulations = await collection.find(query).sort({ createdAt: -1 }).toArray();
      
      return {
        success: true,
        data: tabulations,
        count: tabulations.length
      };
    } catch (error) {
      console.error('Erro ao listar tabulações:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Obter tabulação por ID
  async getById(id) {
    try {
      const collection = this.getCollection();
      const { ObjectId } = require('mongodb');
      const tabulation = await collection.findOne({ _id: new ObjectId(id) });
      
      if (!tabulation) {
        return {
          success: false,
          error: 'Tabulação não encontrada'
        };
      }

      return {
        success: true,
        data: tabulation
      };
    } catch (error) {
      console.error('Erro ao obter tabulação:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Atualizar tabulação
  async update(id, updateData) {
    try {
      const collection = this.getCollection();
      const { ObjectId } = require('mongodb');
      
      // Validar enums se fornecidos
      if (updateData.socialNetwork) {
        const validNetworks = ['WhatsApp', 'Instagram', 'Facebook', 'TikTok', 'Messenger', 'YouTube', 'PlayStore'];
        if (!validNetworks.includes(updateData.socialNetwork)) {
          return {
            success: false,
            error: `socialNetwork deve ser um dos seguintes: ${validNetworks.join(', ')}`
          };
        }
      }

      if (updateData.contactReason) {
        const validReasons = ['Comercial', 'Suporte', 'Bug', 'Elogio'];
        if (!validReasons.includes(updateData.contactReason)) {
          return {
            success: false,
            error: `contactReason deve ser um dos seguintes: ${validReasons.join(', ')}`
          };
        }
      }

      if (updateData.sentiment) {
        const validSentiments = ['Positivo', 'Neutro', 'Negativo'];
        if (!validSentiments.includes(updateData.sentiment)) {
          return {
            success: false,
            error: `sentiment deve ser um dos seguintes: ${validSentiments.join(', ')}`
          };
        }
      }

      const updateDoc = {
        ...updateData,
        updatedAt: new Date()
      };

      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateDoc }
      );

      if (result.matchedCount === 0) {
        return {
          success: false,
          error: 'Tabulação não encontrada'
        };
      }

      return {
        success: true,
        message: 'Tabulação atualizada com sucesso'
      };
    } catch (error) {
      console.error('Erro ao atualizar tabulação:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Deletar tabulação
  async delete(id) {
    try {
      const collection = this.getCollection();
      const { ObjectId } = require('mongodb');
      
      const result = await collection.deleteOne({ _id: new ObjectId(id) });

      if (result.deletedCount === 0) {
        return {
          success: false,
          error: 'Tabulação não encontrada'
        };
      }

      return {
        success: true,
        message: 'Tabulação deletada com sucesso'
      };
    } catch (error) {
      console.error('Erro ao deletar tabulação:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Obter métricas para dashboard
  async getMetrics(filters = {}) {
    try {
      const collection = this.getCollection();
      
      // Construir query de filtros (mesmo padrão do getAll)
      const query = {};
      
      if (filters.socialNetwork && Array.isArray(filters.socialNetwork) && filters.socialNetwork.length > 0) {
        query.socialNetwork = { $in: filters.socialNetwork };
      }
      
      if (filters.contactReason && Array.isArray(filters.contactReason) && filters.contactReason.length > 0) {
        query.contactReason = { $in: filters.contactReason };
      }
      
      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) {
          query.createdAt.$gte = new Date(filters.dateFrom);
        }
        if (filters.dateTo) {
          const dateTo = new Date(filters.dateTo);
          dateTo.setHours(23, 59, 59, 999);
          query.createdAt.$lte = dateTo;
        }
      }

      const total = await collection.countDocuments(query);
      
      // Contar por sentimento
      const positive = await collection.countDocuments({ ...query, sentiment: 'Positivo' });
      const negative = await collection.countDocuments({ ...query, sentiment: 'Negativo' });
      const neutral = await collection.countDocuments({ ...query, sentiment: 'Neutro' });
      
      // Rede mais ativa
      const networkCounts = await collection.aggregate([
        { $match: query },
        { $group: { _id: '$socialNetwork', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 }
      ]).toArray();
      
      const mostActiveNetwork = networkCounts.length > 0 ? networkCounts[0]._id : null;
      
      // Calcular percentual positivo
      const positivePercent = total > 0 ? ((positive / total) * 100).toFixed(1) : 0;

      return {
        success: true,
        data: {
          totalContacts: total,
          positivePercent: parseFloat(positivePercent),
          mostActiveNetwork: mostActiveNetwork,
          sentimentBreakdown: {
            positive,
            negative,
            neutral
          }
        }
      };
    } catch (error) {
      console.error('Erro ao obter métricas:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Obter dados para gráficos
  async getChartData(filters = {}) {
    try {
      const collection = this.getCollection();
      
      // Construir query de filtros
      const query = {};
      
      if (filters.socialNetwork && Array.isArray(filters.socialNetwork) && filters.socialNetwork.length > 0) {
        query.socialNetwork = { $in: filters.socialNetwork };
      }
      
      if (filters.contactReason && Array.isArray(filters.contactReason) && filters.contactReason.length > 0) {
        query.contactReason = { $in: filters.contactReason };
      }
      
      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) {
          query.createdAt.$gte = new Date(filters.dateFrom);
        }
        if (filters.dateTo) {
          const dateTo = new Date(filters.dateTo);
          dateTo.setHours(23, 59, 59, 999);
          query.createdAt.$lte = dateTo;
        }
      }

      // Volume por rede social
      const networkData = await collection.aggregate([
        { $match: query },
        { $group: { _id: '$socialNetwork', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]).toArray();

      // Motivos frequentes
      const reasonData = await collection.aggregate([
        { $match: query },
        { $group: { _id: '$contactReason', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]).toArray();

      return {
        success: true,
        data: {
          networkVolume: networkData.map(item => ({ socialNetwork: item._id, count: item.count })),
          reasonFrequency: reasonData.map(item => ({ reason: item._id, count: item.count }))
        }
      };
    } catch (error) {
      console.error('Erro ao obter dados de gráficos:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Criar índices para performance
  async createIndexes() {
    try {
      const collection = this.getCollection();
      
      await collection.createIndex({ socialNetwork: 1 });
      await collection.createIndex({ createdAt: -1 });
      await collection.createIndex({ sentiment: 1 });
      await collection.createIndex({ contactReason: 1 });
      
      console.log('✅ Índices criados para sociais_metricas');
      return {
        success: true,
        message: 'Índices criados com sucesso'
      };
    } catch (error) {
      console.error('Erro ao criar índices:', error);
      return {
        success: false,
        error: 'Erro ao criar índices'
      };
    }
  }
}

module.exports = new SociaisMetricas();
