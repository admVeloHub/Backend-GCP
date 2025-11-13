// VERSION: v1.0.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

// Connection string do MongoDB (usar variável de ambiente se disponível)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://REDACTED_ATLAS_URI';

// Collections permitidas
const ALLOWED_COLLECTIONS = ['curso_certificados', 'quiz_reprovas'];

// Validar estrutura de certificado
const validateCertificado = (document) => {
  const errors = [];
  
  if (!document.date) errors.push('Campo "date" é obrigatório');
  if (!document.name) errors.push('Campo "name" é obrigatório');
  if (!document.email) errors.push('Campo "email" é obrigatório');
  if (!document.courseName) errors.push('Campo "courseName" é obrigatório');
  if (!document.status) errors.push('Campo "status" é obrigatório');
  if (!document.certificateUrl) errors.push('Campo "certificateUrl" é obrigatório');
  if (!document.certificateId) errors.push('Campo "certificateId" é obrigatório');
  
  // Validar formato de email
  if (document.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(document.email)) {
    errors.push('Campo "email" deve ser um email válido');
  }
  
  // Validar status
  if (document.status && document.status !== 'Aprovado') {
    errors.push('Campo "status" deve ser "Aprovado"');
  }
  
  return errors;
};

// Validar estrutura de reprovação
const validateReprovacao = (document) => {
  const errors = [];
  
  if (!document.date) errors.push('Campo "date" é obrigatório');
  if (!document.name) errors.push('Campo "name" é obrigatório');
  if (!document.email) errors.push('Campo "email" é obrigatório');
  if (!document.courseName) errors.push('Campo "courseName" é obrigatório');
  
  // Validar formato de email
  if (document.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(document.email)) {
    errors.push('Campo "email" deve ser um email válido');
  }
  
  return errors;
};

// Converter date string para Date object se necessário
const normalizeDate = (dateValue) => {
  if (!dateValue) return null;
  if (dateValue instanceof Date) return dateValue;
  if (typeof dateValue === 'string') {
    const parsed = new Date(dateValue);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

// Sanitizar documento antes de inserir
const sanitizeDocument = (document, collection) => {
  const sanitized = { ...document };
  
  // Normalizar date
  if (sanitized.date) {
    sanitized.date = normalizeDate(sanitized.date) || new Date();
  } else {
    sanitized.date = new Date();
  }
  
  // Sanitizar strings (trim e limitar tamanho)
  if (sanitized.name) sanitized.name = String(sanitized.name).trim().substring(0, 500);
  if (sanitized.email) sanitized.email = String(sanitized.email).trim().toLowerCase().substring(0, 255);
  if (sanitized.courseName) sanitized.courseName = String(sanitized.courseName).trim().substring(0, 500);
  if (sanitized.courseId) sanitized.courseId = sanitized.courseId ? String(sanitized.courseId).trim().substring(0, 100) : null;
  if (sanitized.certificateUrl) sanitized.certificateUrl = String(sanitized.certificateUrl).trim().substring(0, 1000);
  if (sanitized.certificateId) sanitized.certificateId = String(sanitized.certificateId).trim().substring(0, 100);
  if (sanitized.wrongQuestions) sanitized.wrongQuestions = String(sanitized.wrongQuestions).substring(0, 10000);
  
  // Validar tipos numéricos
  if (sanitized.finalGrade !== null && sanitized.finalGrade !== undefined) {
    const grade = Number(sanitized.finalGrade);
    sanitized.finalGrade = isNaN(grade) ? null : Math.max(0, Math.min(100, grade));
  }
  
  // Adicionar timestamps
  sanitized.createdAt = new Date();
  sanitized.updatedAt = new Date();
  
  return sanitized;
};

// POST /api/mongodb/insert - Inserir documento no MongoDB
router.post('/insert', async (req, res) => {
  let client;
  
  try {
    global.emitTraffic('MongoDBInsert', 'received', 'Entrada recebida - POST /api/mongodb/insert');
    global.emitLog('info', 'POST /api/mongodb/insert - Recebendo requisição de inserção');
    
    const { database, collection, document } = req.body;
    
    // OUTBOUND: Payload recebido
    global.emitJson({ database, collection, document });
    
    // Validações básicas
    if (!database || !collection || !document) {
      global.emitTraffic('MongoDBInsert', 'error', 'Campos obrigatórios faltando');
      global.emitLog('error', 'POST /api/mongodb/insert - Campos obrigatórios faltando: database, collection ou document');
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios faltando: database, collection e document são obrigatórios'
      });
    }
    
    // Validar database
    if (typeof database !== 'string' || database.trim() === '') {
      global.emitTraffic('MongoDBInsert', 'error', 'Database inválido');
      global.emitLog('error', 'POST /api/mongodb/insert - Database deve ser uma string não vazia');
      return res.status(400).json({
        success: false,
        error: 'Database deve ser uma string não vazia'
      });
    }
    
    // Validar collection
    if (!ALLOWED_COLLECTIONS.includes(collection)) {
      global.emitTraffic('MongoDBInsert', 'error', `Collection não permitida: ${collection}`);
      global.emitLog('error', `POST /api/mongodb/insert - Collection "${collection}" não é permitida. Collections permitidas: ${ALLOWED_COLLECTIONS.join(', ')}`);
      return res.status(400).json({
        success: false,
        error: `Collection não permitida. Collections permitidas: ${ALLOWED_COLLECTIONS.join(', ')}`
      });
    }
    
    // Validar documento
    if (typeof document !== 'object' || Array.isArray(document) || document === null) {
      global.emitTraffic('MongoDBInsert', 'error', 'Document deve ser um objeto');
      global.emitLog('error', 'POST /api/mongodb/insert - Document deve ser um objeto válido');
      return res.status(400).json({
        success: false,
        error: 'Document deve ser um objeto válido'
      });
    }
    
    // Validar estrutura específica da collection
    let validationErrors = [];
    if (collection === 'curso_certificados') {
      validationErrors = validateCertificado(document);
    } else if (collection === 'quiz_reprovas') {
      validationErrors = validateReprovacao(document);
    }
    
    if (validationErrors.length > 0) {
      global.emitTraffic('MongoDBInsert', 'error', `Erros de validação: ${validationErrors.join(', ')}`);
      global.emitLog('error', `POST /api/mongodb/insert - Erros de validação: ${validationErrors.join(', ')}`);
      return res.status(400).json({
        success: false,
        error: 'Erros de validação',
        details: validationErrors
      });
    }
    
    // Sanitizar documento
    const sanitizedDocument = sanitizeDocument(document, collection);
    
    global.emitTraffic('MongoDBInsert', 'processing', `Conectando ao MongoDB - Database: ${database}, Collection: ${collection}`);
    global.emitLog('info', `POST /api/mongodb/insert - Conectando ao MongoDB para inserir em ${database}.${collection}`);
    
    // Conectar ao MongoDB
    client = new MongoClient(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    await client.connect();
    global.emitLog('info', 'POST /api/mongodb/insert - Conectado ao MongoDB com sucesso');
    
    // Obter database e collection
    const db = client.db(database);
    const coll = db.collection(collection);
    
    // OUTBOUND: Documento sendo enviado para MongoDB
    global.emitJson(sanitizedDocument);
    
    global.emitTraffic('MongoDBInsert', 'processing', 'Inserindo documento no MongoDB');
    global.emitLog('info', `POST /api/mongodb/insert - Inserindo documento em ${database}.${collection}`);
    
    // Inserir documento
    const result = await coll.insertOne(sanitizedDocument);
    
    global.emitTraffic('MongoDBInsert', 'completed', `Documento inserido com sucesso - ID: ${result.insertedId}`);
    global.emitLog('success', `POST /api/mongodb/insert - Documento inserido com sucesso em ${database}.${collection} - ID: ${result.insertedId}`);
    
    // INBOUND: Resposta para o cliente
    const response = {
      success: true,
      insertedId: result.insertedId.toString(),
      database: database,
      collection: collection
    };
    
    global.emitJsonInput(response);
    
    res.status(200).json(response);
    
  } catch (error) {
    global.emitTraffic('MongoDBInsert', 'error', `Erro ao inserir documento: ${error.message}`);
    global.emitLog('error', `POST /api/mongodb/insert - Erro: ${error.message}`);
    console.error('Erro ao inserir documento no MongoDB:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor ao inserir documento',
      message: error.message
    });
  } finally {
    // Fechar conexão
    if (client) {
      try {
        await client.close();
        global.emitLog('info', 'POST /api/mongodb/insert - Conexão MongoDB fechada');
      } catch (closeError) {
        console.error('Erro ao fechar conexão MongoDB:', closeError);
      }
    }
  }
});

module.exports = router;




