// VERSION: v1.1.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');

// Connection string do MongoDB - usando helper centralizado
const { getMongoUri } = require('../config/mongodb');
const DATABASE_NAME = process.env.VELOHUBCENTRAL_DB || 'velohubcentral';
const COLLECTION_NAME = 'quiz_reprovas';

// GET /api/mongodb/reprovas - Listar todas as reprovações
router.get('/', async (req, res) => {
  let client;
  
  try {
    global.emitTraffic('Reprovas', 'received', 'Entrada recebida - GET /api/mongodb/reprovas');
    global.emitLog('info', 'GET /api/mongodb/reprovas - Listando todas as reprovações');
    
    // Query params opcionais
    const { email, courseName, limit, skip, sortBy, sortOrder } = req.query;
    
    global.emitTraffic('Reprovas', 'processing', 'Conectando ao MongoDB');
    
    const MONGODB_URI = getMongoUri();
    client = new MongoClient(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    await client.connect();
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);
    
    // Construir query de filtro
    const filter = {};
    if (email) filter.email = email.toLowerCase().trim();
    if (courseName) filter.courseName = { $regex: courseName, $options: 'i' };
    
    // Construir opções de query
    const options = {};
    if (limit) options.limit = parseInt(limit, 10);
    if (skip) options.skip = parseInt(skip, 10);
    
    // Ordenação
    const sort = {};
    if (sortBy) {
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    } else {
      sort.createdAt = -1; // Padrão: mais recentes primeiro
    }
    options.sort = sort;
    
    global.emitTraffic('Reprovas', 'processing', 'Consultando reprovações');
    const reprovas = await collection.find(filter, options).toArray();
    const total = await collection.countDocuments(filter);
    
    global.emitTraffic('Reprovas', 'completed', `Concluído - ${reprovas.length} reprovações encontradas`);
    global.emitLog('success', `GET /api/mongodb/reprovas - ${reprovas.length} reprovações encontradas`);
    
    const response = {
      success: true,
      data: reprovas,
      count: reprovas.length,
      total: total
    };
    
    global.emitJsonInput(response);
    res.json(response);
    
  } catch (error) {
    global.emitTraffic('Reprovas', 'error', `Erro ao listar reprovações: ${error.message}`);
    global.emitLog('error', `GET /api/mongodb/reprovas - Erro: ${error.message}`);
    console.error('Erro ao listar reprovações:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor ao listar reprovações',
      message: error.message
    });
  } finally {
    if (client) {
      try {
        await client.close();
      } catch (closeError) {
        console.error('Erro ao fechar conexão MongoDB:', closeError);
      }
    }
  }
});

// GET /api/mongodb/reprovas/email/:email - Buscar reprovações por email (deve vir antes de /:id)
router.get('/email/:email', async (req, res) => {
  let client;
  
  try {
    const { email } = req.params;
    
    global.emitTraffic('Reprovas', 'received', `Entrada recebida - GET /api/mongodb/reprovas/email/${email}`);
    global.emitLog('info', `GET /api/mongodb/reprovas/email/${email} - Buscando reprovações por email`);
    
    global.emitTraffic('Reprovas', 'processing', 'Conectando ao MongoDB');
    
    const MONGODB_URI = getMongoUri();
    client = new MongoClient(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    await client.connect();
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);
    
    const filter = { email: email.toLowerCase().trim() };
    
    global.emitTraffic('Reprovas', 'processing', 'Consultando reprovações por email');
    const reprovas = await collection.find(filter).sort({ createdAt: -1 }).toArray();
    const total = await collection.countDocuments(filter);
    
    global.emitTraffic('Reprovas', 'completed', `Concluído - ${reprovas.length} reprovações encontradas`);
    global.emitLog('success', `GET /api/mongodb/reprovas/email/${email} - ${reprovas.length} reprovações encontradas`);
    
    const response = {
      success: true,
      data: reprovas,
      count: reprovas.length,
      total: total
    };
    
    global.emitJsonInput(response);
    res.json(response);
    
  } catch (error) {
    global.emitTraffic('Reprovas', 'error', `Erro ao buscar reprovações por email: ${error.message}`);
    global.emitLog('error', `GET /api/mongodb/reprovas/email/:email - Erro: ${error.message}`);
    console.error('Erro ao buscar reprovações por email:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor ao buscar reprovações',
      message: error.message
    });
  } finally {
    if (client) {
      try {
        await client.close();
      } catch (closeError) {
        console.error('Erro ao fechar conexão MongoDB:', closeError);
      }
    }
  }
});

// GET /api/mongodb/reprovas/course/:courseName - Buscar reprovações por nome do curso (deve vir antes de /:id)
router.get('/course/:courseName', async (req, res) => {
  let client;
  
  try {
    const { courseName } = req.params;
    
    global.emitTraffic('Reprovas', 'received', `Entrada recebida - GET /api/mongodb/reprovas/course/${courseName}`);
    global.emitLog('info', `GET /api/mongodb/reprovas/course/${courseName} - Buscando reprovações por curso`);
    
    global.emitTraffic('Reprovas', 'processing', 'Conectando ao MongoDB');
    
    const MONGODB_URI = getMongoUri();
    client = new MongoClient(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    await client.connect();
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);
    
    const filter = { courseName: { $regex: courseName, $options: 'i' } };
    
    global.emitTraffic('Reprovas', 'processing', 'Consultando reprovações por curso');
    const reprovas = await collection.find(filter).sort({ createdAt: -1 }).toArray();
    const total = await collection.countDocuments(filter);
    
    global.emitTraffic('Reprovas', 'completed', `Concluído - ${reprovas.length} reprovações encontradas`);
    global.emitLog('success', `GET /api/mongodb/reprovas/course/${courseName} - ${reprovas.length} reprovações encontradas`);
    
    const response = {
      success: true,
      data: reprovas,
      count: reprovas.length,
      total: total
    };
    
    global.emitJsonInput(response);
    res.json(response);
    
  } catch (error) {
    global.emitTraffic('Reprovas', 'error', `Erro ao buscar reprovações por curso: ${error.message}`);
    global.emitLog('error', `GET /api/mongodb/reprovas/course/:courseName - Erro: ${error.message}`);
    console.error('Erro ao buscar reprovações por curso:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor ao buscar reprovações',
      message: error.message
    });
  } finally {
    if (client) {
      try {
        await client.close();
      } catch (closeError) {
        console.error('Erro ao fechar conexão MongoDB:', closeError);
      }
    }
  }
});

// GET /api/mongodb/reprovas/:id - Buscar reprovação por ID (deve vir por último)
router.get('/:id', async (req, res) => {
  let client;
  
  try {
    const { id } = req.params;
    
    global.emitTraffic('Reprovas', 'received', `Entrada recebida - GET /api/mongodb/reprovas/${id}`);
    global.emitLog('info', `GET /api/mongodb/reprovas/${id} - Buscando reprovação por ID`);
    
    global.emitTraffic('Reprovas', 'processing', 'Conectando ao MongoDB');
    
    const MONGODB_URI = getMongoUri();
    client = new MongoClient(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    await client.connect();
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);
    
    // Validar ObjectId
    if (!ObjectId.isValid(id)) {
      global.emitTraffic('Reprovas', 'error', 'ID inválido');
      global.emitLog('error', `GET /api/mongodb/reprovas/${id} - ID inválido`);
      return res.status(400).json({
        success: false,
        error: 'ID inválido'
      });
    }
    
    global.emitTraffic('Reprovas', 'processing', 'Consultando reprovação');
    const reprovacao = await collection.findOne({ _id: new ObjectId(id) });
    
    if (!reprovacao) {
      global.emitTraffic('Reprovas', 'error', 'Reprovação não encontrada');
      global.emitLog('error', `GET /api/mongodb/reprovas/${id} - Reprovação não encontrada`);
      return res.status(404).json({
        success: false,
        error: 'Reprovação não encontrada'
      });
    }
    
    global.emitTraffic('Reprovas', 'completed', 'Concluído - Reprovação encontrada');
    global.emitLog('success', `GET /api/mongodb/reprovas/${id} - Reprovação encontrada`);
    
    const response = {
      success: true,
      data: reprovacao
    };
    
    global.emitJsonInput(response);
    res.json(response);
    
  } catch (error) {
    global.emitTraffic('Reprovas', 'error', `Erro ao buscar reprovação: ${error.message}`);
    global.emitLog('error', `GET /api/mongodb/reprovas/:id - Erro: ${error.message}`);
    console.error('Erro ao buscar reprovação:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor ao buscar reprovação',
      message: error.message
    });
  } finally {
    if (client) {
      try {
        await client.close();
      } catch (closeError) {
        console.error('Erro ao fechar conexão MongoDB:', closeError);
      }
    }
  }
});

module.exports = router;

