// VERSION: v1.0.1 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team
const express = require('express');
const router = express.Router();
const TkConteudos = require('../models/TkConteudos');
const TkGestao = require('../models/TkGestao');

// POST /api/user-ping - Ping do usuário logado para obter dados
router.post('/', async (req, res) => {
  try {
    const { _userId, _collectionId } = req.body;
    
    global.emitTraffic('UserPing', 'received', `Ping recebido - UserId: ${_userId}, CollectionId: ${_collectionId}`);
    global.emitLog('info', `POST /api/user-ping - Usuário ${_userId} solicitando dados`);
    global.emitJson({ _userId, _collectionId });
    
    // Validar dados obrigatórios
    if (!_userId) {
      global.emitTraffic('UserPing', 'error', 'UserId é obrigatório');
      global.emitLog('error', 'POST /api/user-ping - UserId não fornecido');
      return res.status(400).json({
        success: false,
        error: 'UserId é obrigatório'
      });
    }
    
    global.emitTraffic('UserPing', 'processing', `Coletando dados para collectionId: ${_collectionId}`);
    
    let responseData = {
      success: true,
      data: {},
      permissions: {
        userId: _userId,
        collectionId: _collectionId,
        lastUpdate: new Date().toISOString()
      },
      timestamp: new Date().toISOString(),
      counts: {}
    };

    // Verificar se usuário tem permissão (collectionId não é 'null')
    if (_collectionId === 'null') {
      global.emitTraffic('UserPing', 'completed', 'Usuário sem permissão - nenhum dado enviado');
      global.emitLog('info', `POST /api/user-ping - Usuário ${_userId} sem permissão para nenhuma collection`);
      
      const noPermissionResponse = {
        success: true,
        data: {},
        permissions: {
          userId: _userId,
          collectionId: 'null',
          canViewTkConteudos: false,
          canViewTkGestao: false,
          lastUpdate: new Date().toISOString()
        },
        timestamp: new Date().toISOString(),
        counts: {},
        message: 'Usuário sem permissão para acessar collections'
      };
      
      global.emitJson(noPermissionResponse);
      return res.json(noPermissionResponse);
    }

    // Determinar quais collections buscar baseado no _collectionId
    switch (_collectionId) {
      case 'tk_conteudos':
        global.emitLog('info', 'Coletando apenas dados de tk_conteudos');
        const tkConteudosResult = await TkConteudos.getAll();
        responseData.data = {
          tk_conteudos: tkConteudosResult.success ? tkConteudosResult.data : []
        };
        responseData.counts = {
          tk_conteudos: tkConteudosResult.success ? tkConteudosResult.count : 0
        };
        responseData.permissions.canViewTkConteudos = true;
        responseData.permissions.canViewTkGestao = false;
        break;

      case 'tk_gestão':
        global.emitLog('info', 'Coletando apenas dados de tk_gestão');
        const tkGestaoResult = await TkGestao.getAll();
        responseData.data = {
          tk_gestao: tkGestaoResult.success ? tkGestaoResult.data : []
        };
        responseData.counts = {
          tk_gestao: tkGestaoResult.success ? tkGestaoResult.count : 0
        };
        responseData.permissions.canViewTkConteudos = false;
        responseData.permissions.canViewTkGestao = true;
        break;

      case 'console_chamados':
        global.emitLog('info', 'Coletando dados de ambas as collections (tk_conteudos e tk_gestão)');
        const [tkConteudosResultAll, tkGestaoResultAll] = await Promise.all([
          TkConteudos.getAll(),
          TkGestao.getAll()
        ]);
        responseData.data = {
          tk_conteudos: tkConteudosResultAll.success ? tkConteudosResultAll.data : [],
          tk_gestao: tkGestaoResultAll.success ? tkGestaoResultAll.data : []
        };
        responseData.counts = {
          tk_conteudos: tkConteudosResultAll.success ? tkConteudosResultAll.count : 0,
          tk_gestao: tkGestaoResultAll.success ? tkGestaoResultAll.count : 0
        };
        responseData.permissions.canViewTkConteudos = true;
        responseData.permissions.canViewTkGestao = true;
        break;

      default:
        global.emitTraffic('UserPing', 'error', `CollectionId inválido: ${_collectionId}`);
        global.emitLog('error', `POST /api/user-ping - CollectionId inválido: ${_collectionId}`);
        return res.status(400).json({
          success: false,
          error: 'CollectionId deve ser: tk_conteudos, tk_gestão, console_chamados ou null',
          validOptions: ['tk_conteudos', 'tk_gestão', 'console_chamados', 'null'],
          timestamp: new Date().toISOString()
        });
    }
    
    // Criar mensagem dinâmica baseada no tipo de dados
    let logMessage = `POST /api/user-ping - Dados enviados para usuário ${_userId}`;
    let trafficMessage = 'Dados enviados';
    
    if (_collectionId === 'tk_conteudos') {
      trafficMessage = `${responseData.counts.tk_conteudos} conteúdos enviados`;
    } else if (_collectionId === 'tk_gestão') {
      trafficMessage = `${responseData.counts.tk_gestao} gestões enviadas`;
    } else if (_collectionId === 'console_chamados') {
      trafficMessage = `${responseData.counts.tk_conteudos} conteúdos, ${responseData.counts.tk_gestao} gestões enviadas`;
    }
    
    global.emitTraffic('UserPing', 'completed', trafficMessage);
    global.emitLog('success', logMessage);
    global.emitJson(responseData);
    
    res.json(responseData);
    
  } catch (error) {
    global.emitTraffic('UserPing', 'error', 'Erro interno do servidor');
    global.emitLog('error', `POST /api/user-ping - Erro: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/user-ping/status - Verificar status do sistema
router.get('/status', async (req, res) => {
  try {
    global.emitTraffic('UserPing', 'received', 'Status check solicitado');
    global.emitLog('info', 'GET /api/user-ping/status - Verificando status');
    
    // Verificar conectividade com as collections
    const [tkConteudosCount, tkGestaoCount] = await Promise.all([
      TkConteudos.count(),
      TkGestao.count()
    ]);
    
    const status = {
      success: true,
      status: 'OK',
      collections: {
        tk_conteudos: {
          connected: tkConteudosCount.success,
          count: tkConteudosCount.success ? tkConteudosCount.count : 0
        },
        tk_gestao: {
          connected: tkGestaoCount.success,
          count: tkGestaoCount.success ? tkGestaoCount.count : 0
        }
      },
      timestamp: new Date().toISOString()
    };
    
    global.emitTraffic('UserPing', 'completed', 'Status verificado');
    global.emitLog('success', 'GET /api/user-ping/status - Status OK');
    global.emitJson(status);
    
    res.json(status);
    
  } catch (error) {
    global.emitTraffic('UserPing', 'error', 'Erro ao verificar status');
    global.emitLog('error', `GET /api/user-ping/status - Erro: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
