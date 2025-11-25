// VERSION: v1.3.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
const { getDatabase } = require('../config/database');

class TkGestao {
  constructor() {
    this.collectionName = 'tk_gestão';
    this.dbName = process.env.CONSOLE_CHAMADOS_DB || 'console_chamados';
  }

  // Obter coleção do banco console_chamados
  async getCollection() {
    const { MongoClient } = require('mongodb');
    const { getMongoUri } = require('../config/mongodb');
    // MONGO_ENV deve ser configurada via variável de ambiente (secrets)
    const MONGODB_URI = getMongoUri();
    
    // Conectar ao banco específico console_chamados
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(this.dbName);
    return db.collection(this.collectionName);
  }

  // Listar todos os gestões
  async getAll() {
    try {
      const collection = await this.getCollection();
      const gestoes = await collection.find({}).sort({ createdAt: -1 }).toArray();
      
      return {
        success: true,
        data: gestoes,
        count: gestoes.length
      };
    } catch (error) {
      console.error('Erro ao listar tk_gestão:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Obter gestão por ID
  async getById(id) {
    try {
      const collection = await this.getCollection();
      const gestao = await collection.findOne({ _id: id });
      
      if (!gestao) {
        return {
          success: false,
          error: 'Gestão não encontrada'
        };
      }

      return {
        success: true,
        data: gestao
      };
    } catch (error) {
      console.error('Erro ao obter tk_gestão:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Buscar por gênero
  async getByGenero(genero) {
    try {
      const collection = await this.getCollection();
      const gestoes = await collection.find({ _genero: genero }).sort({ createdAt: -1 }).toArray();
      
      return {
        success: true,
        data: gestoes,
        count: gestoes.length
      };
    } catch (error) {
      console.error('Erro ao buscar tk_gestão por gênero:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Buscar por tipo
  async getByTipo(tipo) {
    try {
      const collection = await this.getCollection();
      const gestoes = await collection.find({ _tipo: tipo }).sort({ createdAt: -1 }).toArray();
      
      return {
        success: true,
        data: gestoes,
        count: gestoes.length
      };
    } catch (error) {
      console.error('Erro ao buscar tk_gestão por tipo:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Buscar por direcionamento
  async getByDirecionamento(direcionamento) {
    try {
      const collection = await this.getCollection();
      const gestoes = await collection.find({ _direcionamento: direcionamento }).sort({ createdAt: -1 }).toArray();
      
      return {
        success: true,
        data: gestoes,
        count: gestoes.length
      };
    } catch (error) {
      console.error('Erro ao buscar tk_gestão por direcionamento:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Contar gestões
  async count() {
    try {
      const collection = await this.getCollection();
      const count = await collection.countDocuments();
      
      return {
        success: true,
        count
      };
    } catch (error) {
      console.error('Erro ao contar tk_gestão:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Gerar próximo ID personalizado TKG-XXXXXX
  async getNextId() {
    try {
      const collection = await this.getCollection();
      
      // Buscar último documento ordenado por _id DESC
      const lastDoc = await collection.findOne({}, { sort: { _id: -1 } });
      
      if (!lastDoc) {
        // Se collection vazia, iniciar com TKG-000001
        return 'TKG-000001';
      }
      
      // Extrair número do último _id (ex: TKG-000123 → 123)
      const lastId = lastDoc._id;
      const match = lastId.match(/TKG-(\d+)/);
      
      if (!match) {
        throw new Error('Formato de ID inválido encontrado');
      }
      
      const lastNumber = parseInt(match[1], 10);
      const nextNumber = lastNumber + 1;
      
      // Formatar com padding de 6 dígitos
      return `TKG-${nextNumber.toString().padStart(6, '0')}`;
    } catch (error) {
      console.error('Erro ao gerar próximo ID TKG:', error);
      throw new Error('Erro ao gerar ID do ticket');
    }
  }

  // Criar nova gestão
  async create(gestaoData) {
    try {
      const collection = await this.getCollection();
      
      // Gerar ID personalizado
      const newId = await this.getNextId();
      
      // Adicionar metadados seguindo o schema
      const newGestao = {
        _id: newId,
        _userEmail: gestaoData._userEmail,
        _genero: gestaoData._genero,
        _tipo: gestaoData._tipo,
        _direcionamento: gestaoData._direcionamento,
        _corpo: gestaoData._corpo, // Array de mensagens
        _statusHub: gestaoData._statusHub,
        _statusConsole: gestaoData._statusConsole,
        _lastUpdatedBy: gestaoData._lastUpdatedBy || 'user',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await collection.insertOne(newGestao);
      
      return {
        success: true,
        data: newGestao,
        message: 'Gestão criada com sucesso'
      };
    } catch (error) {
      console.error('Erro ao criar tk_gestão:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Atualizar gestão
  async update(id, updateData) {
    try {
      const collection = await this.getCollection();

      // Verificar se ticket existe
      const existingTicket = await collection.findOne({ _id: id });
      if (!existingTicket) {
        return {
          success: false,
          error: 'Gestão não encontrada'
        };
      }

      // Preparar dados de atualização
      const updatePayload = {
        ...updateData,
        updatedAt: new Date()
      };

      // Se _novaMensagem foi enviada, fazer append ao array _corpo existente
      if (updateData._novaMensagem) {
        // Verificar se mensagem já existe (prevenir duplicação)
        const mensagemExiste = existingTicket._corpo.some(msg =>
          msg.timestamp === updateData._novaMensagem.timestamp &&
          msg.mensagem === updateData._novaMensagem.mensagem
        );

        if (!mensagemExiste) {
          updatePayload._corpo = [...existingTicket._corpo, updateData._novaMensagem];
        }

        // Remover _novaMensagem do payload final (não deve ser armazenado como campo separado)
        delete updatePayload._novaMensagem;
      }

      // Se _corpo foi enviado (retrocompatibilidade), adicionar ao array existente
      if (updateData._corpo && Array.isArray(updateData._corpo)) {
        updatePayload._corpo = [...existingTicket._corpo, ...updateData._corpo];
      }

      const result = await collection.updateOne(
        { _id: id },
        { $set: updatePayload }
      );

      if (result.matchedCount === 0) {
        return {
          success: false,
          error: 'Gestão não encontrada'
        };
      }

      // Buscar gestão atualizada
      const updatedGestao = await collection.findOne({ _id: id });

      return {
        success: true,
        data: updatedGestao,
        message: 'Gestão atualizada com sucesso'
      };
    } catch (error) {
      console.error('Erro ao atualizar tk_gestão:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Buscar por email do usuário
  async getByUserEmail(userEmail) {
    try {
      const collection = await this.getCollection();
      const gestoes = await collection.find({ _userEmail: userEmail }).sort({ createdAt: -1 }).toArray();
      
      return {
        success: true,
        data: gestoes,
        count: gestoes.length
      };
    } catch (error) {
      console.error('Erro ao buscar tk_gestão por email:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }
}

module.exports = new TkGestao();
