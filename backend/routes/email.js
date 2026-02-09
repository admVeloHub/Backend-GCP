// VERSION: v1.0.0 | DATE: 2025-02-02 | AUTHOR: VeloHub Development Team
/**
 * VeloHub SKYNET - Email Service API Routes
 * 
 * Rotas para gerenciamento de serviço de email
 * Requer permissão 'whatsapp' (mesma permissão do módulo Conexões)
 */

const express = require('express');
const router = express.Router();
const { checkPermission } = require('../middleware/auth');
const emailService = require('../services/emailService');

// Middleware de autenticação
const requirePermission = checkPermission('whatsapp');

/**
 * Função auxiliar para mascarar senha
 * Mostra primeiros 2 e últimos 2 caracteres
 */
const maskPassword = (password) => {
  if (!password || password.length < 4) {
    return '***';
  }
  const first = password.substring(0, 2);
  const last = password.substring(password.length - 2);
  return `${first}***${last}`;
};

/**
 * GET /api/email/status
 * Obter status da conexão SMTP
 */
router.get('/status', requirePermission, async (req, res) => {
  try {
    global.emitTraffic('Email', 'received', 'GET /api/email/status');
    global.emitLog('info', 'GET /api/email/status - Verificando status do serviço de email');

    const enabled = emailService.getEnabled();
    const isReady = emailService.isReady();
    const config = emailService.getConfig();

    // Tentar verificar conexão se configurado
    let status = 'inactive';
    let lastChecked = null;

    if (enabled && config.host && config.auth.user && config.auth.pass) {
      try {
        const testResult = await emailService.testConnection({
          host: config.host,
          port: config.port,
          secure: config.secure,
          user: config.auth.user,
          password: config.auth.pass
        });

        if (testResult.success) {
          status = 'active';
        } else {
          status = 'error';
        }
        lastChecked = new Date();
      } catch (error) {
        status = 'error';
        lastChecked = new Date();
      }
    }

    const response = {
      enabled,
      status,
      lastChecked
    };

    global.emitTraffic('Email', 'completed', 'Status obtido com sucesso');
    global.emitJson(response);
    res.json(response);
  } catch (error) {
    global.emitTraffic('Email', 'error', 'Erro ao obter status');
    global.emitLog('error', `GET /api/email/status - Erro: ${error.message}`);
    res.status(500).json({
      error: 'Erro ao obter status do serviço de email',
      message: error.message
    });
  }
});

/**
 * GET /api/email/config
 * Obter configurações mascaradas do serviço de email
 */
router.get('/config', requirePermission, async (req, res) => {
  try {
    global.emitTraffic('Email', 'received', 'GET /api/email/config');
    global.emitLog('info', 'GET /api/email/config - Obtendo configurações');

    const config = emailService.getConfig();

    const response = {
      host: config.host || '',
      port: config.port || 587,
      user: config.auth.user || '',
      password: config.password ? maskPassword(config.password) : '',
      from: config.from || ''
    };

    global.emitTraffic('Email', 'completed', 'Configurações obtidas');
    global.emitJson({ ...response, password: '***' }); // Não logar senha real
    res.json(response);
  } catch (error) {
    global.emitTraffic('Email', 'error', 'Erro ao obter configurações');
    global.emitLog('error', `GET /api/email/config - Erro: ${error.message}`);
    res.status(500).json({
      error: 'Erro ao obter configurações do serviço de email',
      message: error.message
    });
  }
});

/**
 * POST /api/email/test
 * Testar conexão SMTP com credenciais fornecidas
 * Não salva configurações, apenas testa
 */
router.post('/test', requirePermission, async (req, res) => {
  try {
    global.emitTraffic('Email', 'received', 'POST /api/email/test');
    global.emitLog('info', 'POST /api/email/test - Testando conexão SMTP');

    const { host, port, user, password } = req.body;

    // Validação
    if (!host || !port || !user || !password) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: host, port, user, password'
      });
    }

    // Testar conexão
    const result = await emailService.testConnection({
      host,
      port: parseInt(port),
      secure: port === 465,
      user,
      password
    });

    if (result.success) {
      global.emitTraffic('Email', 'completed', 'Teste de conexão bem-sucedido');
      global.emitLog('success', 'POST /api/email/test - Conexão SMTP testada com sucesso');
    } else {
      global.emitTraffic('Email', 'error', 'Teste de conexão falhou');
      global.emitLog('error', `POST /api/email/test - ${result.message}`);
    }

    res.json(result);
  } catch (error) {
    global.emitTraffic('Email', 'error', 'Erro ao testar conexão');
    global.emitLog('error', `POST /api/email/test - Erro: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Erro ao testar conexão: ${error.message}`
    });
  }
});

/**
 * PUT /api/email/config
 * Atualizar configurações SMTP
 * Em produção, isso deve salvar no Secret Manager do GCP
 */
router.put('/config', requirePermission, async (req, res) => {
  try {
    global.emitTraffic('Email', 'received', 'PUT /api/email/config');
    global.emitLog('info', 'PUT /api/email/config - Atualizando configurações SMTP');

    const { host, port, user, password, from } = req.body;

    // Validação
    if (!host || !port || !user || !password || !from) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: host, port, user, password, from'
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(from)) {
      return res.status(400).json({
        success: false,
        error: 'Email remetente inválido'
      });
    }

    // Atualizar configuração no serviço
    emailService.updateConfig({
      host,
      port: parseInt(port),
      secure: port === 465,
      auth: {
        user,
        pass: password
      }
    }, from);

    // Reinicializar transporter
    const initialized = await emailService.initializeTransporter();

    if (!initialized) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao inicializar conexão SMTP com as novas credenciais'
      });
    }

    // Retornar configurações atualizadas (senha mascarada)
    const updatedConfig = emailService.getConfig();
    const response = {
      host: updatedConfig.host,
      port: updatedConfig.port,
      user: updatedConfig.auth.user,
      password: maskPassword(updatedConfig.auth.pass),
      from: updatedConfig.from
    };

    global.emitTraffic('Email', 'completed', 'Configurações atualizadas');
    global.emitLog('success', 'PUT /api/email/config - Configurações SMTP atualizadas com sucesso');
    global.emitJson({ ...response, password: '***' }); // Não logar senha real

    res.json(response);
  } catch (error) {
    global.emitTraffic('Email', 'error', 'Erro ao atualizar configurações');
    global.emitLog('error', `PUT /api/email/config - Erro: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Erro ao atualizar configurações do serviço de email',
      message: error.message
    });
  }
});

/**
 * POST /api/email/toggle
 * Ativar ou desativar serviço de email
 */
router.post('/toggle', requirePermission, async (req, res) => {
  try {
    global.emitTraffic('Email', 'received', 'POST /api/email/toggle');
    global.emitLog('info', 'POST /api/email/toggle - Alterando estado do serviço');

    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Campo "enabled" deve ser boolean'
      });
    }

    // Verificar se há configuração antes de ativar
    if (enabled) {
      const config = emailService.getConfig();
      if (!config.host || !config.auth.user || !config.auth.pass) {
        return res.status(400).json({
          success: false,
          error: 'Não é possível ativar o serviço: configuração SMTP incompleta'
        });
      }

      // Tentar inicializar se não estiver pronto
      if (!emailService.isReady()) {
        const initialized = await emailService.initializeTransporter();
        if (!initialized) {
          return res.status(500).json({
            success: false,
            error: 'Não é possível ativar o serviço: erro ao conectar com SMTP'
          });
        }
      }
    }

    emailService.setEnabled(enabled);

    const response = {
      enabled: emailService.getEnabled(),
      status: enabled && emailService.isReady() ? 'active' : 'inactive'
    };

    global.emitTraffic('Email', 'completed', `Serviço ${enabled ? 'ativado' : 'desativado'}`);
    global.emitLog('success', `POST /api/email/toggle - Serviço ${enabled ? 'ativado' : 'desativado'}`);
    global.emitJson(response);

    res.json(response);
  } catch (error) {
    global.emitTraffic('Email', 'error', 'Erro ao alterar estado');
    global.emitLog('error', `POST /api/email/toggle - Erro: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Erro ao alterar estado do serviço de email',
      message: error.message
    });
  }
});

module.exports = router;
