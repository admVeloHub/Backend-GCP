/**
 * VeloHub SKYNET - WhatsApp API Routes
 * VERSION: v1.3.0 | DATE: 2025-02-02 | AUTHOR: VeloHub Development Team
 * 
 * Rotas para gerenciamento e uso do WhatsApp integrado
 * Requer permissão 'whatsapp' no sistema de permissionamento
 */

const express = require('express');
const router = express.Router();
const { checkPermission } = require('../middleware/auth');

// Lazy require do baileysService para não bloquear startup se módulo não estiver disponível
let baileysService = null;
const getBaileysService = () => {
  if (!baileysService) {
    try {
      baileysService = require('../services/whatsapp/baileysService');
    } catch (error) {
      console.error('⚠️ Erro ao carregar baileysService:', error.message);
      console.error('⚠️ Funcionalidades WhatsApp não estarão disponíveis');
      baileysService = {
        error: true,
        sendMessage: async () => ({ ok: false, error: 'Serviço WhatsApp não disponível' }),
        getStatus: () => ({ connected: false, status: 'unavailable', number: null, numberFormatted: null, hasQR: false }),
        getQR: async () => ({ hasQR: false, message: 'Serviço WhatsApp não disponível' }),
        logout: async () => ({ success: false, error: 'Serviço WhatsApp não disponível' }),
        getConnectedNumber: () => ({ number: null, formatted: null, connected: false })
      };
    }
  }
  return baileysService;
};

// Middleware de autenticação para rotas de gerenciamento
// A rota /send não requer permissão pois é usada pelo VeloHub
const requireWhatsAppPermission = checkPermission('whatsapp');

/**
 * POST /api/whatsapp/send
 * Enviar mensagem via WhatsApp (para VeloHub)
 */
router.post('/send', async (req, res) => {
  try {
    const { jid, numero, mensagem, imagens, videos, cpf, solicitacao, agente } = req.body || {};
    
    // Validar entrada
    if (!mensagem && (!imagens || imagens.length === 0)) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Mensagem ou imagens são obrigatórias' 
      });
    }
    
    const destino = jid || numero;
    if (!destino) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Destino (jid ou numero) é obrigatório' 
      });
    }
    
    console.log(`[WHATSAPP API] Enviando mensagem para ${destino}...`);
    
    // Enviar mensagem via Baileys
    const service = getBaileysService();
    if (service.error) {
      return res.status(503).json({ ok: false, error: 'Serviço WhatsApp não disponível' });
    }
    const result = await service.sendMessage(
      destino,
      mensagem || '',
      Array.isArray(imagens) ? imagens : [],
      Array.isArray(videos) ? videos : []
    );
    
    if (result.ok) {
      res.json({
        ok: true,
        messageId: result.messageId,
        messageIds: result.messageIds || []
      });
    } else {
      res.status(503).json({
        ok: false,
        error: result.error || 'Erro ao enviar mensagem'
      });
    }
    
  } catch (error) {
    console.error('[WHATSAPP API] Erro ao processar envio:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/whatsapp/status
 * Obter status da conexão WhatsApp (para Console)
 * Requer permissão 'whatsapp'
 */
router.get('/status', requireWhatsAppPermission, async (req, res) => {
  try {
    const service = getBaileysService();
    if (service.error) {
      return res.status(503).json({ error: 'Serviço WhatsApp não disponível' });
    }
    const status = service.getStatus();
    
    res.json({
      connected: status.connected,
      status: status.status,
      number: status.number,
      numberFormatted: status.numberFormatted,
      hasQR: status.hasQR
    });
    
  } catch (error) {
    console.error('[WHATSAPP API] Erro ao obter status:', error);
    res.status(500).json({
      error: error.message || 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/whatsapp/qr
 * Obter QR code atual para conexão (para Console)
 * Requer permissão 'whatsapp'
 */
router.get('/qr', requireWhatsAppPermission, async (req, res) => {
  try {
    const service = getBaileysService();
    if (service.error) {
      return res.status(503).json({ hasQR: false, error: 'Serviço WhatsApp não disponível' });
    }
    const qrData = await service.getQR();
    
    if (qrData.hasQR) {
      res.json({
        hasQR: true,
        qr: qrData.qr,
        expiresIn: qrData.expiresIn
      });
    } else {
      res.json({
        hasQR: false,
        message: qrData.message || 'QR code não disponível'
      });
    }
    
  } catch (error) {
    console.error('[WHATSAPP API] Erro ao obter QR:', error);
    res.status(500).json({
      hasQR: false,
      error: error.message || 'Erro interno do servidor'
    });
  }
});

/**
 * POST /api/whatsapp/logout
 * Fazer logout e gerar novo QR code (para Console)
 * Requer permissão 'whatsapp'
 */
router.post('/logout', requireWhatsAppPermission, async (req, res) => {
  try {
    console.log('[WHATSAPP API] Logout solicitado');
    
    const service = getBaileysService();
    if (service.error) {
      return res.status(503).json({ success: false, error: 'Serviço WhatsApp não disponível' });
    }
    const result = await service.logout();
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message || 'Logout realizado. Novo QR code será gerado.'
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Erro ao fazer logout'
      });
    }
    
  } catch (error) {
    console.error('[WHATSAPP API] Erro ao fazer logout:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/whatsapp/number
 * Obter número conectado (para Console)
 * Requer permissão 'whatsapp'
 */
router.get('/number', requireWhatsAppPermission, async (req, res) => {
  try {
    const service = getBaileysService();
    if (service.error) {
      return res.status(503).json({ error: 'Serviço WhatsApp não disponível' });
    }
    const numberData = service.getConnectedNumber();
    
    res.json({
      number: numberData.number,
      formatted: numberData.formatted,
      connected: numberData.connected
    });
    
  } catch (error) {
    console.error('[WHATSAPP API] Erro ao obter número:', error);
    res.status(500).json({
      error: error.message || 'Erro interno do servidor'
    });
  }
});

module.exports = router;

