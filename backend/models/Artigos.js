// VERSION: v3.2.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
const { getDatabase } = require('../config/database');

class Artigos {
  constructor() {
    this.collectionName = 'Artigos';
  }

  // Obter coleção
  getCollection() {
    const db = getDatabase();
    return db.collection(this.collectionName);
  }

  // Criar novo artigo
  async create(artigoData) {
    try {
      const collection = this.getCollection();
      const artigo = {
        ...artigoData,
        media: artigoData.media || { images: [], videos: [] },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await collection.insertOne(artigo);
      return {
        success: true,
        data: { ...artigo, _id: result.insertedId },
        message: 'Artigo criado com sucesso'
      };
    } catch (error) {
      console.error('Erro ao criar artigo:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Listar todos os artigos
  async getAll() {
    try {
      const collection = this.getCollection();
      const artigos = await collection.find({}).sort({ createdAt: -1 }).toArray();
      
      return {
        success: true,
        data: artigos,
        count: artigos.length
      };
    } catch (error) {
      console.error('Erro ao listar artigos:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Obter artigo por ID
  async getById(id) {
    try {
      const collection = this.getCollection();
      const { ObjectId } = require('mongodb');
      const artigo = await collection.findOne({ _id: new ObjectId(id) });
      
      if (!artigo) {
        return {
          success: false,
          error: 'Artigo não encontrado'
        };
      }

      return {
        success: true,
        data: artigo
      };
    } catch (error) {
      console.error('Erro ao obter artigo:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Atualizar artigo
  async update(id, updateData) {
    try {
      const collection = this.getCollection();
      const { ObjectId } = require('mongodb');
      
      const updateDoc = {
        ...updateData,
        updatedAt: new Date()
      };
      
      // Incluir campo media se fornecido
      if (updateData.media !== undefined) {
        updateDoc.media = updateData.media;
      }

      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateDoc }
      );

      if (result.matchedCount === 0) {
        return {
          success: false,
          error: 'Artigo não encontrado'
        };
      }

      return {
        success: true,
        message: 'Artigo atualizado com sucesso'
      };
    } catch (error) {
      console.error('Erro ao atualizar artigo:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Deletar artigo
  async delete(id) {
    try {
      const collection = this.getCollection();
      const { ObjectId } = require('mongodb');
      
      const result = await collection.deleteOne({ _id: new ObjectId(id) });

      if (result.deletedCount === 0) {
        return {
          success: false,
          error: 'Artigo não encontrado'
        };
      }

      return {
        success: true,
        message: 'Artigo deletado com sucesso'
      };
    } catch (error) {
      console.error('Erro ao deletar artigo:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Contar artigos
  async count() {
    try {
      const collection = this.getCollection();
      const count = await collection.countDocuments();
      
      return {
        success: true,
        count
      };
    } catch (error) {
      console.error('Erro ao contar artigos:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }
}

module.exports = new Artigos();
