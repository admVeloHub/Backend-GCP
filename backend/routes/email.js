// VERSION: v1.3.0 | DATE: 2026-05-29 | AUTHOR: VeloHub Development Team
// CHANGELOG: v1.3.0 - Removidas rotas SMTP (/config, /test); envio exclusivamente Gmail API
// CHANGELOG: v1.2.1 - PUT /gmail-config (gmail_api): ativa envio na memória do processo
/**
 * VeloHub SKYNET - Email Service API Routes (Gmail API)
 */

const express = require('express');
const router = express.Router();
const { checkPermission } = require('../middleware/auth');
const emailService = require('../services/emailService');
const EmailTransportConfig = require('../models/EmailTransportConfig');

const requirePermission = checkPermission('whatsapp');
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get('/status', requirePermission, async (req, res) => {
  try {
    global.emitTraffic('Email', 'received', 'GET /api/email/status');
    const enabled = emailService.getEnabled();
    const gmailReady =
      typeof emailService.hasGmailMongoReady === 'function' && emailService.hasGmailMongoReady();

    let status = 'inactive';
    if (enabled && gmailReady) {
      status = 'active';
    } else if (enabled && !gmailReady) {
      status = 'error';
    }

    const response = {
      enabled,
      status,
      lastChecked: new Date(),
      gmailReady,
      transportHint: gmailReady ? 'gmail_api' : 'none'
    };

    global.emitTraffic('Email', 'completed', 'Status obtido com sucesso');
    res.json(response);
  } catch (error) {
    global.emitLog('error', `GET /api/email/status - Erro: ${error.message}`);
    res.status(500).json({
      error: 'Erro ao obter status do serviço de email',
      message: error.message
    });
  }
});

router.post('/toggle', requirePermission, async (req, res) => {
  try {
    global.emitTraffic('Email', 'received', 'POST /api/email/toggle');
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
        await emailService.reloadMongoTransportFromDb();
      }
      const readyAfterReload = emailService.hasGmailMongoReady();
      if (!readyAfterReload) {
        return res.status(400).json({
          success: false,
          error: 'Não é possível ativar: Gmail API (Mongo) não configurado'
        });
      }
    }

    emailService.setEnabled(enabled);

    res.json({
      enabled: emailService.getEnabled(),
      status: enabled && emailService.isReady() ? 'active' : 'inactive'
    });
  } catch (error) {
    global.emitLog('error', `POST /api/email/toggle - Erro: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Erro ao alterar estado do serviço de email',
      message: error.message
    });
  }
});

router.get('/gmail-config', requirePermission, async (req, res) => {
  try {
    global.emitTraffic('Email', 'received', 'GET /api/email/gmail-config');
    await emailService.reloadMongoTransportFromDb();
    const doc = await EmailTransportConfig.findSingletonLean();
    const snap = emailService.getMongoTransportSnapshotSanitized();

    res.json({
      documentId: EmailTransportConfig.SINGLETON_ID,
      transportMode: (doc && doc.transportMode) || 'gmail_api',
      defaultFromEmail: (doc && doc.defaultFromEmail) || (snap && snap.defaultFromEmail) || '',
      delegatedUserEmail: (doc && doc.delegatedUserEmail) || (snap && snap.delegatedUserEmail) || '',
      hasServiceAccount: !!(snap && snap.hasServiceAccount),
      serviceAccountClientEmail: (snap && snap.serviceAccountClientEmail) || '',
      collectionName: EmailTransportConfig.COLLECTION_NAME
    });
  } catch (error) {
    global.emitLog('error', `GET /api/email/gmail-config - ${error.message}`);
    res.status(500).json({ error: 'Erro ao obter configuração Gmail', message: error.message });
  }
});

router.put('/gmail-config', requirePermission, async (req, res) => {
  try {
    global.emitTraffic('Email', 'received', 'PUT /api/email/gmail-config');
    const {
      defaultFromEmail,
      delegatedUserEmail,
      serviceAccountJson: bodySa
    } = req.body || {};

    const prev = (await EmailTransportConfig.findSingletonLean()) || {};

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
        return res.status(400).json({
          success: false,
          error: 'JSON da conta de serviço inválido',
          message: e.message
        });
      }
    }

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
        error: 'Gmail API exige JSON da conta de serviço (client_email/private_key) ou já salvo no documento'
      });
    }

    await EmailTransportConfig.upsertSingleton({
      transportMode: 'gmail_api',
      defaultFromEmail: nextDefault,
      delegatedUserEmail: nextDelegated,
      serviceAccountJson
    });
    emailService.applyMongoTransport(await EmailTransportConfig.findSingletonLean());
    emailService.setEnabled(true);

    const snap = emailService.getMongoTransportSnapshotSanitized();
    res.json({
      success: true,
      documentId: EmailTransportConfig.SINGLETON_ID,
      transportMode: 'gmail_api',
      defaultFromEmail: nextDefault,
      delegatedUserEmail: nextDelegated,
      hasServiceAccount: !!(snap && snap.hasServiceAccount),
      serviceAccountClientEmail: (snap && snap.serviceAccountClientEmail) || ''
    });
  } catch (error) {
    global.emitLog('error', `PUT /api/email/gmail-config - ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/gmail-test', requirePermission, async (req, res) => {
  try {
    global.emitTraffic('Email', 'received', 'POST /api/email/gmail-test');
    const { to } = req.body || {};
    await emailService.reloadMongoTransportFromDb();
    await emailService.sendGmailTestMessage({ to });
    res.json({ success: true, message: 'E-mail de teste enviado (Gmail API)' });
  } catch (error) {
    global.emitLog('error', `POST /api/email/gmail-test - ${error.message}`);
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
