// VERSION: v1.0.1 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team
const express = require('express');
const router = express.Router();
const VelonewsAcknowledgments = require('../models/VelonewsAcknowledgments');

// GET /api/velonews-acknowledgments/news/:newsId - Quem confirmou a notícia
router.get('/news/:newsId', async (req, res) => {
  try {
    const { newsId } = req.params;
    
    global.emitTraffic('VelonewsAcknowledgments', 'received', `Entrada recebida - GET /api/velonews-acknowledgments/news/${newsId}`);
    global.emitLog('info', `GET /api/velonews-acknowledgments/news/${newsId} - Obtendo confirmações da notícia`);
    global.emitJson({ newsId });
    
    global.emitTraffic('VelonewsAcknowledgments', 'processing', 'Transmitindo para DB');
    const result = await VelonewsAcknowledgments.getByNewsId(newsId);
    
    if (result.success) {
      global.emitTraffic('VelonewsAcknowledgments', 'completed', 'Concluído - Confirmações obtidas com sucesso');
      global.emitLog('success', `GET /api/velonews-acknowledgments/news/${newsId} - ${result.count} confirmações encontradas`);
      global.emitJson(result);
      res.json(result);
    } else {
      global.emitTraffic('VelonewsAcknowledgments', 'error', result.error);
      global.emitLog('error', `GET /api/velonews-acknowledgments/news/${newsId} - ${result.error}`);
      res.status(500).json(result);
    }
  } catch (error) {
    global.emitTraffic('VelonewsAcknowledgments', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/velonews-acknowledgments/news/:newsId - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// GET /api/velonews-acknowledgments/user/:email - Notícias confirmadas pelo usuário
router.get('/user/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    global.emitTraffic('VelonewsAcknowledgments', 'received', `Entrada recebida - GET /api/velonews-acknowledgments/user/${email}`);
    global.emitLog('info', `GET /api/velonews-acknowledgments/user/${email} - Obtendo confirmações do usuário`);
    global.emitJson({ email });
    
    global.emitTraffic('VelonewsAcknowledgments', 'processing', 'Transmitindo para DB');
    const result = await VelonewsAcknowledgments.getByUserEmail(email);
    
    if (result.success) {
      global.emitTraffic('VelonewsAcknowledgments', 'completed', 'Concluído - Confirmações obtidas com sucesso');
      global.emitLog('success', `GET /api/velonews-acknowledgments/user/${email} - ${result.count} confirmações encontradas`);
      global.emitJson(result);
      res.json(result);
    } else {
      global.emitTraffic('VelonewsAcknowledgments', 'error', result.error);
      global.emitLog('error', `GET /api/velonews-acknowledgments/user/${email} - ${result.error}`);
      res.status(500).json(result);
    }
  } catch (error) {
    global.emitTraffic('VelonewsAcknowledgments', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/velonews-acknowledgments/user/:email - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// GET /api/velonews-acknowledgments/check/:newsId/:email - Verificar confirmação específica
router.get('/check/:newsId/:email', async (req, res) => {
  try {
    const { newsId, email } = req.params;
    
    global.emitTraffic('VelonewsAcknowledgments', 'received', `Entrada recebida - GET /api/velonews-acknowledgments/check/${newsId}/${email}`);
    global.emitLog('info', `GET /api/velonews-acknowledgments/check/${newsId}/${email} - Verificando confirmação específica`);
    global.emitJson({ newsId, email });
    
    global.emitTraffic('VelonewsAcknowledgments', 'processing', 'Transmitindo para DB');
    const result = await VelonewsAcknowledgments.checkAcknowledgment(newsId, email);
    
    if (result.success) {
      global.emitTraffic('VelonewsAcknowledgments', 'completed', 'Concluído - Verificação realizada com sucesso');
      global.emitLog('success', `GET /api/velonews-acknowledgments/check/${newsId}/${email} - Confirmação: ${result.data.acknowledged}`);
      global.emitJson(result);
      res.json(result);
    } else {
      global.emitTraffic('VelonewsAcknowledgments', 'error', result.error);
      global.emitLog('error', `GET /api/velonews-acknowledgments/check/${newsId}/${email} - ${result.error}`);
      res.status(500).json(result);
    }
  } catch (error) {
    global.emitTraffic('VelonewsAcknowledgments', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/velonews-acknowledgments/check/:newsId/:email - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// GET /api/velonews-acknowledgments/stats - Estatísticas gerais
router.get('/stats', async (req, res) => {
  try {
    global.emitTraffic('VelonewsAcknowledgments', 'received', 'Entrada recebida - GET /api/velonews-acknowledgments/stats');
    global.emitLog('info', 'GET /api/velonews-acknowledgments/stats - Obtendo estatísticas gerais');
    
    global.emitTraffic('VelonewsAcknowledgments', 'processing', 'Transmitindo para DB');
    const result = await VelonewsAcknowledgments.getStats();
    
    if (result.success) {
      global.emitTraffic('VelonewsAcknowledgments', 'completed', 'Concluído - Estatísticas obtidas com sucesso');
      global.emitLog('success', `GET /api/velonews-acknowledgments/stats - Estatísticas: ${JSON.stringify(result.data)}`);
      global.emitJson(result);
      res.json(result);
    } else {
      global.emitTraffic('VelonewsAcknowledgments', 'error', result.error);
      global.emitLog('error', `GET /api/velonews-acknowledgments/stats - ${result.error}`);
      res.status(500).json(result);
    }
  } catch (error) {
    global.emitTraffic('VelonewsAcknowledgments', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/velonews-acknowledgments/stats - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// GET /api/velonews-acknowledgments/recent - Confirmações recentes
router.get('/recent', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    global.emitTraffic('VelonewsAcknowledgments', 'received', `Entrada recebida - GET /api/velonews-acknowledgments/recent?limit=${limit}`);
    global.emitLog('info', `GET /api/velonews-acknowledgments/recent - Obtendo confirmações recentes (limite: ${limit})`);
    global.emitJson({ limit: parseInt(limit) });
    
    global.emitTraffic('VelonewsAcknowledgments', 'processing', 'Transmitindo para DB');
    const result = await VelonewsAcknowledgments.getRecent(parseInt(limit));
    
    if (result.success) {
      global.emitTraffic('VelonewsAcknowledgments', 'completed', 'Concluído - Confirmações recentes obtidas com sucesso');
      global.emitLog('success', `GET /api/velonews-acknowledgments/recent - ${result.count} confirmações recentes encontradas`);
      global.emitJson(result);
      res.json(result);
    } else {
      global.emitTraffic('VelonewsAcknowledgments', 'error', result.error);
      global.emitLog('error', `GET /api/velonews-acknowledgments/recent - ${result.error}`);
      res.status(500).json(result);
    }
  } catch (error) {
    global.emitTraffic('VelonewsAcknowledgments', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/velonews-acknowledgments/recent - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

module.exports = router;
