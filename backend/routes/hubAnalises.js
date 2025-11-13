// VERSION: v1.0.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
const express = require('express');
const router = express.Router();
const HubSessions = require('../models/HubSessions');
const VelonewsAcknowledgments = require('../models/VelonewsAcknowledgments');
const QualidadeFuncionario = require('../models/QualidadeFuncionario');
const Velonews = require('../models/Velonews');

// GET /api/hub-analises/hub-sessions - Listar todas as sessões hub_sessions
router.get('/hub-sessions', async (req, res) => {
  try {
    global.emitTraffic('Hub Analises', 'received', 'Entrada recebida - GET /api/hub-analises/hub-sessions');
    global.emitLog('info', 'GET /api/hub-analises/hub-sessions - Listando todas as sessões');
    
    const { isActive, userEmail } = req.query;
    
    let result;
    if (isActive !== undefined) {
      const isActiveBool = isActive === 'true';
      result = await HubSessions.getActiveSessions();
      if (isActiveBool) {
        // Já retorna apenas ativas
      } else {
        // Buscar inativas
        const allSessions = await HubSessions.getAll();
        result = {
          success: true,
          data: allSessions.data.filter(s => !s.isActive),
          count: allSessions.data.filter(s => !s.isActive).length
        };
      }
    } else if (userEmail) {
      result = await HubSessions.getByUserEmail(userEmail);
    } else {
      result = await HubSessions.getAll();
    }
    
    if (result.success) {
      global.emitTraffic('Hub Analises', 'completed', 'Concluído - Sessões listadas com sucesso');
      global.emitLog('success', `GET /api/hub-analises/hub-sessions - ${result.count} sessões encontradas`);
      global.emitJsonInput(result);
      res.json(result);
    } else {
      global.emitTraffic('Hub Analises', 'error', result.error);
      global.emitLog('error', `GET /api/hub-analises/hub-sessions - ${result.error}`);
      res.status(500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Hub Analises', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/hub-analises/hub-sessions - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// GET /api/hub-analises/acknowledged-news - Listar todas as confirmações de notícias
router.get('/acknowledged-news', async (req, res) => {
  try {
    global.emitTraffic('Hub Analises', 'received', 'Entrada recebida - GET /api/hub-analises/acknowledged-news');
    global.emitLog('info', 'GET /api/hub-analises/acknowledged-news - Listando todas as confirmações');
    
    const { newsId, userEmail } = req.query;
    
    let result;
    if (newsId) {
      result = await VelonewsAcknowledgments.getByNewsId(newsId);
    } else if (userEmail) {
      result = await VelonewsAcknowledgments.getByUserEmail(userEmail);
    } else {
      result = await VelonewsAcknowledgments.getAll();
    }
    
    if (result.success) {
      global.emitTraffic('Hub Analises', 'completed', 'Concluído - Confirmações listadas com sucesso');
      global.emitLog('success', `GET /api/hub-analises/acknowledged-news - ${result.count} confirmações encontradas`);
      global.emitJsonInput(result);
      res.json(result);
    } else {
      global.emitTraffic('Hub Analises', 'error', result.error);
      global.emitLog('error', `GET /api/hub-analises/acknowledged-news - ${result.error}`);
      res.status(500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Hub Analises', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/hub-analises/acknowledged-news - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// GET /api/hub-analises/usuarios-online-offline - Usuários online/offline
router.get('/usuarios-online-offline', async (req, res) => {
  try {
    global.emitTraffic('Hub Analises', 'received', 'Entrada recebida - GET /api/hub-analises/usuarios-online-offline');
    global.emitLog('info', 'GET /api/hub-analises/usuarios-online-offline - Processando usuários online/offline');
    
    // Buscar funcionários ativos (não desligados e não afastados)
    const funcionariosResult = await QualidadeFuncionario.getActiveFuncionarios();
    
    if (!funcionariosResult.success) {
      global.emitTraffic('Hub Analises', 'error', 'Erro ao buscar funcionários ativos');
      global.emitLog('error', 'GET /api/hub-analises/usuarios-online-offline - Erro ao buscar funcionários');
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar funcionários ativos'
      });
    }
    
    // Buscar todas as sessões ativas
    const sessionsResult = await HubSessions.getAll();
    
    if (!sessionsResult.success) {
      global.emitTraffic('Hub Analises', 'error', 'Erro ao buscar sessões');
      global.emitLog('error', 'GET /api/hub-analises/usuarios-online-offline - Erro ao buscar sessões');
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar sessões'
      });
    }
    
    // Criar mapa de sessões ativas por colaboradorNome (normalizado)
    const activeSessionsMap = new Map();
    sessionsResult.data
      .filter(session => session.isActive === true)
      .forEach(session => {
        const key = (session.colaboradorNome || session.userEmail || '').toLowerCase().trim();
        if (key) {
          activeSessionsMap.set(key, session);
        }
      });
    
    // Organizar funcionários em online e offline
    const online = [];
    const offline = [];
    
    funcionariosResult.data.forEach(funcionario => {
      const colaboradorNome = funcionario.colaboradorNome;
      const keyNormalizado = colaboradorNome.toLowerCase().trim();
      const session = activeSessionsMap.get(keyNormalizado);
      
      if (session) {
        online.push({
          colaboradorNome: session.colaboradorNome || colaboradorNome,
          sessionId: session.sessionId,
          loginTimestamp: session.loginTimestamp,
          ipAddress: session.ipAddress,
          isActive: session.isActive
        });
      } else {
        offline.push({
          colaboradorNome: colaboradorNome,
          sessionId: null,
          loginTimestamp: null,
          ipAddress: null,
          isActive: false
        });
      }
    });
    
    const response = {
      success: true,
      data: {
        online,
        offline,
        totalOnline: online.length,
        totalOffline: offline.length,
        totalFuncionarios: funcionariosResult.count
      }
    };
    
    global.emitTraffic('Hub Analises', 'completed', 'Concluído - Usuários online/offline processados');
    global.emitLog('success', `GET /api/hub-analises/usuarios-online-offline - ${response.data.totalOnline} online, ${response.data.totalOffline} offline`);
    global.emitJsonInput(response);
    res.json(response);
    
  } catch (error) {
    global.emitTraffic('Hub Analises', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/hub-analises/usuarios-online-offline - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// GET /api/hub-analises/ciencia-por-noticia - Ciência agrupada por notícia
router.get('/ciencia-por-noticia', async (req, res) => {
  try {
    global.emitTraffic('Hub Analises', 'received', 'Entrada recebida - GET /api/hub-analises/ciencia-por-noticia');
    global.emitLog('info', 'GET /api/hub-analises/ciencia-por-noticia - Processando ciência por notícia');
    
    // Buscar todas as confirmações
    const acknowledgmentsResult = await VelonewsAcknowledgments.getAll();
    
    if (!acknowledgmentsResult.success) {
      global.emitTraffic('Hub Analises', 'error', 'Erro ao buscar confirmações');
      global.emitLog('error', 'GET /api/hub-analises/ciencia-por-noticia - Erro ao buscar confirmações');
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar confirmações'
      });
    }
    
    // Agrupar por newsId
    const groupedByNews = new Map();
    
    for (const acknowledgment of acknowledgmentsResult.data) {
      const newsId = acknowledgment.newsId;
      
      if (!groupedByNews.has(newsId.toString())) {
        // Buscar título da notícia
        const newsResult = await Velonews.getById(newsId.toString());
        const titulo = newsResult.success ? newsResult.data.titulo : 'Notícia não encontrada';
        
        groupedByNews.set(newsId.toString(), {
          newsId: newsId,
          titulo: titulo,
          agentes: [],
          primeiraCiencia: null,
          ultimaCiencia: null
        });
      }
      
      const grupo = groupedByNews.get(newsId.toString());
      grupo.agentes.push({
        colaboradorNome: acknowledgment.colaboradorNome,
        userEmail: acknowledgment.userEmail,
        acknowledgedAt: acknowledgment.acknowledgedAt
      });
      
      // Atualizar primeira e última ciência
      const ackDate = new Date(acknowledgment.acknowledgedAt);
      if (!grupo.primeiraCiencia || ackDate < new Date(grupo.primeiraCiencia)) {
        grupo.primeiraCiencia = acknowledgment.acknowledgedAt;
      }
      if (!grupo.ultimaCiencia || ackDate > new Date(grupo.ultimaCiencia)) {
        grupo.ultimaCiencia = acknowledgment.acknowledgedAt;
      }
    }
    
    // Converter Map para Array e adicionar totalAgentes
    const data = Array.from(groupedByNews.values()).map(grupo => ({
      newsId: grupo.newsId,
      titulo: grupo.titulo,
      agentes: grupo.agentes.sort((a, b) => 
        new Date(b.acknowledgedAt) - new Date(a.acknowledgedAt)
      ),
      totalAgentes: grupo.agentes.length,
      primeiraCiencia: grupo.primeiraCiencia,
      ultimaCiencia: grupo.ultimaCiencia
    }));
    
    const response = {
      success: true,
      data: data,
      count: data.length
    };
    
    global.emitTraffic('Hub Analises', 'completed', 'Concluído - Ciência por notícia processada');
    global.emitLog('success', `GET /api/hub-analises/ciencia-por-noticia - ${response.count} notícias com ciência`);
    global.emitJsonInput(response);
    res.json(response);
    
  } catch (error) {
    global.emitTraffic('Hub Analises', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/hub-analises/ciencia-por-noticia - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

module.exports = router;

