/**
 * VeloHub SKYNET - WhatsApp Baileys Service
 * VERSION: v1.1.4 | DATE: 2025-01-31 | AUTHOR: VeloHub Development Team
 * 
 * Serviço para gerenciamento de conexão WhatsApp via Baileys
 * Integrado ao SKYNET para uso pelo VeloHub e Console
 * Agora usa MongoDB (hub_escalacoes.auth) para persistência de credenciais
 * 
 * Mudanças v1.1.4:
 * - Corrigida limpeza de número quando há inconsistência de estado
 * - getStatus() e getConnectedNumber() agora retornam null para número quando desconectado
 * - Limpeza automática de connectedNumber e connectedNumberFormatted ao detectar inconsistência
 * 
 * Mudanças v1.1.3:
 * - Corrigida inconsistência entre getStatus() e getConnectedNumber()
 * - Ambas as funções agora usam a mesma verificação de socket para consistência
 * 
 * Mudanças v1.1.2:
 * - Melhorado tratamento de desconexão 401: só limpa credenciais se shouldReconnect=false
 * - Evita limpar credenciais em erros temporários de autenticação
 * 
 * Mudanças v1.1.1:
 * - Adicionados logs detalhados para diagnóstico de estado inconsistente
 * - Verificação adicional se socket foi encerrado antes de enviar mensagem
 */

const { default: makeWASocket, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode');
const MongoAuthAdapter = require('./mongoAuthAdapter');

// Estado global do serviço
let sock = null;
let isConnected = false;
let reconnecting = false;
let currentQR = null;
let qrImageBase64 = null;
let qrExpiresAt = null;
let connectedNumber = null;
let connectedNumberFormatted = null;
let connectionStatus = 'disconnected'; // disconnected, connecting, connected
let adapter = null; // Adapter MongoDB para credenciais

/**
 * Formatar número de telefone para exibição
 * @param {string} digits - Número apenas com dígitos
 * @returns {string} Número formatado
 */
function formatPhoneNumber(digits) {
  if (!digits || digits.length < 10) return digits;
  
  // Formato brasileiro: (XX) XXXXX-XXXX
  if (digits.length === 11 && digits.startsWith('55')) {
    const ddd = digits.substring(2, 4);
    const part1 = digits.substring(4, 9);
    const part2 = digits.substring(9);
    return `(${ddd}) ${part1}-${part2}`;
  }
  
  return digits;
}

/**
 * Conectar ao WhatsApp via Baileys
 */
async function connect() {
  if (reconnecting) {
    console.log('[WHATSAPP] Já está reconectando...');
    return;
  }
  
  reconnecting = true;
  isConnected = false;
  connectionStatus = 'connecting';
  
  try {
    console.log('[WHATSAPP] Iniciando conexão Baileys...');
    
    // Inicializar adapter MongoDB
    if (!adapter) {
      adapter = new MongoAuthAdapter();
    }
    
    // Carregar estado de autenticação do MongoDB
    const { state, saveCreds } = await adapter.loadAuthState();
    
    sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      browser: ['Chrome', 'Ubuntu', '20.04'],
      keepAliveIntervalMs: 10000,
      syncFullHistory: true,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000
    });
    
    // Listener de atualização de credenciais
    sock.ev.on('creds.update', saveCreds);
    
    // Listener de atualização de conexão
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      // Gerar QR code se disponível
      if (qr) {
        console.log('[WHATSAPP] QR Code gerado');
        currentQR = qr;
        qrExpiresAt = Date.now() + (60 * 1000); // Expira em 60 segundos
        
        // Gerar imagem base64 do QR code
        try {
          qrImageBase64 = await qrcode.toDataURL(qr);
          console.log('[WHATSAPP] QR Code imagem gerada');
        } catch (err) {
          console.error('[WHATSAPP] Erro ao gerar imagem do QR:', err.message);
          qrImageBase64 = null;
        }
      }
      
      // Conexão estabelecida
      if (connection === 'open') {
        isConnected = true;
        reconnecting = false;
        connectionStatus = 'connected';
        currentQR = null;
        qrImageBase64 = null;
        qrExpiresAt = null;
        
        // Obter número conectado
        const user = sock.user;
        if (user && user.id) {
          connectedNumber = user.id;
          const digits = connectedNumber.replace(/\D/g, '');
          connectedNumberFormatted = formatPhoneNumber(digits);
          console.log(`[WHATSAPP] ✅ Conectado! Número: ${connectedNumberFormatted || connectedNumber}`);
        }
        
        console.log('[WHATSAPP] ✅ WhatsApp conectado! API pronta!');
      }
      
      // Conexão fechada
      if (connection === 'close') {
        isConnected = false;
        connectionStatus = 'disconnected';
        connectedNumber = null;
        connectedNumberFormatted = null;
        sock = null; // Garantir que sock seja null quando desconectado
        
        const reason = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = lastDisconnect?.error?.shouldReconnect;
        console.log('[WHATSAPP] Conexão fechada. Status:', reason, 'shouldReconnect:', shouldReconnect);
        console.log('[WHATSAPP] Estado atualizado: isConnected=false, sock=null');
        
        // Verificar se foi logout real (401 = Unauthorized pode ser logout ou erro temporário)
        // DisconnectReason.loggedOut = 401, mas nem sempre significa logout permanente
        if (reason === DisconnectReason.loggedOut || reason === 401) {
          // Verificar se shouldReconnect é false (logout permanente)
          if (shouldReconnect === false) {
            console.log('[WHATSAPP] DESLOGADO PERMANENTE -> limpando credenciais do MongoDB e pedindo QR novamente...');
            try {
              if (adapter) {
                await adapter.clearAuthState();
              }
            } catch (err) {
              console.error('[WHATSAPP] Erro ao limpar credenciais do MongoDB:', err.message);
            }
          } else {
            console.log('[WHATSAPP] Erro 401 temporário -> tentando reconectar sem limpar credenciais...');
          }
        } else {
          console.log('[WHATSAPP] Desconectado (status:', reason, ') -> tentando reconectar sem pedir QR...');
        }
        
        // Reconectar após delay
        setTimeout(() => {
          reconnecting = false;
          connect();
        }, 2000);
      }
    });
    
    console.log('[WHATSAPP] Socket Baileys criado com sucesso');
    
  } catch (error) {
    console.error('[WHATSAPP] Erro ao conectar:', error);
    reconnecting = false;
    connectionStatus = 'disconnected';
    throw error;
  }
}

/**
 * Desconectar do WhatsApp
 */
async function disconnect() {
  try {
    if (sock) {
      await sock.end();
      sock = null;
    }
    isConnected = false;
    connectionStatus = 'disconnected';
    connectedNumber = null;
    connectedNumberFormatted = null;
    console.log('[WHATSAPP] Desconectado');
  } catch (error) {
    console.error('[WHATSAPP] Erro ao desconectar:', error);
    throw error;
  }
}

/**
 * Fazer logout e forçar novo QR code
 */
async function logout() {
  try {
    console.log('[WHATSAPP] Iniciando logout...');
    
    // Desconectar socket atual
    if (sock) {
      try {
        await sock.logout();
      } catch (err) {
        console.log('[WHATSAPP] Erro ao fazer logout via Baileys (pode ser normal):', err.message);
      }
      sock = null;
    }
    
    // Limpar credenciais do MongoDB
    if (adapter) {
      await adapter.clearAuthState();
    }
    
    // Limpar estado
    isConnected = false;
    connectionStatus = 'disconnected';
    connectedNumber = null;
    connectedNumberFormatted = null;
    currentQR = null;
    qrImageBase64 = null;
    qrExpiresAt = null;
    
    // Reconectar (vai gerar novo QR)
    setTimeout(() => {
      reconnecting = false;
      connect();
    }, 2000);
    
    console.log('[WHATSAPP] Logout realizado. Novo QR code será gerado.');
    
    return { success: true, message: 'Logout realizado. Novo QR code será gerado.' };
  } catch (error) {
    console.error('[WHATSAPP] Erro ao fazer logout:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Enviar mensagem via WhatsApp
 * @param {string} jid - JID do destinatário
 * @param {string} mensagem - Texto da mensagem
 * @param {Array} imagens - Array de imagens [{ data: base64, type: mimeType }]
 * @param {Array} videos - Array de vídeos (opcional)
 * @returns {Promise<Object>} { ok: boolean, messageId?: string, messageIds?: Array, error?: string }
 */
async function sendMessage(jid, mensagem, imagens = [], videos = []) {
  // Verificação detalhada do estado da conexão
  console.log(`[WHATSAPP] Verificando estado antes de enviar: isConnected=${isConnected}, sock=${!!sock}, connectionStatus=${connectionStatus}`);
  
  if (!isConnected || !sock) {
    console.error(`[WHATSAPP] Estado inconsistente: isConnected=${isConnected}, sock=${!!sock}, connectionStatus=${connectionStatus}`);
    return { ok: false, error: 'WhatsApp desconectado' };
  }
  
  // Verificar se o socket ainda está válido
  if (sock.end) {
    console.error('[WHATSAPP] Socket foi encerrado');
    isConnected = false;
    connectionStatus = 'disconnected';
    return { ok: false, error: 'WhatsApp desconectado' };
  }
  
  try {
    // Formatar JID se necessário
    let destinatario = jid;
    if (!destinatario || destinatario.length === 0) {
      return { ok: false, error: 'Destino inválido' };
    }
    
    if (!destinatario.includes('@')) {
      destinatario = destinatario.includes('-')
        ? `${destinatario}@g.us`
        : `${destinatario}@s.whatsapp.net`;
    }
    
    let messageId = null;
    const messageIds = [];
    
    // Se houver imagens, enviar a primeira com legenda; demais sem legenda
    const imgs = Array.isArray(imagens) ? imagens : [];
    if (imgs.length > 0) {
      try {
        const first = imgs[0];
        const buf = Buffer.from(String(first?.data || ''), 'base64');
        const sentFirst = await sock.sendMessage(destinatario, {
          image: buf,
          mimetype: first?.type || 'image/jpeg',
          caption: mensagem || ''
        });
        const firstId = sentFirst?.key?.id || null;
        messageId = firstId;
        if (firstId) messageIds.push(firstId);
        
        // Enviar demais imagens sem legenda
        for (let i = 1; i < imgs.length; i++) {
          const it = imgs[i];
          try {
            const b = Buffer.from(String(it?.data || ''), 'base64');
            const sentMore = await sock.sendMessage(destinatario, {
              image: b,
              mimetype: it?.type || 'image/jpeg'
            });
            const mid = sentMore?.key?.id || null;
            if (mid) messageIds.push(mid);
          } catch (ie) {
            console.log('[WHATSAPP] Falha ao enviar imagem extra:', ie?.message);
          }
        }
      } catch (imgErr) {
        console.log('[WHATSAPP] Falha envio de imagem; caindo para texto:', imgErr?.message);
      }
    }
    
    // Se não houve imagem enviada (ou falhou), enviar texto
    if (!messageId) {
      const sent = await sock.sendMessage(destinatario, { text: mensagem || '' });
      const tid = sent?.key?.id || null;
      messageId = tid;
      if (tid) messageIds.push(tid);
    }
    
    console.log('[WHATSAPP] ✅ Mensagem enviada! messageId:', messageId, 'all:', messageIds);
    
    return {
      ok: true,
      messageId: messageId,
      messageIds: messageIds
    };
    
  } catch (error) {
    console.error('[WHATSAPP] Erro ao enviar mensagem:', error);
    return { ok: false, error: error.message || 'Erro desconhecido' };
  }
}

/**
 * Obter status da conexão
 * @returns {Object} Status da conexão
 */
function getStatus() {
  // Verificar se há inconsistência entre isConnected e sock
  const actuallyConnected = isConnected && sock && !sock.end;
  
  // Se há inconsistência, corrigir o estado e limpar número
  if (isConnected && !sock) {
    console.warn('[WHATSAPP] Estado inconsistente detectado: isConnected=true mas sock=null. Corrigindo...');
    isConnected = false;
    connectionStatus = 'disconnected';
    connectedNumber = null;
    connectedNumberFormatted = null;
  }
  
  return {
    connected: actuallyConnected,
    status: actuallyConnected ? connectionStatus : 'disconnected',
    number: actuallyConnected ? connectedNumber : null,
    numberFormatted: actuallyConnected ? connectedNumberFormatted : null,
    hasQR: !!currentQR && (!qrExpiresAt || Date.now() < qrExpiresAt)
  };
}

/**
 * Obter QR code atual
 * @returns {Promise<Object>} { hasQR: boolean, qr?: string, expiresIn?: number }
 */
async function getQR() {
  if (!currentQR) {
    return { hasQR: false, message: 'WhatsApp já está conectado ou QR code não disponível' };
  }
  
  // Verificar se QR expirou
  if (qrExpiresAt && Date.now() >= qrExpiresAt) {
    return { hasQR: false, message: 'QR code expirado' };
  }
  
  const expiresIn = qrExpiresAt ? Math.floor((qrExpiresAt - Date.now()) / 1000) : 60;
  
  return {
    hasQR: true,
    qr: qrImageBase64 || currentQR,
    expiresIn: expiresIn
  };
}

/**
 * Obter número conectado
 * @returns {Object} { number: string, formatted: string, connected: boolean }
 */
function getConnectedNumber() {
  // Usar a mesma lógica de verificação do getStatus() para consistência
  const actuallyConnected = isConnected && sock && !sock.end;
  
  // Se há inconsistência, corrigir o estado e limpar número
  if (isConnected && !sock) {
    console.warn('[WHATSAPP] Estado inconsistente detectado em getConnectedNumber: isConnected=true mas sock=null. Corrigindo...');
    isConnected = false;
    connectionStatus = 'disconnected';
    connectedNumber = null;
    connectedNumberFormatted = null;
  }
  
  return {
    number: actuallyConnected ? connectedNumber : null,
    formatted: actuallyConnected ? connectedNumberFormatted : null,
    connected: actuallyConnected
  };
}

/**
 * Inicializar serviço (conectar automaticamente)
 */
async function initialize() {
  try {
    await connect();
    console.log('[WHATSAPP] Serviço inicializado');
  } catch (error) {
    console.error('[WHATSAPP] Erro ao inicializar serviço:', error);
    throw error;
  }
}

module.exports = {
  connect,
  disconnect,
  logout,
  sendMessage,
  getStatus,
  getQR,
  getConnectedNumber,
  initialize,
  // Exportar estado para debug (se necessário)
  getState: () => ({
    isConnected,
    connectionStatus,
    connectedNumber,
    connectedNumberFormatted,
    hasQR: !!currentQR
  })
};

