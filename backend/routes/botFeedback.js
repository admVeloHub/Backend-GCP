// VERSION: v1.1.0 | DATE: 2025-11-26 | AUTHOR: VeloHub Development Team
const express = require('express');
const router = express.Router();
const BotFeedback = require('../models/BotFeedback');

// GET /api/bot-feedback - Listar todos os feedbacks
router.get('/', async (req, res) => {
  try {
    global.emitTraffic('Bot Feedback', 'received', 'Entrada recebida - GET /api/bot-feedback');
    global.emitLog('info', 'GET /api/bot-feedback - Listando todos os feedbacks');
    
    const result = await BotFeedback.getAll();
    
    global.emitTraffic('Bot Feedback', 'processing', 'Consultando DB');
    
    if (result.success) {
      global.emitTraffic('Bot Feedback', 'completed', 'Concluído - Feedbacks listados com sucesso');
      global.emitLog('success', `GET /api/bot-feedback - ${result.count} feedbacks encontrados`);
      
      // INBOUND: Resposta para o frontend
      global.emitJsonInput(result);
      res.json(result);
    } else {
      global.emitTraffic('Bot Feedback', 'error', result.error);
      global.emitLog('error', `GET /api/bot-feedback - ${result.error}`);
      res.status(500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Bot Feedback', 'error', 'Erro ao listar feedbacks');
    global.emitLog('error', `GET /api/bot-feedback - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// GET /api/bot-feedback/:id - Obter feedback por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    global.emitTraffic('Bot Feedback', 'received', `Entrada recebida - GET /api/bot-feedback/${id}`);
    global.emitLog('info', `GET /api/bot-feedback/${id} - Obtendo feedback por ID`);
    
    global.emitTraffic('Bot Feedback', 'processing', 'Consultando DB');
    const result = await BotFeedback.getById(id);
    
    if (result.success) {
      global.emitTraffic('Bot Feedback', 'completed', 'Concluído - Feedback obtido com sucesso');
      global.emitLog('success', `GET /api/bot-feedback/${id} - Feedback obtido com sucesso`);
      
      // INBOUND: Resposta para o frontend
      global.emitJsonInput(result);
      res.json(result);
    } else {
      global.emitTraffic('Bot Feedback', 'error', result.error);
      global.emitLog('error', `GET /api/bot-feedback/${id} - ${result.error}`);
      res.status(result.error === 'Feedback não encontrado' ? 404 : 500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Bot Feedback', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/bot-feedback/:id - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// POST /api/bot-feedback - Criar novo feedback
router.post('/', async (req, res) => {
  try {
    global.emitTraffic('Bot Feedback', 'received', 'Entrada recebida - POST /api/bot-feedback');
    global.emitLog('info', 'POST /api/bot-feedback - Criando novo feedback');
    
    const { colaboradorNome, action, messageId, sessionId, source, details } = req.body;
    
    // Validação de campos obrigatórios
    if (!colaboradorNome || !messageId || !source || !details || !details.feedbackType) {
      global.emitTraffic('Bot Feedback', 'error', 'Dados obrigatórios ausentes');
      global.emitLog('error', 'POST /api/bot-feedback - colaboradorNome, messageId, source e details.feedbackType são obrigatórios');
      return res.status(400).json({ 
        success: false, 
        error: 'colaboradorNome, messageId, source e details.feedbackType são obrigatórios' 
      });
    }

    const feedbackData = {
      colaboradorNome,
      action: action || 'feedback_given',
      messageId,
      sessionId: sessionId || null,
      source,
      details: {
        feedbackType: details.feedbackType,
        comment: details.comment || '',
        question: details.question || '',
        answer: details.answer || '',
        aiProvider: details.aiProvider || null,
        responseSource: details.responseSource || ''
      }
    };

    // OUTBOUND: Schema sendo enviado para MongoDB
    global.emitJson(feedbackData);

    global.emitTraffic('Bot Feedback', 'processing', 'Transmitindo para DB');
    const result = await BotFeedback.create(feedbackData);
    
    if (result.success) {
      global.emitTraffic('Bot Feedback', 'completed', 'Concluído - Feedback criado com sucesso');
      global.emitLog('success', `POST /api/bot-feedback - Feedback criado com sucesso`);
      
      // INBOUND: Resposta para o frontend
      global.emitJsonInput(result);
      res.status(201).json(result);
    } else {
      global.emitTraffic('Bot Feedback', 'error', 'Erro ao criar feedback');
      global.emitLog('error', 'POST /api/bot-feedback - Erro ao criar feedback');
      res.status(500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Bot Feedback', 'error', 'Erro interno do servidor');
    global.emitLog('error', `POST /api/bot-feedback - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// PUT /api/bot-feedback/:id - Atualizar feedback
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { colaboradorNome, action, messageId, sessionId, source, resolvido, details } = req.body;
    
    global.emitTraffic('Bot Feedback', 'received', `Entrada recebida - PUT /api/bot-feedback/${id}`);
    global.emitLog('info', `PUT /api/bot-feedback/${id} - Atualizando feedback`);
    global.emitJson({ id, ...req.body });
    
    const updateData = {};
    if (colaboradorNome !== undefined) updateData.colaboradorNome = colaboradorNome;
    if (action !== undefined) updateData.action = action;
    if (messageId !== undefined) updateData.messageId = messageId;
    if (sessionId !== undefined) updateData.sessionId = sessionId;
    if (source !== undefined) updateData.source = source;
    if (resolvido !== undefined) updateData.resolvido = resolvido;
    if (details !== undefined) updateData.details = details;

    global.emitTraffic('Bot Feedback', 'processing', 'Transmitindo para DB');
    const result = await BotFeedback.update(id, updateData);
    
    if (result.success) {
      global.emitTraffic('Bot Feedback', 'completed', 'Concluído - Feedback atualizado com sucesso');
      global.emitLog('success', `PUT /api/bot-feedback/${id} - Feedback atualizado com sucesso`);
      global.emitJson(result);
      res.json(result);
    } else {
      global.emitTraffic('Bot Feedback', 'error', result.error);
      global.emitLog('error', `PUT /api/bot-feedback/${id} - ${result.error}`);
      res.status(result.error === 'Feedback não encontrado' ? 404 : 500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Bot Feedback', 'error', 'Erro interno do servidor');
    global.emitLog('error', `PUT /api/bot-feedback/:id - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// DELETE /api/bot-feedback/:id - Deletar feedback
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    global.emitTraffic('Bot Feedback', 'received', `Entrada recebida - DELETE /api/bot-feedback/${id}`);
    global.emitLog('info', `DELETE /api/bot-feedback/${id} - Deletando feedback`);
    // OUTBOUND: ID sendo deletado
    global.emitJson({ id });

    global.emitTraffic('Bot Feedback', 'processing', 'Transmitindo para DB');
    const result = await BotFeedback.delete(id);
    
    if (result.success) {
      global.emitTraffic('Bot Feedback', 'completed', 'Concluído - Feedback deletado com sucesso');
      global.emitLog('success', `DELETE /api/bot-feedback/${id} - Feedback deletado com sucesso`);
      global.emitJson(result);
      // INBOUND: Confirmação para o frontend
      global.emitJsonInput(result);
      res.json(result);
    } else {
      global.emitTraffic('Bot Feedback', 'error', result.error);
      global.emitLog('error', `DELETE /api/bot-feedback/${id} - ${result.error}`);
      res.status(result.error === 'Feedback não encontrado' ? 404 : 500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Bot Feedback', 'error', 'Erro interno do servidor');
    global.emitLog('error', `DELETE /api/bot-feedback/:id - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

module.exports = router;

