// VERSION: v1.2.1 | DATE: 2026-05-01 | AUTHOR: VeloHub Development Team
// CHANGELOG: v1.2.1 - PUT /gmail-config (gmail_api): ativa envio na memória do processo, alinhado ao PUT SMTP, para notificações de ticket
// CHANGELOG: v1.2.0 - GET/PUT /gmail-config, POST /gmail-test; status com gmailReady/transportHint; toggle aceita Gmail Mongo (sem SMTP)
// CHANGELOG: v1.1.0 - PUT /config: após SMTP válido, ativa envio automaticamente para notificações (tickets etc.) funcionarem sem segundo passo manual
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
const EmailTransportConfig = require('../models/EmailTransportConfig');

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

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * GET /api/email/status
 * Status do serviço (SMTP e/ou Gmail API via Mongo)
 */
router.get('/status', requirePermission, async (req, res) => {
  try {
    global.emitTraffic('Email', 'received', 'GET /api/email/status');
    global.emitLog('info', 'GET /api/email/status - Verificando status do serviço de email');

    const enabled = emailService.getEnabled();
    const config = emailService.getConfig();
    const gmailReady =
      typeof emailService.hasGmailMongoReady === 'function' && emailService.hasGmailMongoReady();

    let transportHint = 'none';
    if (gmailReady) transportHint = 'gmail_api';
    else if (config.host && config.auth?.user && config.auth?.pass) transportHint = 'smtp';

    let status = 'inactive';
    let lastChecked = null;

    if (enabled && gmailReady) {
      status = 'active';
      lastChecked = new Date();
    } else if (enabled && config.host && config.auth.user && config.auth.pass) {
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
      lastChecked,
      gmailReady,
      transportHint
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

    const cfg = emailService.getConfig();

    const pass = cfg.auth?.pass || cfg.password;
    const response = {
      host: cfg.host || '',
      port: cfg.port || 587,
      user: cfg.auth?.user || '',
      password: pass ? maskPassword(pass) : '',
      from: cfg.from || ''
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
      port: parseInt(port, 10),
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

    if (!emailRegex.test(from)) {
      return res.status(400).json({
        success: false,
        error: 'Email remetente inválido'
      });
    }

    // Atualizar configuração no serviço
    emailService.updateConfig(
      {
        host,
        port: parseInt(port, 10),
        secure: port === 465,
        auth: {
          user,
          pass: password
        }
      },
      from
    );

    const initialized = await emailService.initializeTransporter();

    if (!initialized) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao inicializar conexão SMTP com as novas credenciais'
      });
    }

    emailService.setEnabled(true);

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
 * Ativar ou desativar serviço de email (SMTP inicializado OU Gmail Mongo pronto)
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

    if (enabled) {
      const gmailReady =
        typeof emailService.hasGmailMongoReady === 'function' && emailService.hasGmailMongoReady();
      if (!gmailReady) {
        const config = emailService.getConfig();
        if (!config.host || !config.auth.user || !config.auth.pass) {
          return res.status(400).json({
            success: false,
            error: 'Não é possível ativar: SMTP incompleto e Gmail API (Mongo) não configurado'
          });
        }

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

/**
 * GET /api/email/gmail-config
 * Metadados do singleton Mongo console_config.email_config (_id email_tk_notifications) — sem chave privada
 */
router.get('/gmail-config', requirePermission, async (req, res) => {
  try {
    global.emitTraffic('Email', 'received', 'GET /api/email/gmail-config');
    await emailService.reloadMongoTransportFromDb();
    const doc = await EmailTransportConfig.findSingletonLean();
    const snap = emailService.getMongoTransportSnapshotSanitized();

    const payload = {
      documentId: EmailTransportConfig.SINGLETON_ID,
      transportMode: (doc && doc.transportMode) || 'gmail_api',
      defaultFromEmail: (doc && doc.defaultFromEmail) || (snap && snap.defaultFromEmail) || '',
      delegatedUserEmail: (doc && doc.delegatedUserEmail) || (snap && snap.delegatedUserEmail) || '',
      hasServiceAccount: !!(snap && snap.hasServiceAccount),
      serviceAccountClientEmail: (snap && snap.serviceAccountClientEmail) || '',
      collectionName: EmailTransportConfig.COLLECTION_NAME
    };

    global.emitJson({ ...payload });
    res.json(payload);
  } catch (error) {
    global.emitLog('error', `GET /api/email/gmail-config - ${error.message}`);
    res.status(500).json({ error: 'Erro ao obter configuração Gmail', message: error.message });
  }
});

/**
 * PUT /api/email/gmail-config
 */
router.put('/gmail-config', requirePermission, async (req, res) => {
  try {
    global.emitTraffic('Email', 'received', 'PUT /api/email/gmail-config');
    const {
      transportMode,
      defaultFromEmail,
      delegatedUserEmail,
      serviceAccountJson: bodySa
    } = req.body || {};

    if (transportMode && !['gmail_api', 'smtp'].includes(transportMode)) {
      return res.status(400).json({ success: false, error: 'transportMode deve ser gmail_api ou smtp' });
    }

    const prev = (await EmailTransportConfig.findSingletonLean()) || {};

    const nextMode = transportMode || prev.transportMode || 'gmail_api';
    let nextDefault =
      typeof defaultFromEmail === 'string'
        ? defaultFromEmail.trim().toLowerCase()
        : prev.defaultFromEmail || '';
    let nextDelegated =
      typeof delegatedUserEmail === 'string'
        ? delegatedUserEmail.trim().toLowerCase()
        : prev.delegatedUserEmail || '';

    let serviceAccountJson = prev.serviceAccountJson || null;
    if (bodySa !== undefined && bodySa !== null && String(bodySa).trim() !== '') {
      try {
        serviceAccountJson = typeof bodySa === 'string' ? JSON.parse(bodySa) : bodySa;
      } catch (e) {
        return res
          .status(400)
          .json({ success: false, error: 'JSON da conta de serviço inválido', message: e.message });
      }
    }

    if (nextMode === 'gmail_api') {
      if (!nextDefault || !emailRegex.test(nextDefault)) {
        return res.status(400).json({ success: false, error: 'Informe um e-mail remetente (From) válido' });
      }
      const del = nextDelegated || nextDefault;
      if (!emailRegex.test(del)) {
        return res.status(400).json({ success: false, error: 'E-mail delegado inválido' });
      }
      nextDelegated = del;
      if (!serviceAccountJson || !serviceAccountJson.private_key || !serviceAccountJson.client_email) {
        return res.status(400).json({
          success: false,
          error:
            'Modo gmail_api exige JSON da conta de serviço (client_email/private_key) ou já salvo no mesmo documento'
        });
      }
    }

    await EmailTransportConfig.upsertSingleton({
      transportMode: nextMode,
      defaultFromEmail: nextMode === 'smtp' ? nextDefault || '' : nextDefault,
      delegatedUserEmail: nextMode === 'smtp' ? '' : nextDelegated,
      serviceAccountJson: nextMode === 'smtp' ? null : serviceAccountJson
    });
    emailService.applyMongoTransport(await EmailTransportConfig.findSingletonLean());
    if (nextMode === 'gmail_api') {
      emailService.setEnabled(true);
    }
    global.emitLog('success', 'PUT /api/email/gmail-config - OK');

    const snap = emailService.getMongoTransportSnapshotSanitized();
    res.json({
      success: true,
      documentId: EmailTransportConfig.SINGLETON_ID,
      transportMode: nextMode,
      defaultFromEmail: nextDefault,
      delegatedUserEmail: nextDelegated || nextDefault,
      hasServiceAccount: !!(snap && snap.hasServiceAccount),
      serviceAccountClientEmail: (snap && snap.serviceAccountClientEmail) || ''
    });
  } catch (error) {
    global.emitLog('error', `PUT /api/email/gmail-config - ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/email/gmail-test
 */
router.post('/gmail-test', requirePermission, async (req, res) => {
  try {
    global.emitTraffic('Email', 'received', 'POST /api/email/gmail-test');
    const { to } = req.body || {};
    await emailService.reloadMongoTransportFromDb();
    await emailService.sendGmailTestMessage({ to });
    global.emitTraffic('Email', 'completed', 'POST /api/email/gmail-test OK');
    res.json({ success: true, message: 'E-mail de teste enviado (Gmail API)' });
  } catch (error) {
    global.emitLog('error', `POST /api/email/gmail-test - ${error.message}`);
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
