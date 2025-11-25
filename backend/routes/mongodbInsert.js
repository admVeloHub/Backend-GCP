// VERSION: v1.3.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

// Connection string do MongoDB - usando helper centralizado
const { getMongoUri } = require('../config/mongodb');

// Database fixo para certificados e reprovações
const ACADEMY_REGISTROS_DB = process.env.ACADEMY_REGISTROS_DB || 'academy_registros';

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
    
    // OUTBOUND: Payload recebido completo (para monitoramento)
    global.emitJson({ 
      recebido: { database, collection, document },
      observacao: 'Database será ignorado e sempre usado: academy_registros'
    });
    
    // Validações básicas (database não é mais obrigatório, será sempre academy_registros)
    if (!collection || !document) {
      global.emitTraffic('MongoDBInsert', 'error', 'Campos obrigatórios faltando');
      global.emitLog('error', 'POST /api/mongodb/insert - Campos obrigatórios faltando: collection ou document');
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios faltando: collection e document são obrigatórios'
      });
    }
    
    // Database sempre será academy_registros (ignorar o que vier no body)
    const targetDatabase = ACADEMY_REGISTROS_DB;
    
    if (database && database !== targetDatabase) {
      global.emitLog('warning', `POST /api/mongodb/insert - Database recebido "${database}" será ignorado. Usando "${targetDatabase}"`);
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
    
    global.emitTraffic('MongoDBInsert', 'processing', `Conectando ao MongoDB - Database: ${targetDatabase}, Collection: ${collection}`);
    global.emitLog('info', `POST /api/mongodb/insert - Conectando ao MongoDB para inserir em ${targetDatabase}.${collection}`);
    
    // Conectar ao MongoDB
    const MONGODB_URI = getMongoUri();
    client = new MongoClient(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    await client.connect();
    global.emitLog('info', 'POST /api/mongodb/insert - Conectado ao MongoDB com sucesso');
    
    // Obter database e collection (sempre academy_registros)
    const db = client.db(targetDatabase);
    const coll = db.collection(collection);
    
    // OUTBOUND: Documento sendo enviado para MongoDB (mostrar no monitor)
    global.emitJson({
      destino: `${targetDatabase}.${collection}`,
      documento: sanitizedDocument
    });
    
    global.emitTraffic('MongoDBInsert', 'processing', 'Inserindo documento no MongoDB');
    global.emitLog('info', `POST /api/mongodb/insert - Inserindo documento em ${targetDatabase}.${collection}`);
    global.emitLog('info', `POST /api/mongodb/insert - Documento sanitizado: ${JSON.stringify(sanitizedDocument).substring(0, 200)}...`);
    
    // Inserir documento com write concern explícito para garantir escrita confirmada
    const result = await coll.insertOne(sanitizedDocument, {
      writeConcern: { w: 'majority', wtimeout: 5000 }
    });
    
    // Verificar se a inserção foi bem-sucedida
    if (!result.insertedId) {
      throw new Error('Inserção falhou: insertedId não retornado');
    }
    
    global.emitTraffic('MongoDBInsert', 'completed', `Documento inserido com sucesso - ID: ${result.insertedId}`);
    global.emitLog('success', `POST /api/mongodb/insert - Documento inserido com sucesso em ${targetDatabase}.${collection} - ID: ${result.insertedId}`);
    global.emitLog('info', `POST /api/mongodb/insert - Resultado completo: ${JSON.stringify(result)}`);
    
    // INBOUND: Resposta para o cliente
    const response = {
      success: true,
      insertedId: result.insertedId.toString(),
      database: targetDatabase,
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




