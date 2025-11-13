// VERSION: v1.0.1 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team
const express = require('express');
const router = express.Router();
const HubSessions = require('../models/HubSessions');

// GET /api/hub-sessions/user/:email - Sessões de um usuário
router.get('/user/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    global.emitTraffic('HubSessions', 'received', `Entrada recebida - GET /api/hub-sessions/user/${email}`);
    global.emitLog('info', `GET /api/hub-sessions/user/${email} - Obtendo sessões do usuário`);
    global.emitJson({ email });
    
    global.emitTraffic('HubSessions', 'processing', 'Transmitindo para DB');
    const result = await HubSessions.getByUserEmail(email);
    
    if (result.success) {
      global.emitTraffic('HubSessions', 'completed', 'Concluído - Sessões obtidas com sucesso');
      global.emitLog('success', `GET /api/hub-sessions/user/${email} - ${result.count} sessões encontradas`);
      global.emitJson(result);
      res.json(result);
    } else {
      global.emitTraffic('HubSessions', 'error', result.error);
      global.emitLog('error', `GET /api/hub-sessions/user/${email} - ${result.error}`);
      res.status(500).json(result);
    }
  } catch (error) {
    global.emitTraffic('HubSessions', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/hub-sessions/user/:email - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// GET /api/hub-sessions/active - Sessões ativas
router.get('/active', async (req, res) => {
  try {
    global.emitTraffic('HubSessions', 'received', 'Entrada recebida - GET /api/hub-sessions/active');
    global.emitLog('info', 'GET /api/hub-sessions/active - Obtendo sessões ativas');
    
    global.emitTraffic('HubSessions', 'processing', 'Transmitindo para DB');
    const result = await HubSessions.getActiveSessions();
    
    if (result.success) {
      global.emitTraffic('HubSessions', 'completed', 'Concluído - Sessões ativas obtidas com sucesso');
      global.emitLog('success', `GET /api/hub-sessions/active - ${result.count} sessões ativas encontradas`);
      global.emitJson(result);
      res.json(result);
    } else {
      global.emitTraffic('HubSessions', 'error', result.error);
      global.emitLog('error', `GET /api/hub-sessions/active - ${result.error}`);
      res.status(500).json(result);
    }
  } catch (error) {
    global.emitTraffic('HubSessions', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/hub-sessions/active - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// GET /api/hub-sessions/history/:email - Histórico completo com abertura/fechamento
router.get('/history/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    global.emitTraffic('HubSessions', 'received', `Entrada recebida - GET /api/hub-sessions/history/${email}`);
    global.emitLog('info', `GET /api/hub-sessions/history/${email} - Obtendo histórico de sessões`);
    global.emitJson({ email });
    
    global.emitTraffic('HubSessions', 'processing', 'Transmitindo para DB');
    const result = await HubSessions.getSessionHistory(email);
    
    if (result.success) {
      global.emitTraffic('HubSessions', 'completed', 'Concluído - Histórico obtido com sucesso');
      global.emitLog('success', `GET /api/hub-sessions/history/${email} - Histórico com ${result.count} sessões e resumo: ${JSON.stringify(result.summary)}`);
      global.emitJson(result);
      res.json(result);
    } else {
      global.emitTraffic('HubSessions', 'error', result.error);
      global.emitLog('error', `GET /api/hub-sessions/history/${email} - ${result.error}`);
      res.status(500).json(result);
    }
  } catch (error) {
    global.emitTraffic('HubSessions', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/hub-sessions/history/:email - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// GET /api/hub-sessions/session/:sessionId - Sessão específica por ID
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    global.emitTraffic('HubSessions', 'received', `Entrada recebida - GET /api/hub-sessions/session/${sessionId}`);
    global.emitLog('info', `GET /api/hub-sessions/session/${sessionId} - Obtendo sessão específica`);
    global.emitJson({ sessionId });
    
    global.emitTraffic('HubSessions', 'processing', 'Transmitindo para DB');
    const result = await HubSessions.getBySessionId(sessionId);
    
    if (result.success) {
      global.emitTraffic('HubSessions', 'completed', 'Concluído - Sessão obtida com sucesso');
      global.emitLog('success', `GET /api/hub-sessions/session/${sessionId} - Sessão encontrada`);
      global.emitJson(result);
      res.json(result);
    } else {
      global.emitTraffic('HubSessions', 'error', result.error);
      global.emitLog('error', `GET /api/hub-sessions/session/${sessionId} - ${result.error}`);
      res.status(result.error === 'Sessão não encontrada' ? 404 : 500).json(result);
    }
  } catch (error) {
    global.emitTraffic('HubSessions', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/hub-sessions/session/:sessionId - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// GET /api/hub-sessions/stats - Estatísticas gerais
router.get('/stats', async (req, res) => {
  try {
    global.emitTraffic('HubSessions', 'received', 'Entrada recebida - GET /api/hub-sessions/stats');
    global.emitLog('info', 'GET /api/hub-sessions/stats - Obtendo estatísticas gerais');
    
    global.emitTraffic('HubSessions', 'processing', 'Transmitindo para DB');
    const result = await HubSessions.getStats();
    
    if (result.success) {
      global.emitTraffic('HubSessions', 'completed', 'Concluído - Estatísticas obtidas com sucesso');
      global.emitLog('success', `GET /api/hub-sessions/stats - Estatísticas: ${JSON.stringify(result.data)}`);
      global.emitJson(result);
      res.json(result);
    } else {
      global.emitTraffic('HubSessions', 'error', result.error);
      global.emitLog('error', `GET /api/hub-sessions/stats - ${result.error}`);
      res.status(500).json(result);
    }
  } catch (error) {
    global.emitTraffic('HubSessions', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/hub-sessions/stats - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

module.exports = router;
