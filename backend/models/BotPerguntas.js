// VERSION: v3.5.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
const { getDatabase } = require('../config/database');

class BotPerguntas {
  constructor() {
    this.collectionName = 'Bot_perguntas';
  }

  // Obter coleção
  getCollection() {
    const db = getDatabase();
    return db.collection(this.collectionName);
  }

  // Criar nova pergunta do bot
  async create(perguntaData) {
    try {
      const collection = this.getCollection();
      const pergunta = {
        pergunta: perguntaData.pergunta,
        resposta: perguntaData.resposta,
        palavrasChave: perguntaData.palavrasChave,
        sinonimos: perguntaData.sinonimos || '',
        tabulacao: perguntaData.tabulacao || '',
        media: perguntaData.media || { images: [], videos: [] },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await collection.insertOne(pergunta);
      return {
        success: true,
        data: { ...pergunta, _id: result.insertedId },
        message: 'Pergunta do bot configurada com sucesso'
      };
    } catch (error) {
      console.error('Erro ao criar pergunta do bot:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Listar todas as perguntas
  async getAll() {
    try {
      const collection = this.getCollection();
      const perguntas = await collection.find({}).sort({ createdAt: -1 }).toArray();
      
      return {
        success: true,
        data: perguntas,
        count: perguntas.length
      };
    } catch (error) {
      console.error('Erro ao listar perguntas:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Obter pergunta por ID
  async getById(id) {
    try {
      const collection = this.getCollection();
      const { ObjectId } = require('mongodb');
      const pergunta = await collection.findOne({ _id: new ObjectId(id) });
      
      if (!pergunta) {
        return {
          success: false,
          error: 'Pergunta não encontrada'
        };
      }

      return {
        success: true,
        data: pergunta
      };
    } catch (error) {
      console.error('Erro ao obter pergunta:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Atualizar pergunta
  async update(id, updateData) {
    try {
      const collection = this.getCollection();
      const { ObjectId } = require('mongodb');
      
      const updateDoc = {
        updatedAt: new Date()
      };

      // Mapear campos do schema padrão
      if (updateData.pergunta) updateDoc.pergunta = updateData.pergunta;
      if (updateData.resposta) updateDoc.resposta = updateData.resposta;
      if (updateData.palavrasChave) updateDoc.palavrasChave = updateData.palavrasChave;
      if (updateData.sinonimos !== undefined) updateDoc.sinonimos = updateData.sinonimos;
      if (updateData.tabulacao !== undefined) updateDoc.tabulacao = updateData.tabulacao;
      if (updateData.media !== undefined) updateDoc.media = updateData.media;

      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateDoc }
      );

      if (result.matchedCount === 0) {
        return {
          success: false,
          error: 'Pergunta não encontrada'
        };
      }

      return {
        success: true,
        message: 'Pergunta atualizada com sucesso'
      };
    } catch (error) {
      console.error('Erro ao atualizar pergunta:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Deletar pergunta
  async delete(id) {
    try {
      const collection = this.getCollection();
      const { ObjectId } = require('mongodb');
      
      const result = await collection.deleteOne({ _id: new ObjectId(id) });

      if (result.deletedCount === 0) {
        return {
          success: false,
          error: 'Pergunta não encontrada'
        };
      }

      return {
        success: true,
        message: 'Pergunta deletada com sucesso'
      };
    } catch (error) {
      console.error('Erro ao deletar pergunta:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Contar perguntas
  async count() {
    try {
      const collection = this.getCollection();
      const count = await collection.countDocuments();
      
      return {
        success: true,
        count
      };
    } catch (error) {
      console.error('Erro ao contar perguntas:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Buscar por pergunta
  async getByPergunta(pergunta) {
    try {
      const collection = this.getCollection();
      const perguntas = await collection.find({ pergunta: { $regex: pergunta, $options: 'i' } }).sort({ createdAt: -1 }).toArray();
      
      return {
        success: true,
        data: perguntas,
        count: perguntas.length
      };
    } catch (error) {
      console.error('Erro ao buscar perguntas:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }
}

module.exports = new BotPerguntas();
