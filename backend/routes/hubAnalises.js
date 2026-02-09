// VERSION: v1.1.0 | DATE: 2025-02-09 | AUTHOR: VeloHub Development Team
const express = require('express');
const router = express.Router();
const HubSessions = require('../models/HubSessions');
const VelonewsAcknowledgments = require('../models/VelonewsAcknowledgments');
const QualidadeFuncionario = require('../models/QualidadeFuncionario');
const Velonews = require('../models/Velonews');

// GET /api/hub-analises/hub-sessions - Listar todas as sessões hub_sessions
// OTIMIZADO: Suporta paginação para melhor performance com grandes volumes
router.get('/hub-sessions', async (req, res) => {
  try {
    global.emitTraffic('Hub Analises', 'received', 'Entrada recebida - GET /api/hub-analises/hub-sessions');
    global.emitLog('info', 'GET /api/hub-analises/hub-sessions - Listando sessões');
    
    const { isActive, userEmail, limit, skip } = req.query;
    
    // Converter limit e skip para números (valores padrão se não fornecidos)
    const limitNum = limit ? parseInt(limit, 10) : 1000;
    const skipNum = skip ? parseInt(skip, 10) : 0;
    
    let result;
    if (isActive !== undefined) {
      const isActiveBool = isActive === 'true';
      if (isActiveBool) {
        // Buscar apenas sessões ativas
        result = await HubSessions.getActiveSessions();
      } else {
        // Buscar inativas com paginação
        const allSessions = await HubSessions.getAllPaginated(limitNum, skipNum);
        result = {
          success: true,
          data: allSessions.data.filter(s => !s.isActive),
          count: allSessions.data.filter(s => !s.isActive).length,
          limit: allSessions.limit,
          skip: allSessions.skip,
          totalCount: allSessions.totalCount,
          hasMore: allSessions.hasMore
        };
      }
    } else if (userEmail) {
      result = await HubSessions.getByUserEmail(userEmail);
    } else {
      // Usar paginação por padrão para evitar timeouts
      result = await HubSessions.getAllPaginated(limitNum, skipNum);
    }
    
    if (result.success) {
      global.emitTraffic('Hub Analises', 'completed', 'Concluído - Sessões listadas com sucesso');
      global.emitLog('success', `GET /api/hub-analises/hub-sessions - ${result.count} sessões encontradas${result.hasMore !== undefined ? ` (paginação: ${result.skip}-${result.skip + result.count})` : ''}`);
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
    
    // Buscar apenas sessões ativas diretamente (otimização: evita buscar todas as sessões)
    const sessionsResult = await HubSessions.getActiveSessions();
    
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
    sessionsResult.data.forEach(session => {
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
// OTIMIZADO: Resolve problema N+1 usando busca em batch
router.get('/ciencia-por-noticia', async (req, res) => {
  try {
    global.emitTraffic('Hub Analises', 'received', 'Entrada recebida - GET /api/hub-analises/ciencia-por-noticia');
    global.emitLog('info', 'GET /api/hub-analises/ciencia-por-noticia - Processando ciência por notícia');
    
    // 1. Buscar todas as confirmações
    const acknowledgmentsResult = await VelonewsAcknowledgments.getAll();
    
    if (!acknowledgmentsResult.success) {
      global.emitTraffic('Hub Analises', 'error', 'Erro ao buscar confirmações');
      global.emitLog('error', 'GET /api/hub-analises/ciencia-por-noticia - Erro ao buscar confirmações');
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar confirmações'
      });
    }
    
    // 2. Extrair IDs únicos de notícias
    const newsIds = [...new Set(acknowledgmentsResult.data.map(a => a.newsId.toString()))];
    
    // 3. Buscar TODAS as notícias de uma vez (batch) - resolve problema N+1
    const newsMap = new Map();
    if (newsIds.length > 0) {
      const newsResult = await Velonews.getByIds(newsIds);
      if (newsResult.success) {
        newsResult.data.forEach(news => {
          newsMap.set(news._id.toString(), news);
        });
      }
    }
    
    // 4. Agrupar confirmações por newsId usando o mapa de notícias
    const groupedByNews = new Map();
    
    for (const acknowledgment of acknowledgmentsResult.data) {
      const newsId = acknowledgment.newsId.toString();
      
      if (!groupedByNews.has(newsId)) {
        // Buscar título da notícia do mapa (já carregado em batch)
        const news = newsMap.get(newsId);
        const titulo = news ? news.titulo : 'Notícia não encontrada';
        
        groupedByNews.set(newsId, {
          newsId: acknowledgment.newsId,
          titulo: titulo,
          agentes: [],
          primeiraCiencia: null,
          ultimaCiencia: null
        });
      }
      
      const grupo = groupedByNews.get(newsId);
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
    global.emitLog('success', `GET /api/hub-analises/ciencia-por-noticia - ${response.count} notícias com ciência (otimizado: batch)`);
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

