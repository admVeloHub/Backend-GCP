// VERSION: v1.1.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');

// Connection string do MongoDB - usando helper centralizado
const { getMongoUri } = require('../config/mongodb');
const DATABASE_NAME = process.env.VELOHUBCENTRAL_DB || 'velohubcentral';
const COLLECTION_NAME = 'curso_certificados';

// GET /api/mongodb/certificados - Listar todos os certificados
router.get('/', async (req, res) => {
  let client;
  
  try {
    global.emitTraffic('Certificados', 'received', 'Entrada recebida - GET /api/mongodb/certificados');
    global.emitLog('info', 'GET /api/mongodb/certificados - Listando todos os certificados');
    
    // Query params opcionais
    const { email, courseName, courseId, limit, skip, sortBy, sortOrder } = req.query;
    
    global.emitTraffic('Certificados', 'processing', 'Conectando ao MongoDB');
    
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
    if (courseId) filter.courseId = courseId;
    
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
    
    global.emitTraffic('Certificados', 'processing', 'Consultando certificados');
    const certificados = await collection.find(filter, options).toArray();
    const total = await collection.countDocuments(filter);
    
    global.emitTraffic('Certificados', 'completed', `Concluído - ${certificados.length} certificados encontrados`);
    global.emitLog('success', `GET /api/mongodb/certificados - ${certificados.length} certificados encontrados`);
    
    const response = {
      success: true,
      data: certificados,
      count: certificados.length,
      total: total
    };
    
    global.emitJsonInput(response);
    res.json(response);
    
  } catch (error) {
    global.emitTraffic('Certificados', 'error', `Erro ao listar certificados: ${error.message}`);
    global.emitLog('error', `GET /api/mongodb/certificados - Erro: ${error.message}`);
    console.error('Erro ao listar certificados:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor ao listar certificados',
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

// GET /api/mongodb/certificados/email/:email - Buscar certificados por email (deve vir antes de /:id)
router.get('/email/:email', async (req, res) => {
  let client;
  
  try {
    const { email } = req.params;
    
    global.emitTraffic('Certificados', 'received', `Entrada recebida - GET /api/mongodb/certificados/email/${email}`);
    global.emitLog('info', `GET /api/mongodb/certificados/email/${email} - Buscando certificados por email`);
    
    global.emitTraffic('Certificados', 'processing', 'Conectando ao MongoDB');
    
    const MONGODB_URI = getMongoUri();
    client = new MongoClient(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    await client.connect();
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);
    
    const filter = { email: email.toLowerCase().trim() };
    
    global.emitTraffic('Certificados', 'processing', 'Consultando certificados por email');
    const certificados = await collection.find(filter).sort({ createdAt: -1 }).toArray();
    const total = await collection.countDocuments(filter);
    
    global.emitTraffic('Certificados', 'completed', `Concluído - ${certificados.length} certificados encontrados`);
    global.emitLog('success', `GET /api/mongodb/certificados/email/${email} - ${certificados.length} certificados encontrados`);
    
    const response = {
      success: true,
      data: certificados,
      count: certificados.length,
      total: total
    };
    
    global.emitJsonInput(response);
    res.json(response);
    
  } catch (error) {
    global.emitTraffic('Certificados', 'error', `Erro ao buscar certificados por email: ${error.message}`);
    global.emitLog('error', `GET /api/mongodb/certificados/email/:email - Erro: ${error.message}`);
    console.error('Erro ao buscar certificados por email:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor ao buscar certificados',
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

// GET /api/mongodb/certificados/course/:courseName - Buscar certificados por nome do curso (deve vir antes de /:id)
router.get('/course/:courseName', async (req, res) => {
  let client;
  
  try {
    const { courseName } = req.params;
    
    global.emitTraffic('Certificados', 'received', `Entrada recebida - GET /api/mongodb/certificados/course/${courseName}`);
    global.emitLog('info', `GET /api/mongodb/certificados/course/${courseName} - Buscando certificados por curso`);
    
    global.emitTraffic('Certificados', 'processing', 'Conectando ao MongoDB');
    
    const MONGODB_URI = getMongoUri();
    client = new MongoClient(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    await client.connect();
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);
    
    const filter = { courseName: { $regex: courseName, $options: 'i' } };
    
    global.emitTraffic('Certificados', 'processing', 'Consultando certificados por curso');
    const certificados = await collection.find(filter).sort({ createdAt: -1 }).toArray();
    const total = await collection.countDocuments(filter);
    
    global.emitTraffic('Certificados', 'completed', `Concluído - ${certificados.length} certificados encontrados`);
    global.emitLog('success', `GET /api/mongodb/certificados/course/${courseName} - ${certificados.length} certificados encontrados`);
    
    const response = {
      success: true,
      data: certificados,
      count: certificados.length,
      total: total
    };
    
    global.emitJsonInput(response);
    res.json(response);
    
  } catch (error) {
    global.emitTraffic('Certificados', 'error', `Erro ao buscar certificados por curso: ${error.message}`);
    global.emitLog('error', `GET /api/mongodb/certificados/course/:courseName - Erro: ${error.message}`);
    console.error('Erro ao buscar certificados por curso:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor ao buscar certificados',
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

// GET /api/mongodb/certificados/:id - Buscar certificado por ID (deve vir por último)
router.get('/:id', async (req, res) => {
  let client;
  
  try {
    const { id } = req.params;
    
    global.emitTraffic('Certificados', 'received', `Entrada recebida - GET /api/mongodb/certificados/${id}`);
    global.emitLog('info', `GET /api/mongodb/certificados/${id} - Buscando certificado por ID`);
    
    global.emitTraffic('Certificados', 'processing', 'Conectando ao MongoDB');
    
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
      global.emitTraffic('Certificados', 'error', 'ID inválido');
      global.emitLog('error', `GET /api/mongodb/certificados/${id} - ID inválido`);
      return res.status(400).json({
        success: false,
        error: 'ID inválido'
      });
    }
    
    global.emitTraffic('Certificados', 'processing', 'Consultando certificado');
    const certificado = await collection.findOne({ _id: new ObjectId(id) });
    
    if (!certificado) {
      global.emitTraffic('Certificados', 'error', 'Certificado não encontrado');
      global.emitLog('error', `GET /api/mongodb/certificados/${id} - Certificado não encontrado`);
      return res.status(404).json({
        success: false,
        error: 'Certificado não encontrado'
      });
    }
    
    global.emitTraffic('Certificados', 'completed', 'Concluído - Certificado encontrado');
    global.emitLog('success', `GET /api/mongodb/certificados/${id} - Certificado encontrado`);
    
    const response = {
      success: true,
      data: certificado
    };
    
    global.emitJsonInput(response);
    res.json(response);
    
  } catch (error) {
    global.emitTraffic('Certificados', 'error', `Erro ao buscar certificado: ${error.message}`);
    global.emitLog('error', `GET /api/mongodb/certificados/:id - Erro: ${error.message}`);
    console.error('Erro ao buscar certificado:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor ao buscar certificado',
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

