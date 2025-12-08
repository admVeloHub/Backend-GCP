/**
 * VeloHub SKYNET - WhatsApp API Routes
 * VERSION: v1.2.0 | DATE: 2025-02-02 | AUTHOR: VeloHub Development Team
 * 
 * Rotas para gerenciamento e uso do WhatsApp integrado
 * Requer permissão 'whatsapp' no sistema de permissionamento
 */

const express = require('express');
const router = express.Router();
const baileysService = require('../services/whatsapp/baileysService');
const { checkPermission } = require('../middleware/auth');

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
    const result = await baileysService.sendMessage(
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
    const status = baileysService.getStatus();
    
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
    const qrData = await baileysService.getQR();
    
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
    
    const result = await baileysService.logout();
    
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
    const numberData = baileysService.getConnectedNumber();
    
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

