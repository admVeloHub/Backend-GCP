/**
 * VeloHub SKYNET - WhatsApp API Routes
 * VERSION: v2.1.4 | DATE: 2025-02-11 | AUTHOR: VeloHub Development Team
 * 
 * Rotas para gerenciamento e uso do WhatsApp integrado
 * Suporta múltiplas conexões independentes (requisicoes-produto e velodesk)
 * Requer permissão 'whatsapp' no sistema de permissionamento para rotas de gerenciamento
 */

const express = require('express');
const router = express.Router();
const { checkPermission } = require('../middleware/auth');
const { MongoClient } = require('mongodb');
const { getMongoUri } = require('../config/mongodb');

// Lazy require do WhatsAppManager para não bloquear startup se módulo não estiver disponível
let whatsappManager = null;
const getWhatsAppManager = () => {
  if (!whatsappManager) {
    try {
      const { getWhatsAppManager: getManager } = require('../services/whatsapp/whatsappManager');
      whatsappManager = getManager();
    } catch (error) {
      console.error('⚠️ Erro ao carregar WhatsAppManager:', error.message);
      console.error('⚠️ Funcionalidades WhatsApp não estarão disponíveis');
      whatsappManager = {
        error: true,
        getConnection: () => ({ error: true }),
        initialize: async () => {}
      };
    }
  }
  return whatsappManager;
};

// Middleware de autenticação para rotas de gerenciamento
// Rotas /send e /react não requerem permissão (uso pelo VeloHub/VeloDesk)
// Rotas /ping e /health são públicas (health checks)
const requireWhatsAppPermission = checkPermission('whatsapp');

/**
 * Helper para serializar erro de forma segura (evita referências circulares)
 */
function serializeError(error) {
  if (!error) return 'Erro desconhecido';
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  if (error.toString && typeof error.toString === 'function') {
    try {
      return error.toString();
    } catch (e) {
      return 'Erro ao serializar exceção';
    }
  }
  return 'Erro interno do servidor';
}

/**
 * Helper para obter serviço de conexão específica
 * IMPORTANTE: Retorna a instância existente conectada, não cria nova conexão dinamicamente
 * Conexões devem ser criadas apenas no startup via WhatsAppManager.initialize()
 */
function getConnectionService(connectionId) {
  const manager = getWhatsAppManager();
  if (manager.error) {
    console.error(`[WHATSAPP API] WhatsAppManager não disponível (erro: ${manager.error})`);
    return { error: true, message: 'WhatsAppManager não disponível' };
  }
  
  try {
    // Log para debug: listar todas as conexões disponíveis
    const availableConnections = manager.listConnections ? manager.listConnections() : [];
    console.log(`[WHATSAPP API] Conexões disponíveis no manager: [${availableConnections.join(', ')}]`);
    console.log(`[WHATSAPP API] Buscando conexão: '${connectionId}'`);
    
    // Tentar obter conexão existente (criada no startup)
    if (manager.hasConnection && manager.hasConnection(connectionId)) {
      const service = manager.getConnection(connectionId);
      // Log para debug: verificar estado da conexão
      console.log(`[WHATSAPP API] ✅ Conexão '${connectionId}' encontrada. Estado: isConnected=${service.isConnected}, hasSock=${!!service.sock}, connectionStatus=${service.connectionStatus}`);
      return service;
    }
    
    // Conexão não existe - não criar dinamicamente (pode causar instâncias desconectadas)
    console.error(`[WHATSAPP API] ❌ Conexão '${connectionId}' não encontrada. Conexões disponíveis: [${availableConnections.join(', ')}]`);
    console.error(`[WHATSAPP API] Conexões devem ser inicializadas no startup do servidor.`);
    return { error: true, message: `Conexão '${connectionId}' não encontrada. Verifique se o servidor foi inicializado corretamente.` };
  } catch (error) {
    console.error(`[WHATSAPP API] Erro ao obter conexão '${connectionId}':`, serializeError(error));
    console.error(`[WHATSAPP API] Stack trace:`, error.stack);
    return { error: true, message: `Erro ao obter conexão: ${serializeError(error)}` };
  }
}

/**
 * Helper para criar rotas de uma conexão específica
 */
function createConnectionRoutes(connectionId) {
  const routes = express.Router({ mergeParams: true });

  /**
   * GET /status - Obter status da conexão
   */
  routes.get('/status', requireWhatsAppPermission, async (req, res) => {
    try {
      const service = getConnectionService(connectionId);
      if (service.error) {
        return res.status(503).json({ 
          error: service.message || 'Serviço WhatsApp não disponível',
          connected: false,
          status: 'disconnected',
          number: null,
          numberFormatted: null,
          hasQR: false
        });
      }
      
      // Garantir que getStatus() retorna apenas valores primitivos
      let status;
      try {
        status = service.getStatus();
      } catch (statusError) {
        console.error(`[WHATSAPP API:${connectionId}] Erro ao obter status do serviço:`, serializeError(statusError));
        return res.status(500).json({ 
          error: 'Erro ao obter status da conexão',
          connected: false,
          status: 'error',
          number: null,
          numberFormatted: null,
          hasQR: false
        });
      }
      
      // Garantir que apenas valores primitivos sejam serializados
      res.json({
        connected: Boolean(status?.connected),
        status: String(status?.status || 'disconnected'),
        number: status?.number || null,
        numberFormatted: status?.numberFormatted || null,
        hasQR: Boolean(status?.hasQR)
      });
    } catch (error) {
      console.error(`[WHATSAPP API:${connectionId}] Erro ao obter status:`, serializeError(error));
      res.status(500).json({ error: serializeError(error) || 'Erro interno do servidor' });
    }
  });

  /**
   * GET /qr - Obter QR code atual
   * Se QR expirou, força nova conexão automaticamente para gerar novo QR
   */
  routes.get('/qr', requireWhatsAppPermission, async (req, res) => {
    try {
      const service = getConnectionService(connectionId);
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
      console.error(`[WHATSAPP API:${connectionId}] Erro ao obter QR:`, serializeError(error));
      res.status(500).json({ hasQR: false, error: serializeError(error) || 'Erro interno do servidor' });
    }
  });

  /**
   * POST /connect - Forçar conexão/reconexão para gerar novo QR code
   */
  routes.post('/connect', requireWhatsAppPermission, async (req, res) => {
    try {
      console.log(`[WHATSAPP API:${connectionId}] Conexão/reconexão solicitada`);
      
      const service = getConnectionService(connectionId);
      if (service.error) {
        return res.status(503).json({ success: false, error: 'Serviço WhatsApp não disponível' });
      }
      
      // Se já está conectado, retornar sucesso
      const status = service.getStatus();
      if (status.connected) {
        return res.json({
          success: true,
          message: 'Já está conectado',
          connected: true
        });
      }
      
      // Resetar flag de reconexão se necessário
      if (service.reconnecting) {
        console.log(`[WHATSAPP API:${connectionId}] Resetando flag reconnecting...`);
        service.reconnecting = false;
      }
      
      // Limpar QR antigo antes de conectar
      service.currentQR = null;
      service.qrImageBase64 = null;
      service.qrExpiresAt = null;
      
      // Forçar conexão
      await service.connect();
      
      // Aguardar até QR ser gerado (máximo 10 segundos)
      let attempts = 0;
      const maxAttempts = 20; // 20 tentativas de 500ms = 10 segundos
      while (!service.currentQR && attempts < maxAttempts && !service.isConnected) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }
      
      if (service.currentQR) {
        res.json({
          success: true,
          message: 'Conexão iniciada. QR code gerado.',
          connected: false,
          hasQR: true
        });
      } else if (service.isConnected) {
        res.json({
          success: true,
          message: 'Conexão estabelecida.',
          connected: true,
          hasQR: false
        });
      } else {
        res.json({
          success: true,
          message: 'Conexão iniciada. QR code será gerado em breve. Aguarde alguns segundos.',
          connected: false,
          hasQR: false
        });
      }
    } catch (error) {
      console.error(`[WHATSAPP API:${connectionId}] Erro ao conectar:`, serializeError(error));
      res.status(500).json({ success: false, error: serializeError(error) || 'Erro interno do servidor' });
    }
  });

  /**
   * POST /logout - Fazer logout e gerar novo QR code
   */
  routes.post('/logout', requireWhatsAppPermission, async (req, res) => {
    try {
      console.log(`[WHATSAPP API:${connectionId}] Logout solicitado`);
      
      const service = getConnectionService(connectionId);
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
      console.error(`[WHATSAPP API:${connectionId}] Erro ao fazer logout:`, serializeError(error));
      res.status(500).json({ success: false, error: serializeError(error) || 'Erro interno do servidor' });
    }
  });

  /**
   * GET /number - Obter número conectado
   */
  routes.get('/number', requireWhatsAppPermission, async (req, res) => {
    try {
      const service = getConnectionService(connectionId);
      if (service.error) {
        return res.status(503).json({ 
          error: service.message || 'Serviço WhatsApp não disponível',
          number: null,
          formatted: null,
          connected: false
        });
      }
      
      // Garantir que getConnectedNumber() retorna apenas valores primitivos
      let numberData;
      try {
        numberData = service.getConnectedNumber();
      } catch (numberError) {
        console.error(`[WHATSAPP API:${connectionId}] Erro ao obter número do serviço:`, serializeError(numberError));
        return res.status(500).json({ 
          error: 'Erro ao obter número da conexão',
          number: null,
          formatted: null,
          connected: false
        });
      }
      
      // Garantir que apenas valores primitivos sejam serializados
      res.json({
        number: numberData?.number || null,
        formatted: numberData?.formatted || null,
        connected: Boolean(numberData?.connected)
      });
    } catch (error) {
      console.error(`[WHATSAPP API:${connectionId}] Erro ao obter número:`, serializeError(error));
      res.status(500).json({ error: serializeError(error) || 'Erro interno do servidor' });
    }
  });

  /**
   * POST /send - Enviar mensagem via WhatsApp
   */
  routes.post('/send', async (req, res) => {
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
      
      console.log(`[WHATSAPP API:${connectionId}] Enviando mensagem para ${destino}...`);
      
      const service = getConnectionService(connectionId);
      if (service.error) {
        console.error(`[WHATSAPP API:${connectionId}] Erro ao obter serviço:`, service.message);
        return res.status(503).json({ ok: false, error: `Serviço WhatsApp não disponível: ${service.message}` });
      }
      
      // Se está conectando e há socket, aguardar um pouco para conexão ser estabelecida
      if (service.connectionStatus === 'connecting' && service.sock && !service.isConnected) {
        console.log(`[WHATSAPP API:${connectionId}] ⏳ Conexão em progresso (connecting), aguardando até 5 segundos...`);
        const maxWait = 5000;
        const checkInterval = 200;
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
          if (service.sock && service.sock.user) {
            console.log(`[WHATSAPP API:${connectionId}] ✅ Conexão estabelecida durante espera!`);
            service.isConnected = true;
            service.connectionStatus = 'connected';
            
            const user = service.sock.user;
            if (user && user.id) {
              const digits = service._extractDigits ? service._extractDigits(user.id) : String(user.id).replace(/\D/g, '');
              service.connectedNumber = digits;
              service.connectedNumberFormatted = service._formatPhoneNumber ? service._formatPhoneNumber(digits) : digits;
            }
            break;
          }
          await new Promise(resolve => setTimeout(resolve, checkInterval));
        }
      }
      
      // Verificação adicional: se sock.user existe, considerar como conectado mesmo se isConnected=false
      if (service.sock && service.sock.user && !service.isConnected) {
        console.log(`[WHATSAPP API:${connectionId}] ⚠️ Detectado sock.user mas isConnected=false. Corrigindo estado...`);
        service.isConnected = true;
        service.connectionStatus = 'connected';
        
        const user = service.sock.user;
        if (user && user.id) {
          const digits = service._extractDigits ? service._extractDigits(user.id) : String(user.id).replace(/\D/g, '');
          service.connectedNumber = digits;
          service.connectedNumberFormatted = service._formatPhoneNumber ? service._formatPhoneNumber(digits) : digits;
        }
      }
      
      // Verificação simples como no API WHATSAPP que funciona
      if (!service.isConnected || !service.sock) {
        console.error(`[WHATSAPP API:${connectionId}] WhatsApp desconectado. isConnected: ${service.isConnected}, hasSock: ${!!service.sock}, hasSockUser: ${!!service.sock?.user}, connectionStatus: ${service.connectionStatus}`);
        return res.status(503).json({ ok: false, error: 'WhatsApp desconectado' });
      }
      
      const result = await service.sendMessage(
        destino,
        mensagem || '',
        Array.isArray(imagens) ? imagens : [],
        Array.isArray(videos) ? videos : [],
        { cpf, solicitacao, agente } // Metadados
      );
      
      if (result.ok) {
        res.json({
          ok: true,
          messageId: result.messageId,
          messageIds: result.messageIds || []
        });
      } else {
        console.error(`[WHATSAPP API:${connectionId}] Erro ao enviar mensagem:`, result.error);
        res.status(503).json({
          ok: false,
          error: result.error || 'Erro ao enviar mensagem'
        });
      }
    } catch (error) {
      console.error(`[WHATSAPP API:${connectionId}] Erro ao processar envio:`, serializeError(error));
      res.status(500).json({ ok: false, error: serializeError(error) || 'Erro interno do servidor' });
    }
  });

  /**
   * POST /react - Enviar reação ✅ programaticamente
   */
  routes.post('/react', async (req, res) => {
    try {
      const { messageId, jid, participant } = req.body || {};
      
      if (!messageId || !jid) {
        return res.status(400).json({ ok: false, error: 'messageId e jid são obrigatórios' });
      }
      
      const service = getConnectionService(connectionId);
      if (service.error) {
        return res.status(503).json({ ok: false, error: 'Serviço WhatsApp não disponível' });
      }
      
      const result = await service.react(messageId, jid, participant);
      
      if (result.ok) {
        res.json({ ok: true });
      } else {
        res.status(500).json({ ok: false, error: result.error || 'Falha ao enviar reação' });
      }
    } catch (error) {
      console.error(`[WHATSAPP API:${connectionId}] Erro ao enviar reação:`, serializeError(error));
      res.status(500).json({ ok: false, error: serializeError(error) || 'Erro interno do servidor' });
    }
  });

  /**
   * GET /grupos - Listar grupos do WhatsApp
   */
  routes.get('/grupos', requireWhatsAppPermission, async (req, res) => {
    try {
      const service = getConnectionService(connectionId);
      if (service.error) {
        return res.status(503).json({ ok: false, error: 'Serviço WhatsApp não disponível' });
      }
      
      const result = await service.getGroups();
      
      if (result.ok) {
        res.json(result.grupos || []);
      } else {
        res.status(503).json({ ok: false, error: result.error || 'Erro ao listar grupos' });
      }
    } catch (error) {
      console.error(`[WHATSAPP API:${connectionId}] Erro ao listar grupos:`, serializeError(error));
      res.status(500).json({ ok: false, error: serializeError(error) || 'Erro interno do servidor' });
    }
  });

  /**
   * GET /replies/recent - Obter replies recentes
   */
  routes.get('/replies/recent', requireWhatsAppPermission, async (req, res) => {
    try {
      const service = getConnectionService(connectionId);
      if (service.error) {
        return res.status(503).json({ error: 'Serviço WhatsApp não disponível' });
      }
      
      const agent = req.query?.agent || null;
      const replies = service.getRecentReplies(agent);
      
      res.json(replies);
    } catch (error) {
      console.error(`[WHATSAPP API:${connectionId}] Erro ao obter replies:`, serializeError(error));
      res.status(500).json({ error: serializeError(error) || 'Erro interno do servidor' });
    }
  });

  /**
   * GET /stream/replies - SSE stream de replies em tempo real
   */
  routes.get('/stream/replies', async (req, res) => {
    try {
      const service = getConnectionService(connectionId);
      if (service.error) {
        return res.status(503).json({ error: 'Serviço WhatsApp não disponível' });
      }
      
      const agent = req.query?.agent || null;
      
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();
      
      const client = { res, agent };
      service.sseClients.add(client);
      
      // Enviar estado inicial
      try {
        const initial = agent 
          ? service.getRecentReplies(agent)
          : service.getRecentReplies();
        res.write(`event: init\n` + `data: ${JSON.stringify(initial)}\n\n`);
      } catch (e) {
        console.error(`[WHATSAPP API:${connectionId}] Erro ao enviar estado inicial SSE:`, e);
      }
      
      req.on('close', () => {
        service.sseClients.delete(client);
      });
    } catch (error) {
      console.error(`[WHATSAPP API:${connectionId}] Erro ao configurar SSE:`, serializeError(error));
      res.status(500).json({ error: serializeError(error) || 'Erro interno do servidor' });
    }
  });

  /**
   * GET /ping - Health check simples
   */
  routes.get('/ping', (req, res) => {
    try {
      const service = getConnectionService(connectionId);
      const status = service.error ? 'unavailable' : (service.getStatus().connected ? 'connected' : 'disconnected');
      
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        whatsapp: status,
        connection: connectionId,
        message: 'API está ativa e funcionando'
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: serializeError(error)
      });
    }
  });

  /**
   * GET /health - Health check completo
   */
  routes.get('/health', async (req, res) => {
    try {
      const service = getConnectionService(connectionId);
      const whatsappStatus = service.error ? 'unavailable' : (service.getStatus().connected ? 'connected' : 'disconnected');
      
      const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB'
        },
        whatsapp: whatsappStatus,
        connection: connectionId,
        nodeVersion: process.version,
        platform: process.platform,
        pingEnabled: process.env.PING_ENABLED !== 'false',
        pingInterval: process.env.PING_INTERVAL || '600000'
      };
      
      res.json(health);
    } catch (error) {
      res.status(500).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: serializeError(error)
      });
    }
  });

  return routes;
}

// Criar rotas para cada conexão
router.use('/requisicoes-produto', createConnectionRoutes('requisicoes-produto'));
router.use('/velodesk', createConnectionRoutes('velodesk'));

/**
 * POST /api/whatsapp/send - Alias para compatibilidade (redireciona para requisicoes-produto)
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
    
    console.log(`[WHATSAPP API] Enviando mensagem para ${destino}... (via alias /send -> requisicoes-produto)`);
    
    const manager = getWhatsAppManager();
    console.log(`[WHATSAPP API] Manager disponível: ${!manager.error}, Conexões existentes: ${manager.listConnections ? manager.listConnections().join(', ') : 'N/A'}`);
    
    const service = getConnectionService('requisicoes-produto');
    if (service.error) {
      console.error(`[WHATSAPP API] Erro ao obter serviço:`, service.message);
      return res.status(503).json({ ok: false, error: `Serviço WhatsApp não disponível: ${service.message}` });
    }
    
    // Log detalhado do estado da conexão
    console.log(`[WHATSAPP API] Estado da conexão:`, {
      isConnected: service.isConnected,
      hasSock: !!service.sock,
      hasSockUser: !!service.sock?.user,
      connectionStatus: service.connectionStatus,
      connectedNumber: service.connectedNumber,
      wsReadyState: service.sock?.ws?.readyState
    });
    
    // Se está conectando e há socket, aguardar um pouco para conexão ser estabelecida
    // Isso resolve casos onde credenciais válidas estão sendo usadas para reconectar
    if (service.connectionStatus === 'connecting' && service.sock && !service.isConnected) {
      console.log(`[WHATSAPP API] ⏳ Conexão em progresso (connecting), aguardando até 5 segundos...`);
      const maxWait = 5000; // 5 segundos
      const checkInterval = 200; // Verificar a cada 200ms
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWait) {
        // Verificar se sock.user apareceu (indica conexão estabelecida)
        if (service.sock && service.sock.user) {
          console.log(`[WHATSAPP API] ✅ Conexão estabelecida durante espera!`);
          service.isConnected = true;
          service.connectionStatus = 'connected';
          
          const user = service.sock.user;
          if (user && user.id) {
            const digits = service._extractDigits ? service._extractDigits(user.id) : String(user.id).replace(/\D/g, '');
            service.connectedNumber = digits;
            service.connectedNumberFormatted = service._formatPhoneNumber ? service._formatPhoneNumber(digits) : digits;
          }
          break;
        }
        
        // Aguardar antes de verificar novamente
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }
      
      if (!service.isConnected) {
        console.log(`[WHATSAPP API] ⏱️ Timeout aguardando conexão (${maxWait}ms)`);
      }
    }
    
    // Verificação adicional: se sock.user existe, considerar como conectado mesmo se isConnected=false
    // Isso resolve casos onde o evento 'open' não foi disparado mas a conexão está estabelecida
    if (service.sock && service.sock.user && !service.isConnected) {
      console.log(`[WHATSAPP API] ⚠️ Detectado sock.user mas isConnected=false. Corrigindo estado...`);
      service.isConnected = true;
      service.connectionStatus = 'connected';
      
      const user = service.sock.user;
      if (user && user.id) {
        const digits = service._extractDigits ? service._extractDigits(user.id) : String(user.id).replace(/\D/g, '');
        service.connectedNumber = digits;
        service.connectedNumberFormatted = service._formatPhoneNumber ? service._formatPhoneNumber(digits) : digits;
      }
    }
    
    // Verificação simples como no API WHATSAPP que funciona
    if (!service.isConnected || !service.sock) {
      console.error(`[WHATSAPP API] WhatsApp desconectado. isConnected: ${service.isConnected}, hasSock: ${!!service.sock}, hasSockUser: ${!!service.sock?.user}, connectionStatus: ${service.connectionStatus}`);
      return res.status(503).json({ ok: false, error: 'WhatsApp desconectado' });
    }
    
    const result = await service.sendMessage(
      destino,
      mensagem || '',
      Array.isArray(imagens) ? imagens : [],
      Array.isArray(videos) ? videos : [],
      { cpf, solicitacao, agente }
    );
    
    if (result.ok) {
      res.json({
        ok: true,
        messageId: result.messageId,
        messageIds: result.messageIds || []
      });
    } else {
      console.error(`[WHATSAPP API] Erro ao enviar mensagem:`, result.error);
      res.status(503).json({
        ok: false,
        error: result.error || 'Erro ao enviar mensagem'
      });
    }
  } catch (error) {
    console.error('[WHATSAPP API] Erro ao processar envio:', serializeError(error));
    res.status(500).json({ ok: false, error: serializeError(error) || 'Erro interno do servidor' });
  }
});

/**
 * POST /api/whatsapp/credentials - Inserir/atualizar credenciais WhatsApp no MongoDB
 * Requer permissão 'whatsapp'
 */
router.post('/credentials', requireWhatsAppPermission, async (req, res) => {
  let client;
  
  try {
    global.emitTraffic('WhatsApp Credentials', 'received', 'Entrada recebida - POST /api/whatsapp/credentials');
    global.emitLog('info', 'POST /api/whatsapp/credentials - Recebendo requisição de inserção/atualização de credenciais');
    
    const { connectionType, files, version } = req.body;
    
    // OUTBOUND: Payload recebido completo (para monitoramento)
    global.emitJson({ 
      recebido: { connectionType, files: files ? Object.keys(files).length + ' arquivos' : null, version }
    });
    
    // Validações básicas
    if (!connectionType || !files) {
      global.emitTraffic('WhatsApp Credentials', 'error', 'Campos obrigatórios faltando');
      global.emitLog('error', 'POST /api/whatsapp/credentials - Campos obrigatórios faltando: connectionType ou files');
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios faltando: connectionType e files são obrigatórios'
      });
    }
    
    // Validar connectionType
    const validConnectionTypes = ['requisicoes-produto', 'velodesk'];
    if (!validConnectionTypes.includes(connectionType)) {
      global.emitTraffic('WhatsApp Credentials', 'error', `connectionType inválido: ${connectionType}`);
      global.emitLog('error', `POST /api/whatsapp/credentials - connectionType "${connectionType}" não é válido. Valores permitidos: ${validConnectionTypes.join(', ')}`);
      return res.status(400).json({
        success: false,
        error: `connectionType inválido. Valores permitidos: ${validConnectionTypes.join(', ')}`
      });
    }
    
    // Validar files (deve ser objeto não vazio)
    if (typeof files !== 'object' || Array.isArray(files) || Object.keys(files).length === 0) {
      global.emitTraffic('WhatsApp Credentials', 'error', 'files deve ser um objeto não vazio');
      global.emitLog('error', 'POST /api/whatsapp/credentials - files deve ser um objeto não vazio');
      return res.status(400).json({
        success: false,
        error: 'files deve ser um objeto não vazio contendo os arquivos de credenciais'
      });
    }
    
    // Gerar _id baseado em connectionType
    const docId = `whatsapp_baileys_auth_${connectionType}`;
    
    // Preparar documento para inserção/atualização
    const document = {
      _id: docId,
      connectionType: connectionType,
      files: files,
      updatedAt: new Date(),
      version: version || 1
    };
    
    // OUTBOUND: Documento sendo preparado para MongoDB
    global.emitJson({
      destino: 'hub_escalacoes.auth',
      documento: {
        _id: docId,
        connectionType: connectionType,
        files: `${Object.keys(files).length} arquivos`,
        version: document.version
      }
    });
    
    // Conectar ao MongoDB
    global.emitTraffic('WhatsApp Credentials', 'processing', 'Conectando ao MongoDB');
    global.emitLog('info', `POST /api/whatsapp/credentials - Conectando ao MongoDB (hub_escalacoes.auth)`);
    
    const uri = getMongoUri();
    client = new MongoClient(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    await client.connect();
    const db = client.db('hub_escalacoes');
    const collection = db.collection('auth');
    
    // Executar upsert (inserir ou atualizar)
    global.emitTraffic('WhatsApp Credentials', 'processing', 'Inserindo/atualizando credenciais no MongoDB');
    global.emitLog('info', `POST /api/whatsapp/credentials - Executando upsert em hub_escalacoes.auth com _id: ${docId}`);
    
    const result = await collection.updateOne(
      { _id: docId },
      {
        $set: document
      },
      { upsert: true }
    );
    
    // Verificar resultado
    if (!result.acknowledged) {
      throw new Error('Operação não foi reconhecida pelo MongoDB');
    }
    
    const isNewDocument = result.upsertedCount > 0;
    const action = isNewDocument ? 'inseridas' : 'atualizadas';
    
    global.emitTraffic('WhatsApp Credentials', 'completed', `Credenciais ${action} com sucesso - Connection: ${connectionType}`);
    global.emitLog('success', `POST /api/whatsapp/credentials - Credenciais ${action} com sucesso em hub_escalacoes.auth - _id: ${docId}`);
    
    // INBOUND: Resposta para o cliente
    const response = {
      success: true,
      connectionType: connectionType,
      _id: docId,
      message: `Credenciais ${action} com sucesso`,
      updatedAt: document.updatedAt,
      isNewDocument: isNewDocument
    };
    
    global.emitJsonInput(response);
    
    res.status(200).json(response);
    
  } catch (error) {
    const errorMsg = serializeError(error);
    global.emitTraffic('WhatsApp Credentials', 'error', `Erro ao salvar credenciais: ${errorMsg}`);
    global.emitLog('error', `POST /api/whatsapp/credentials - Erro: ${errorMsg}`);
    console.error('[WHATSAPP CREDENTIALS] Erro ao salvar credenciais:', errorMsg);
    
    res.status(500).json({
      success: false,
      error: errorMsg || 'Erro interno do servidor ao salvar credenciais'
    });
  } finally {
    // Fechar conexão MongoDB
    if (client) {
      try {
        await client.close();
      } catch (closeError) {
        console.error('[WHATSAPP CREDENTIALS] Erro ao fechar conexão MongoDB:', closeError);
      }
    }
  }
});

module.exports = router;
