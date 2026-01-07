// VERSION: v3.4.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
const { getDatabase } = require('../config/database');

class Velonews {
  constructor() {
    this.collectionName = 'Velonews';
  }

  // Obter coleção
  getCollection() {
    const db = getDatabase();
    return db.collection(this.collectionName);
  }

  // Criar nova velonews
  async create(velonewsData) {
    try {
      const collection = this.getCollection();
      const velonews = {
        titulo: velonewsData.titulo,
        conteudo: velonewsData.conteudo,
        isCritical: velonewsData.isCritical || false,
        solved: velonewsData.solved || false,
        media: velonewsData.media || { images: [], videos: [] },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await collection.insertOne(velonews);
      return {
        success: true,
        data: { ...velonews, _id: result.insertedId },
        message: 'Velonews publicada com sucesso'
      };
    } catch (error) {
      console.error('Erro ao criar velonews:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Listar todas as velonews
  async getAll() {
    try {
      const collection = this.getCollection();
      const velonews = await collection.find({}).sort({ createdAt: -1 }).toArray();
      
      return {
        success: true,
        data: velonews,
        count: velonews.length
      };
    } catch (error) {
      console.error('Erro ao listar velonews:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Obter velonews por ID
  async getById(id) {
    try {
      const collection = this.getCollection();
      const { ObjectId } = require('mongodb');
      const velonews = await collection.findOne({ _id: new ObjectId(id) });
      
      if (!velonews) {
        return {
          success: false,
          error: 'Velonews não encontrada'
        };
      }

      return {
        success: true,
        data: velonews
      };
    } catch (error) {
      console.error('Erro ao obter velonews:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Atualizar velonews
  async update(id, updateData) {
    try {
      const collection = this.getCollection();
      const { ObjectId } = require('mongodb');
      
      const updateDoc = {
        updatedAt: new Date()
      };
      
      // Incluir apenas campos que foram fornecidos
      if (updateData.titulo !== undefined) updateDoc.titulo = updateData.titulo;
      if (updateData.conteudo !== undefined) updateDoc.conteudo = updateData.conteudo;
      if (updateData.isCritical !== undefined) updateDoc.isCritical = updateData.isCritical;
      if (updateData.solved !== undefined) updateDoc.solved = updateData.solved;
      if (updateData.media !== undefined) updateDoc.media = updateData.media;

      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateDoc }
      );

      if (result.matchedCount === 0) {
        return {
          success: false,
          error: 'Velonews não encontrada'
        };
      }

      return {
        success: true,
        message: 'Velonews atualizada com sucesso'
      };
    } catch (error) {
      console.error('Erro ao atualizar velonews:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Deletar velonews
  async delete(id) {
    try {
      // #region agent log
      const fs = require('fs');
      const logPath = 'c:\\DEV - Ecosistema Velohub\\EXP- Console GCP\\.cursor\\debug.log';
      const logEntry = JSON.stringify({location:'Velonews.js:136',message:'Velonews.delete - ID recebido antes de converter ObjectId',data:{id:id,idType:typeof id,idLength:id?.length,isValidFormat:/^[0-9a-fA-F]{24}$/.test(id)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'}) + '\n';
      fs.appendFileSync(logPath, logEntry);
      // #endregion
      
      const collection = this.getCollection();
      const { ObjectId } = require('mongodb');
      
      // #region agent log
      let objectIdConverted = null;
      try {
        objectIdConverted = new ObjectId(id);
        const logEntry2 = JSON.stringify({location:'Velonews.js:139',message:'Velonews.delete - ObjectId convertido com sucesso',data:{id:id,objectIdString:objectIdConverted.toString()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'}) + '\n';
        fs.appendFileSync(logPath, logEntry2);
      } catch (objIdError) {
        const logEntry3 = JSON.stringify({location:'Velonews.js:139',message:'Velonews.delete - ERRO ao converter ObjectId',data:{id:id,error:objIdError.message,errorStack:objIdError.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'}) + '\n';
        fs.appendFileSync(logPath, logEntry3);
        throw objIdError;
      }
      // #endregion
      
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      
      // #region agent log
      const logEntry4 = JSON.stringify({location:'Velonews.js:140',message:'Velonews.delete - Resultado do deleteOne',data:{deletedCount:result.deletedCount,matchedCount:result.matchedCount,acknowledged:result.acknowledged},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'}) + '\n';
      fs.appendFileSync(logPath, logEntry4);
      // #endregion

      if (result.deletedCount === 0) {
        return {
          success: false,
          error: 'Velonews não encontrada'
        };
      }

      return {
        success: true,
        message: 'Velonews deletada com sucesso'
      };
    } catch (error) {
      // #region agent log
      const fs = require('fs');
      const logPath = 'c:\\DEV - Ecosistema Velohub\\EXP- Console GCP\\.cursor\\debug.log';
      const logEntry = JSON.stringify({location:'Velonews.js:153',message:'Velonews.delete - ERRO capturado no catch',data:{id:id,errorMessage:error.message,errorName:error.name,errorStack:error.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'}) + '\n';
      fs.appendFileSync(logPath, logEntry);
      // #endregion
      console.error('Erro ao deletar velonews:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Contar velonews
  async count() {
    try {
      const collection = this.getCollection();
      const count = await collection.countDocuments();
      
      return {
        success: true,
        count
      };
    } catch (error) {
      console.error('Erro ao contar velonews:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Obter velonews críticas
  async getCritical() {
    try {
      const collection = this.getCollection();
      const criticalVelonews = await collection.find({ isCritical: true }).sort({ createdAt: -1 }).toArray();
      
      return {
        success: true,
        data: criticalVelonews,
        count: criticalVelonews.length
      };
    } catch (error) {
      console.error('Erro ao obter velonews críticas:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }
}

module.exports = new Velonews();
