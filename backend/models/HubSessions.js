// VERSION: v1.2.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
const { getDatabase } = require('../config/database');

/**
 * Schema: console_conteudo.hub_sessions
 * {
 *   _id: ObjectId,
 *   colaboradorNome: String,           // Nome do colaborador
 *   userEmail: String,                 // Email do usuário
 *   sessionId: String,                 // ID único da sessão (UUID)
 *   ipAddress: String,                 // IP do usuário (opcional)
 *   userAgent: String,                 // Navegador/dispositivo (opcional)
 *   isActive: Boolean,                 // Se a sessão está ativa
 *   loginTimestamp: Date,              // Data/hora do login
 *   logoutTimestamp: Date,             // Data/hora do logout (null se ativo)
 *   createdAt: Date,                  // Data de criação
 *   updatedAt: Date                    // Data de atualização
 * }
 */
class HubSessions {
  constructor() {
    this.collectionName = 'hub_sessions';
  }

  // Obter coleção
  getCollection() {
    const db = getDatabase();
    return db.collection(this.collectionName);
  }

  // Obter sessões por email do usuário
  async getByUserEmail(userEmail) {
    try {
      const collection = this.getCollection();
      const sessions = await collection.find({ userEmail }).sort({ createdAt: -1 }).toArray();
      
      return {
        success: true,
        data: sessions,
        count: sessions.length
      };
    } catch (error) {
      console.error('Erro ao obter sessões por email:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Obter sessões ativas
  async getActiveSessions() {
    try {
      const collection = this.getCollection();
      const activeSessions = await collection.find({ isActive: true }).sort({ loginTimestamp: -1 }).toArray();
      
      return {
        success: true,
        data: activeSessions,
        count: activeSessions.length
      };
    } catch (error) {
      console.error('Erro ao obter sessões ativas:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Obter sessão por ID
  async getBySessionId(sessionId) {
    try {
      const collection = this.getCollection();
      const session = await collection.findOne({ sessionId });
      
      if (!session) {
        return {
          success: false,
          error: 'Sessão não encontrada'
        };
      }

      return {
        success: true,
        data: session
      };
    } catch (error) {
      console.error('Erro ao obter sessão por ID:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Obter histórico completo de sessões com abertura/fechamento
  async getSessionHistory(userEmail) {
    try {
      const collection = this.getCollection();
      const sessions = await collection.find({ userEmail }).sort({ loginTimestamp: -1 }).toArray();
      
      // Processar histórico para mostrar abertura/fechamento
      const history = sessions.map(session => ({
        ...session,
        duration: session.logoutTimestamp 
          ? Math.round((new Date(session.logoutTimestamp) - new Date(session.loginTimestamp)) / 1000 / 60) // em minutos
          : null,
        status: session.isActive ? 'Ativa' : 'Finalizada'
      }));
      
      return {
        success: true,
        data: history,
        count: history.length,
        summary: {
          totalSessions: history.length,
          activeSessions: history.filter(s => s.isActive).length,
          completedSessions: history.filter(s => !s.isActive).length,
          averageDuration: history.filter(s => s.duration !== null).length > 0
            ? Math.round(history.filter(s => s.duration !== null).reduce((sum, s) => sum + s.duration, 0) / history.filter(s => s.duration !== null).length)
            : 0
        }
      };
    } catch (error) {
      console.error('Erro ao obter histórico de sessões:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Contar sessões
  async count() {
    try {
      const collection = this.getCollection();
      const count = await collection.countDocuments();
      
      return {
        success: true,
        count
      };
    } catch (error) {
      console.error('Erro ao contar sessões:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Obter estatísticas gerais
  async getStats() {
    try {
      const collection = this.getCollection();
      const totalSessions = await collection.countDocuments();
      const activeSessions = await collection.countDocuments({ isActive: true });
      const completedSessions = await collection.countDocuments({ isActive: false });
      
      // Obter usuários únicos
      const uniqueUsers = await collection.distinct('userEmail');
      
      return {
        success: true,
        data: {
          totalSessions,
          activeSessions,
          completedSessions,
          uniqueUsers: uniqueUsers.length,
          users: uniqueUsers
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

  // Obter todas as sessões
  async getAll() {
    try {
      const collection = this.getCollection();
      const sessions = await collection.find({}).sort({ createdAt: -1 }).toArray();
      
      return {
        success: true,
        data: sessions,
        count: sessions.length
      };
    } catch (error) {
      console.error('Erro ao obter todas as sessões:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }
}

module.exports = new HubSessions();
