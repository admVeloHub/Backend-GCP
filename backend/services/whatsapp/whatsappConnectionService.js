/**
 * VeloHub SKYNET - WhatsApp Connection Service
 * VERSION: v2.0.7 | DATE: 2025-02-11 | AUTHOR: VeloHub Development Team
 * 
 * Serviço genérico para gerenciamento de conexão WhatsApp via Baileys
 * Suporta múltiplas conexões independentes
 * Integra funcionalidades da API WHATSAPP (reações, replies, grupos, health checks)
 * 
 * Mudanças v2.0.6:
 * - CORRIGIDO LOOP INFINITO: Erro 401 (não autorizado) NÃO reconecta automaticamente
 * - Quando recebe 401, limpa credenciais e para - permite gerar novo QR manualmente
 * - Prevenção de múltiplas conexões simultâneas: verifica flag reconnecting antes de conectar
 * - Timeout de reconexão reduzido de 30s para 10s para evitar travamentos
 * - Delay de reconexão aumentado para 3 segundos para outros erros (não 401)
 * - Logs melhorados para identificar problemas de reconexão
 * 
 * Mudanças v2.0.5:
 * - ELIMINAÇÃO DE DESCONEXÕES AUTOMÁTICAS: Reconexão automática imediata quando detecta desconexão
 * - Se desconectar automaticamente (não manual), reconecta imediatamente após 1 segundo
 * - Mantém conexão sempre ativa - desconexões automáticas são eliminadas via reconexão
 * - Desconexões manuais (via disconnect() ou logout()) não reconectam automaticamente
 * - Proteção contra loop infinito: verifica manualDisconnect antes de reconectar
 * - Delay progressivo em caso de falha na reconexão (1s primeira tentativa, 5s segunda)
 * 
 * Mudanças v2.0.4:
 * - PREVENÇÃO DE DESCONEXÕES AUTOMÁTICAS: Configurações otimizadas para manter conexão ativa
 * - keepAliveIntervalMs aumentado para 30s (antes 10s) para manter conexão mais ativa
 * - syncFullHistory desabilitado para reduzir carga e evitar desconexões
 * - Timeouts aumentados: connectTimeoutMs e defaultQueryTimeoutMs para 120s (antes 60s)
 * - Adicionado tratamento de erros no socket que não causa desconexão
 * - Logs detalhados quando desconexões automáticas ocorrem (para diagnóstico)
 * - getMessage retorna undefined para evitar erros que causam desconexão
 * - generateHighQualityLinkPreview desabilitado para reduzir carga
 * 
 * Mudanças v2.0.3:
 * - REMOVIDA reconexão automática: conexão permanece até desconexão manual
 * - Adicionada flag manualDisconnect para controlar desconexões manuais vs automáticas
 * - Desconexões automáticas (evento 'close') não reconectam mais automaticamente
 * - Métodos disconnect() e logout() não reconectam mais automaticamente
 * - Conexão deve ser iniciada manualmente via connect() após qualquer desconexão
 * - Mantido keepAlive para evitar desconexões por inatividade
 * 
 * Mudanças v2.0.2:
 * - Corrigido armazenamento de número conectado: agora armazena apenas dígitos extraídos (sem :72@s.whatsapp.net)
 * - Adicionada verificação de WebSocket readyState antes de enviar mensagens
 * - Corrigido retorno de sendMessage: agora retorna erro se messageId for null
 * - Melhorados logs de diagnóstico para envio de mensagens
 * 
 * Mudanças v2.0.1:
 * - Corrigida função _extractDigits() para extrair corretamente número do JID
 * - Agora extrai apenas a parte antes de : ou @ antes de extrair dígitos
 * - Corrigida extração de número quando user.id vem como "5515997995634:72@s.whatsapp.net"
 * - Função agora suporta tanto string JID quanto objeto com participant/remoteJid
 */

const { default: makeWASocket, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode');
const MongoAuthAdapter = require('./mongoAuthAdapter');

class WhatsAppConnectionService {
  constructor(connectionId, options = {}) {
    this.connectionId = connectionId;
    this.sock = null;
    this.isConnected = false;
    this.reconnecting = false;
    this.reconnectStartTime = null; // Timestamp do início da reconexão
    this.manualDisconnect = false; // Flag para indicar se desconexão foi manual
    this.currentQR = null;
    this.qrImageBase64 = null;
    this.qrExpiresAt = null;
    this.connectedNumber = null;
    this.connectedNumberFormatted = null;
    this.connectionStatus = 'disconnected'; // disconnected, connecting, connected
    this.adapter = new MongoAuthAdapter(connectionId);
    
    // Estado para sistema de reações e replies
    this.metaByMessageId = new Map(); // messageId -> { cpf, solicitacao, agente, timestamp }
    this.recentReplies = []; // Ring buffer de replies
    this.recentMax = 200;
    this.sseClients = new Set(); // Clientes SSE conectados { res, agent }
    this.listenersSetup = false; // Flag para evitar listeners duplicados
    
    // Configurações de callbacks e autorização
    this.authorizedReactors = options.authorizedReactors || this._getAuthorizedReactorsFromEnv();
    this.reactionCallbackUrl = options.reactionCallbackUrl || this._getReactionCallbackUrl();
    this.replyCallbackUrl = options.replyCallbackUrl || this._getReplyCallbackUrl();
    this.panelBypassSecret = options.panelBypassSecret || process.env.PANEL_BYPASS_SECRET || process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '';
    this.repliesStreamEnabled = options.repliesStreamEnabled !== undefined 
      ? options.repliesStreamEnabled 
      : String(process.env.REPLIES_STREAM_ENABLED || '0') === '1';
  }

  /**
   * Obter lista de números autorizados para reações do ambiente
   */
  _getAuthorizedReactorsFromEnv() {
    const raw = process.env.AUTHORIZED_REACTORS || process.env.AUTHORIZED_REACTION_NUMBER || '';
    return raw.split(',').map((s) => s.replace(/\D/g, '')).filter(Boolean);
  }

  /**
   * Obter URL de callback para reações do ambiente
   */
  _getReactionCallbackUrl() {
    const PANEL_URL = (process.env.PANEL_URL || process.env.PAINEL_URL || '').replace(/\/$/, '');
    const BACKEND_URL = process.env.BACKEND_URL || process.env.VELOHUB_BACKEND_URL || 'https://velohub-278491073220.us-east1.run.app';
    return PANEL_URL
      ? `${PANEL_URL}/api/requests/auto-status`
      : `${BACKEND_URL}/api/escalacoes/solicitacoes/auto-status`;
  }

  /**
   * Obter URL de callback para replies do ambiente
   */
  _getReplyCallbackUrl() {
    const PANEL_URL = (process.env.PANEL_URL || process.env.PAINEL_URL || '').replace(/\/$/, '');
    return PANEL_URL ? `${PANEL_URL}/api/requests/reply` : null;
  }

  /**
   * Headers para bypass de proteção Vercel
   */
  _getPanelHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.panelBypassSecret) {
      headers['x-vercel-protection-bypass'] = this.panelBypassSecret;
    }
    return headers;
  }

  /**
   * Normalizar string (lowercase, trim, espaços)
   */
  _norm(s = '') {
    return String(s).toLowerCase().trim().replace(/\s+/g, ' ');
  }

  /**
   * Extrair número do JID corretamente
   * Extrai apenas a parte antes de : ou @ e então os dígitos dessa parte
   * Exemplo: "5515997995634:72@s.whatsapp.net" -> "5515997995634"
   * @param {string|Object} key - JID completo ou objeto com participant/remoteJid
   * @returns {string} Número apenas com dígitos
   */
  _extractDigits(key) {
    let jid = '';
    if (typeof key === 'string') {
      jid = key;
    } else if (key && typeof key === 'object') {
      jid = key?.participant || key?.remoteJid || '';
    }
    
    if (!jid || typeof jid !== 'string') return '';
    
    // Extrair parte antes de : ou @
    const beforeSeparator = jid.split(':')[0].split('@')[0];
    
    // Extrair apenas dígitos dessa parte
    return String(beforeSeparator || '').replace(/\D/g, '');
  }

  /**
   * Verificar se reator está autorizado
   */
  _isReactorAllowed(reactorDigits) {
    if (this.authorizedReactors.length === 0) return true;
    return reactorDigits && this.authorizedReactors.includes(reactorDigits);
  }

  /**
   * Formatar número de telefone para exibição
   */
  _formatPhoneNumber(digits) {
    if (!digits || digits.length < 10) return digits;
    
    // Formato brasileiro com código do país (13 dígitos: 55 + DDD + número)
    // Exemplo: 5515997995634 -> (15) 99799-5634
    if (digits.length === 13 && digits.startsWith('55')) {
      const ddd = digits.substring(2, 4);
      const part1 = digits.substring(4, 9);
      const part2 = digits.substring(9);
      return `(${ddd}) ${part1}-${part2}`;
    }
    
    // Formato brasileiro sem código do país (11 dígitos: DDD + número)
    // Exemplo: 15997995634 -> (15) 99799-5634
    if (digits.length === 11) {
      const ddd = digits.substring(0, 2);
      const part1 = digits.substring(2, 7);
      const part2 = digits.substring(7);
      return `(${ddd}) ${part1}-${part2}`;
    }
    
    return digits;
  }

  /**
   * Conectar ao WhatsApp via Baileys
   */
  async connect() {
    // Se já está conectado, não fazer nada
    if (this.isConnected && this.sock) {
      console.log(`[WHATSAPP:${this.connectionId}] Já está conectado, não precisa reconectar.`);
      return;
    }
    
    // PREVENIR MÚLTIPLAS CONEXÕES SIMULTÂNEAS
    if (this.reconnecting) {
      const reconnectStartTime = this.reconnectStartTime || Date.now();
      const elapsed = Date.now() - reconnectStartTime;
      if (elapsed > 10000) {
        // Se está reconectando há mais de 10 segundos, resetar flag (pode estar travado)
        console.log(`[WHATSAPP:${this.connectionId}] Resetando flag reconnecting após ${elapsed}ms (possível travamento)...`);
        this.reconnecting = false;
      } else {
        console.log(`[WHATSAPP:${this.connectionId}] Já está reconectando (há ${elapsed}ms) - aguardando...`);
        return; // Não iniciar nova conexão se já está reconectando
      }
    }
    
    // Reset flag de desconexão manual ao iniciar nova conexão
    this.manualDisconnect = false;
    this.reconnecting = true;
    this.reconnectStartTime = Date.now();
    this.isConnected = false;
    this.connectionStatus = 'connecting';
    
    try {
      console.log(`[WHATSAPP:${this.connectionId}] Iniciando conexão Baileys...`);
      
      // Carregar estado de autenticação do MongoDB
      const { state, saveCreds } = await this.adapter.loadAuthState();
      
      this.sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Chrome', 'Ubuntu', '20.04'],
        keepAliveIntervalMs: 30000, // Aumentado para 30s para manter conexão mais ativa
        syncFullHistory: false, // Desabilitado para reduzir carga e evitar desconexões
        connectTimeoutMs: 120000, // Aumentado para 120s
        defaultQueryTimeoutMs: 120000, // Aumentado para 120s
        retryRequestDelayMs: 5000, // Delay entre tentativas de requisição
        markOnlineOnConnect: true, // Marcar como online ao conectar
        generateHighQualityLinkPreview: false, // Reduzir carga
        getMessage: async (key) => {
          // Retornar undefined para evitar erros que causam desconexão
          return undefined;
        }
      });
      
      // Listener de atualização de credenciais
      this.sock.ev.on('creds.update', saveCreds);
      
      // Tratamento de erros para evitar desconexões automáticas
      this.sock.ev.on('error', (error) => {
        console.error(`[WHATSAPP:${this.connectionId}] ⚠️ Erro no socket (não deve causar desconexão):`, error?.message || error);
        // Não fazer nada - apenas logar o erro
        // O Baileys deve tentar recuperar automaticamente sem desconectar
      });
      
      // Listener de atualização de conexão
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        // Log para debug: verificar todos os estados de conexão
        if (connection) {
          console.log(`[WHATSAPP:${this.connectionId}] 🔄 connection.update: ${connection}`);
        }
        
        // Verificar se já está conectado mesmo sem evento 'open' (pode acontecer com credenciais válidas)
        // Isso é uma verificação adicional para garantir que detectamos conexões estabelecidas
        if (this.sock && this.sock.user && !this.isConnected) {
          console.log(`[WHATSAPP:${this.connectionId}] ⚠️ Detectado sock.user mas isConnected=false. Corrigindo estado...`);
          this.isConnected = true;
          this.reconnecting = false;
          this.connectionStatus = 'connected';
          
          const user = this.sock.user;
          if (user && user.id) {
            const digits = this._extractDigits(user.id);
            this.connectedNumber = digits;
            this.connectedNumberFormatted = this._formatPhoneNumber(digits);
            console.log(`[WHATSAPP:${this.connectionId}] ✅ Conectado! Número: ${this.connectedNumberFormatted}`);
          }
          
          // Configurar listeners se ainda não foram configurados
          if (!this.listenersSetup) {
            this.setupReactionListeners();
            this.setupReplyListeners();
            this.listenersSetup = true;
          }
        }
        
        // Gerar QR code se disponível (apenas se ainda não tem QR válido)
        if (qr) {
          // Verificar se já tem QR válido para evitar regeneração desnecessária
          const hasValidQR = this.currentQR && this.qrExpiresAt && Date.now() < this.qrExpiresAt;
          
          if (!hasValidQR) {
            console.log(`[WHATSAPP:${this.connectionId}] QR Code gerado`);
            this.currentQR = qr;
            this.qrExpiresAt = Date.now() + (60 * 1000); // Expira em 60 segundos
            
            // Gerar imagem base64 do QR code
            try {
              this.qrImageBase64 = await qrcode.toDataURL(qr);
              console.log(`[WHATSAPP:${this.connectionId}] QR Code imagem gerada`);
            } catch (err) {
              console.error(`[WHATSAPP:${this.connectionId}] Erro ao gerar imagem do QR:`, err.message);
              this.qrImageBase64 = null;
            }
          } else {
            console.log(`[WHATSAPP:${this.connectionId}] QR Code já existe e é válido, ignorando novo QR do Baileys`);
          }
        }
        
        // Conexão estabelecida
        if (connection === 'open') {
          this.isConnected = true;
          this.reconnecting = false;
          this.connectionStatus = 'connected';
          this.currentQR = null;
          this.qrImageBase64 = null;
          this.qrExpiresAt = null;
          
          // Obter número conectado
          const user = this.sock.user;
          if (user && user.id) {
            // Extrair apenas os dígitos do número (remover :72@s.whatsapp.net)
            const digits = this._extractDigits(user.id);
            this.connectedNumber = digits; // Armazenar apenas os dígitos
            this.connectedNumberFormatted = this._formatPhoneNumber(digits);
            console.log(`[WHATSAPP:${this.connectionId}] ✅ Conectado! Número bruto: ${user.id}, Extraído: ${digits}, Formatado: ${this.connectedNumberFormatted}`);
          }
          
          console.log(`[WHATSAPP:${this.connectionId}] ✅ WhatsApp conectado! API pronta!`);
          
          // Configurar listeners de reações e replies após conexão (apenas uma vez)
          if (!this.listenersSetup) {
            this.setupReactionListeners();
            this.setupReplyListeners();
            this.listenersSetup = true;
          }
        }
        
        // Conexão fechada - PREVENIR LOOP INFINITO DE RECONEXÃO
        if (connection === 'close') {
          const reason = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = lastDisconnect?.error?.shouldReconnect;
          const errorMessage = lastDisconnect?.error?.message || '';
          
          // Verificar se foi desconexão manual
          if (this.manualDisconnect) {
            console.log(`[WHATSAPP:${this.connectionId}] Desconexão manual confirmada - encerrando conexão.`);
            this.isConnected = false;
            this.connectionStatus = 'disconnected';
            this.connectedNumber = null;
            this.connectedNumberFormatted = null;
            this.sock = null;
            this.listenersSetup = false;
            this.reconnecting = false;
            return; // Sair sem reconectar
          }
          
          // Atualizar estado para desconectado (já está desconectado pelo Baileys)
          this.isConnected = false;
          this.connectionStatus = 'disconnected';
          this.connectedNumber = null;
          this.connectedNumberFormatted = null;
          this.sock = null;
          this.listenersSetup = false;
          this.reconnecting = false; // IMPORTANTE: Resetar flag para evitar loop
          
          // Verificar se foi erro 401 (não autorizado) - NÃO RECONECTAR AUTOMATICAMENTE
          if (reason === DisconnectReason.loggedOut || reason === 401) {
            console.error(`[WHATSAPP:${this.connectionId}] ❌ Erro 401 (não autorizado) detectado. Credenciais inválidas ou expiradas.`);
            console.error(`[WHATSAPP:${this.connectionId}] NÃO reconectando automaticamente - limpe credenciais e gere novo QR manualmente.`);
            
            // Limpar credenciais para permitir novo QR
            try {
              await this.adapter.clearAuthState();
              console.log(`[WHATSAPP:${this.connectionId}] Credenciais limpas. Novo QR será gerado na próxima conexão manual.`);
            } catch (err) {
              console.error(`[WHATSAPP:${this.connectionId}] Erro ao limpar credenciais:`, err.message);
            }
            
            // NÃO reconectar automaticamente - parar aqui
            return;
          }
          
          // Para outros erros (não 401), reconectar após delay
          console.warn(`[WHATSAPP:${this.connectionId}] ⚠️ Desconexão automática detectada (${reason}). Reconectando após delay...`);
          console.warn(`[WHATSAPP:${this.connectionId}] Erro:`, errorMessage);
          
          // Delay antes de reconectar para evitar loop infinito
          setTimeout(() => {
            if (!this.manualDisconnect && !this.reconnecting) {
              console.log(`[WHATSAPP:${this.connectionId}] Reconectando automaticamente...`);
              this.reconnecting = false; // Reset flag antes de reconectar
              this.connect().catch(err => {
                console.error(`[WHATSAPP:${this.connectionId}] Erro ao reconectar automaticamente:`, err.message);
                this.reconnecting = false; // Reset flag em caso de erro
              });
            }
          }, 3000); // Delay de 3 segundos antes de reconectar
        }
      });
      
      console.log(`[WHATSAPP:${this.connectionId}] Socket Baileys criado com sucesso`);
      
    } catch (error) {
      console.error(`[WHATSAPP:${this.connectionId}] Erro ao conectar:`, error);
      this.reconnecting = false;
      this.connectionStatus = 'disconnected';
      throw error;
    }
  }

  /**
   * Desconectar do WhatsApp
   */
  async disconnect() {
    try {
      // Marcar como desconexão manual
      this.manualDisconnect = true;
      
      if (this.sock) {
        await this.sock.end();
        this.sock = null;
      }
      this.isConnected = false;
      this.connectionStatus = 'disconnected';
      this.connectedNumber = null;
      this.connectedNumberFormatted = null;
      this.listenersSetup = false; // Reset flag para próxima conexão
      this.reconnecting = false;
      console.log(`[WHATSAPP:${this.connectionId}] Desconectado manualmente. Para reconectar, use o método connect() manualmente.`);
    } catch (error) {
      console.error(`[WHATSAPP:${this.connectionId}] Erro ao desconectar:`, error);
      throw error;
    }
  }

  /**
   * Fazer logout e forçar novo QR code
   */
  async logout() {
    try {
      console.log(`[WHATSAPP:${this.connectionId}] Iniciando logout...`);
      
      // Marcar como desconexão manual
      this.manualDisconnect = true;
      
      // Desconectar socket atual
      if (this.sock) {
        try {
          await this.sock.logout();
        } catch (err) {
          console.log(`[WHATSAPP:${this.connectionId}] Erro ao fazer logout via Baileys (pode ser normal):`, err.message);
        }
        this.sock = null;
      }
      
      // Limpar credenciais do MongoDB
      await this.adapter.clearAuthState();
      
      // Limpar estado
      this.isConnected = false;
      this.connectionStatus = 'disconnected';
      this.connectedNumber = null;
      this.connectedNumberFormatted = null;
      this.currentQR = null;
      this.qrImageBase64 = null;
      this.qrExpiresAt = null;
      this.listenersSetup = false; // Reset flag para próxima conexão
      this.reconnecting = false;
      
      // NÃO reconectar automaticamente - usuário deve chamar connect() manualmente
      console.log(`[WHATSAPP:${this.connectionId}] Logout realizado. Para reconectar, use o método connect() manualmente.`);
      
      return { success: true, message: 'Logout realizado. Para reconectar, use o método connect() manualmente.' };
    } catch (error) {
      console.error(`[WHATSAPP:${this.connectionId}] Erro ao fazer logout:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Enviar mensagem via WhatsApp
   */
  async sendMessage(jid, mensagem, imagens = [], videos = [], metadata = {}) {
    console.log(`[WHATSAPP:${this.connectionId}] Verificando estado antes de enviar: isConnected=${this.isConnected}, sock=${!!this.sock}, sock.user=${!!this.sock?.user}`);
    
    // Verificação adicional: se sock.user existe, considerar como conectado mesmo se isConnected=false
    // Isso resolve casos onde o evento 'open' não foi disparado mas a conexão está estabelecida
    if (this.sock && this.sock.user && !this.isConnected) {
      console.log(`[WHATSAPP:${this.connectionId}] ⚠️ Detectado sock.user mas isConnected=false. Corrigindo estado antes de enviar...`);
      this.isConnected = true;
      this.connectionStatus = 'connected';
      
      const user = this.sock.user;
      if (user && user.id) {
        const digits = this._extractDigits(user.id);
        this.connectedNumber = digits;
        this.connectedNumberFormatted = this._formatPhoneNumber(digits);
      }
    }
    
    if (!this.isConnected || !this.sock) {
      console.error(`[WHATSAPP:${this.connectionId}] Estado inconsistente: isConnected=${this.isConnected}, sock=${!!this.sock}, sock.user=${!!this.sock?.user}`);
      return { ok: false, error: 'WhatsApp desconectado' };
    }
    
    // Verificação adicional: estado do WebSocket
    const wsReadyState = this.sock?.ws?.readyState;
    if (wsReadyState !== 1) { // 1 = OPEN
      console.error(`[WHATSAPP:${this.connectionId}] WebSocket não está aberto. readyState=${wsReadyState} (1=OPEN, 0=CONNECTING, 2=CLOSING, 3=CLOSED)`);
      return { ok: false, error: `WebSocket não está conectado (estado: ${wsReadyState})` };
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
          const sentFirst = await this.sock.sendMessage(destinatario, {
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
              const sentMore = await this.sock.sendMessage(destinatario, {
                image: b,
                mimetype: it?.type || 'image/jpeg'
              });
              const mid = sentMore?.key?.id || null;
              if (mid) messageIds.push(mid);
            } catch (ie) {
              console.log(`[WHATSAPP:${this.connectionId}] Falha ao enviar imagem extra:`, ie?.message);
            }
          }
        } catch (imgErr) {
          console.log(`[WHATSAPP:${this.connectionId}] Falha envio de imagem; caindo para texto:`, imgErr?.message);
        }
      }
      
      // Se houver vídeos, enviar com legenda
      const vids = Array.isArray(videos) ? videos : [];
      if (vids.length > 0) {
        try {
          for (const video of vids) {
            try {
              const buf = Buffer.from(String(video?.data || ''), 'base64');
              const sentVideo = await this.sock.sendMessage(destinatario, {
                video: buf,
                mimetype: video?.type || 'video/mp4',
                caption: imgs.length === 0 ? (mensagem || '') : ''
              });
              const videoId = sentVideo?.key?.id || null;
              if (videoId) {
                messageId = messageId || videoId;
                messageIds.push(videoId);
              }
            } catch (vidErr) {
              console.log(`[WHATSAPP:${this.connectionId}] Falha ao enviar vídeo:`, vidErr?.message);
            }
          }
        } catch (vidErr) {
          console.log(`[WHATSAPP:${this.connectionId}] Falha geral no envio de vídeos:`, vidErr?.message);
        }
      }
      
      // Se não houve imagem ou vídeo enviada (ou falhou), enviar texto
      if (!messageId) {
        const sent = await this.sock.sendMessage(destinatario, { text: mensagem || '' });
        const tid = sent?.key?.id || null;
        messageId = tid;
        if (tid) messageIds.push(tid);
      }
      
      // Verificar se realmente obteve um messageId antes de retornar sucesso
      if (!messageId || messageIds.length === 0) {
        console.error(`[WHATSAPP:${this.connectionId}] ❌ Falha ao enviar mensagem: nenhum messageId obtido. destinatario=${destinatario}, sock.readyState=${this.sock?.ws?.readyState}`);
        return {
          ok: false,
          error: 'Falha ao enviar mensagem: nenhum messageId retornado pelo WhatsApp',
          messageId: null,
          messageIds: []
        };
      }
      
      console.log(`[WHATSAPP:${this.connectionId}] ✅ Mensagem enviada! messageId:`, messageId, 'all:', messageIds);
      
      // Armazenar metadados se fornecidos
      if (messageId && (metadata.cpf || metadata.solicitacao || metadata.agente)) {
        this.metaByMessageId.set(messageId, {
          cpf: metadata.cpf || null,
          solicitacao: metadata.solicitacao || null,
          agente: metadata.agente || null,
          timestamp: Date.now()
        });
        
        // Se múltiplos messageIds, armazenar para todos
        if (messageIds && messageIds.length > 1) {
          messageIds.forEach(id => {
            if (id) {
              this.metaByMessageId.set(id, {
                cpf: metadata.cpf || null,
                solicitacao: metadata.solicitacao || null,
                agente: metadata.agente || null,
                timestamp: Date.now()
              });
            }
          });
        }
      }
      
      return {
        ok: true,
        messageId: messageId,
        messageIds: messageIds
      };
      
    } catch (error) {
      console.error(`[WHATSAPP:${this.connectionId}] Erro ao enviar mensagem:`, error);
      return { ok: false, error: error.message || 'Erro desconhecido' };
    }
  }

  /**
   * Obter status da conexão
   */
  getStatus() {
    // Verificar se há inconsistência entre isConnected e sock
    const actuallyConnected = this.isConnected && this.sock;
    
    if (this.isConnected && !this.sock) {
      console.warn(`[WHATSAPP:${this.connectionId}] Estado inconsistente detectado: isConnected=true mas sock=null. Corrigindo...`);
      this.isConnected = false;
      this.connectionStatus = 'disconnected';
      this.connectedNumber = null;
      this.connectedNumberFormatted = null;
    }
    
    return {
      connected: actuallyConnected,
      status: actuallyConnected ? this.connectionStatus : 'disconnected',
      number: actuallyConnected ? this.connectedNumber : null,
      numberFormatted: actuallyConnected ? this.connectedNumberFormatted : null,
      hasQR: !!this.currentQR && (!this.qrExpiresAt || Date.now() < this.qrExpiresAt)
    };
  }

  /**
   * Obter QR code atual
   * NÃO força conexão automaticamente - apenas retorna QR se disponível
   * Para gerar novo QR, use connect() explicitamente
   */
  async getQR() {
    // Se já está conectado, não há QR disponível
    if (this.isConnected && this.sock) {
      return { hasQR: false, message: 'WhatsApp já está conectado' };
    }
    
    // Se QR expirou ou não existe, apenas retornar que não está disponível
    // NÃO forçar conexão automaticamente
    const qrExpired = this.qrExpiresAt && Date.now() >= this.qrExpiresAt;
    const noQR = !this.currentQR;
    
    if (qrExpired) {
      return { hasQR: false, message: 'QR code expirado. Use o botão "Atualizar QR" ou "Conectar" para gerar novo QR.' };
    }
    
    if (noQR) {
      return { hasQR: false, message: 'QR code não disponível. Use o botão "Atualizar QR" ou "Conectar" para gerar novo QR.' };
    }
    
    // Se tem QR válido, retornar
    const expiresIn = this.qrExpiresAt ? Math.floor((this.qrExpiresAt - Date.now()) / 1000) : 60;
    
    return {
      hasQR: true,
      qr: this.qrImageBase64 || this.currentQR,
      expiresIn: expiresIn
    };
  }

  /**
   * Obter número conectado
   */
  getConnectedNumber() {
    // Usar a mesma lógica de verificação do getStatus() para consistência
    const actuallyConnected = this.isConnected && this.sock;
    
    if (this.isConnected && !this.sock) {
      console.warn(`[WHATSAPP:${this.connectionId}] Estado inconsistente detectado em getConnectedNumber: isConnected=true mas sock=null. Corrigindo...`);
      this.isConnected = false;
      this.connectionStatus = 'disconnected';
      this.connectedNumber = null;
      this.connectedNumberFormatted = null;
    }
    
    return {
      number: actuallyConnected ? this.connectedNumber : null,
      formatted: actuallyConnected ? this.connectedNumberFormatted : null,
      connected: actuallyConnected
    };
  }

  /**
   * Enviar reação ✅ programaticamente
   */
  async react(messageId, jid, participant = null) {
    if (!this.isConnected || !this.sock) {
      return { ok: false, error: 'WhatsApp desconectado' };
    }
    
    try {
      let remoteJid = String(jid).trim();
      if (!remoteJid.includes('@')) {
        remoteJid = remoteJid.includes('-') 
          ? `${remoteJid}@g.us` 
          : `${remoteJid}@s.whatsapp.net`;
      }
      
      const key = {
        remoteJid,
        id: String(messageId).trim(),
        fromMe: false
      };
      
      if (participant != null && String(participant).trim() && remoteJid.endsWith('@g.us')) {
        let partJid = String(participant).trim();
        if (!partJid.includes('@')) partJid = `${partJid}@s.whatsapp.net`;
        key.participant = partJid;
      }
      
      const reactPayload = { react: { text: '✅', key } };
      console.log(`[WHATSAPP:${this.connectionId}] [REACT] enviando`, { messageId: key.id, remoteJid, participant: key.participant || '(dm)' });
      await this.sock.sendMessage(remoteJid, reactPayload);
      console.log(`[WHATSAPP:${this.connectionId}] [REACT] sendMessage retornou ok`);
      return { ok: true };
    } catch (e) {
      console.error(`[WHATSAPP:${this.connectionId}] [REACT]`, e?.message);
      return { ok: false, error: e?.message || 'Falha ao enviar reação' };
    }
  }

  /**
   * Listar grupos do WhatsApp
   */
  async getGroups() {
    if (!this.isConnected || !this.sock) {
      return { ok: false, error: 'WhatsApp desconectado' };
    }
    
    try {
      const grupos = await this.sock.groupFetchAllParticipating();
      const lista = Object.values(grupos).map(g => ({
        nome: g.subject,
        id: g.id
      }));
      return { ok: true, grupos: lista };
    } catch (e) {
      console.error(`[WHATSAPP:${this.connectionId}] Erro ao listar grupos:`, e);
      return { ok: false, error: e.message };
    }
  }

  /**
   * Configurar listeners de reações
   */
  setupReactionListeners() {
    if (!this.sock) return;
    
    // Listener em messages.update
    this.sock.ev.on('messages.update', async (updates) => {
      try {
        for (const u of updates) {
          const rx = u?.update?.reactionMessage;
          if (!rx) continue;
          
          const emoji = rx.text;
          const waMessageId = rx.key?.id;
          const reactorDigits = this._extractDigits(u?.key || u?.update?.key || {});
          
          if ((emoji === '✅' || emoji === '❌') && waMessageId) {
            if (this._isReactorAllowed(reactorDigits)) {
              await this._handleReaction(waMessageId, emoji, reactorDigits);
            } else {
              console.log(`[WHATSAPP:${this.connectionId}] [AUTO-STATUS/UPDATE] Ignorado: reator não autorizado`, reactorDigits);
            }
          }
        }
      } catch (e) {
        console.log(`[WHATSAPP:${this.connectionId}] [REACTION UPDATE ERROR]`, e.message);
      }
    });
    
    // Listener em messages.upsert (backup)
    // Este listener já está configurado em setupReplyListeners, mas também processa reações
  }

  /**
   * Processar reação detectada
   */
  async _handleReaction(waMessageId, emoji, reactorDigits) {
    if (!this.reactionCallbackUrl) return;
    
    try {
      const response = await fetch(this.reactionCallbackUrl, {
        method: 'POST',
        headers: this._getPanelHeaders(),
        body: JSON.stringify({ waMessageId, reaction: emoji, reactor: reactorDigits })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[WHATSAPP:${this.connectionId}] [AUTO-STATUS] HTTP`, response.status, errorText);
        return null;
      }
      
      const result = await response.json();
      if (result.success) {
        console.log(`[WHATSAPP:${this.connectionId}] [AUTO-STATUS] OK`, result.data?.status || result.status);
      } else {
        console.log(`[WHATSAPP:${this.connectionId}] [AUTO-STATUS] Resposta:`, result.error || result);
      }
      return result;
    } catch (error) {
      console.error(`[WHATSAPP:${this.connectionId}] [AUTO-STATUS] Erro:`, error.message);
      return null;
    }
  }

  /**
   * Configurar listeners de replies
   */
  setupReplyListeners() {
    if (!this.sock) return;
    
    this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
      try {
        if (!messages || !messages.length) return;
        
        for (const msg of messages) {
          const m = msg?.message || {};
          
          // Ignorar protocolMessage (sincronização WhatsApp)
          const keys = msg?.message ? Object.keys(msg.message) : [];
          if (keys.length === 1 && m?.protocolMessage) continue;
          
          // Processar reações também aqui (backup)
          const rx = m?.reactionMessage;
          if (rx) {
            const emoji = rx.text;
            const waMessageId = rx.key?.id;
            const reactorDigits = this._extractDigits(msg?.key || {});
            
            if ((emoji === '✅' || emoji === '❌') && waMessageId) {
              if (this._isReactorAllowed(reactorDigits)) {
                await this._handleReaction(waMessageId, emoji, reactorDigits);
              } else {
                console.log(`[WHATSAPP:${this.connectionId}] [AUTO-STATUS/UPSERT] Ignorado: reator não autorizado`, reactorDigits);
              }
            }
            continue; // Pular para próxima mensagem se for reação
          }
          
          // Processar replies (respostas citadas)
          try {
            const text = m.conversation || 
                        m.extendedTextMessage?.text || 
                        m.imageMessage?.caption || 
                        m.videoMessage?.caption || '';
            const ctx = m.extendedTextMessage?.contextInfo || {};
            const quoted = ctx.stanzaId || 
                          ctx?.quotedMessage?.key?.id || 
                          ctx?.stanzaID || 
                          ctx?.quotedStanzaID || 
                          null;
            
            if (!this.repliesStreamEnabled || !quoted || !text) {
              continue;
            }
            
            // Verificar se quoted messageId tem metadados conhecidos
            const meta = this.metaByMessageId.get(quoted);
            if (!meta) {
              continue; // Ignorar replies de mensagens não enviadas pelo bot
            }
            
            const reactor = this._extractDigits(msg?.key || {});
            const event = {
              type: 'reply',
              at: new Date().toISOString(),
              waMessageId: quoted,
              reactor,
              text,
              cpf: meta.cpf || null,
              solicitacao: meta.solicitacao || null,
              agente: meta.agente || null
            };
            
            // Adicionar ao buffer
            this.recentReplies.push(event);
            if (this.recentReplies.length > this.recentMax) {
              this.recentReplies.shift();
            }
            
            // Publicar para SSE clients
            this.publishReply(event);
            
            // Notificar callback se configurado
            if (this.replyCallbackUrl) {
              const payload = {
                waMessageId: quoted,
                reactor,
                text,
                replyMessageId: msg?.key?.id || null,
                replyMessageJid: msg?.key?.remoteJid || null,
                replyMessageParticipant: msg?.key?.participant || null
              };
              
              const postOnce = async () => {
                try {
                  const r = await fetch(this.replyCallbackUrl, {
                    method: 'POST',
                    headers: this._getPanelHeaders(),
                    body: JSON.stringify(payload)
                  });
                  const ok = r.ok;
                  let bodyText = '';
                  let status = r.status;
                  try { bodyText = await r.text(); } catch {}
                  console.log(`[WHATSAPP:${this.connectionId}] [REPLY POST]`, { status, ok, quoted, reactor, textLen: String(text).length });
                  return ok;
                } catch (e) {
                  console.log(`[WHATSAPP:${this.connectionId}] [REPLY POST ERROR]`, e?.message);
                  return false;
                }
              };
              
              let ok = false;
              try { ok = await postOnce(); } catch (e) {}
              if (!ok) {
                await new Promise(r => setTimeout(r, 500));
                try { await postOnce(); } catch (e2) {}
              }
            }
          } catch (er) {
            console.log(`[WHATSAPP:${this.connectionId}] [REPLY HOOK ERROR]`, er?.message);
          }
        }
      } catch (e) {
        console.log(`[WHATSAPP:${this.connectionId}] [REACTION UPSERT ERROR]`, e.message);
      }
    });
  }

  /**
   * Publicar reply para clientes SSE
   */
  publishReply(event) {
    const data = `event: reply\n` + `data: ${JSON.stringify(event)}\n\n`;
    for (const client of this.sseClients) {
      try {
        const want = client?.agent 
          ? (this._norm(client.agent) === this._norm(event?.agente || '')) 
          : true;
        if (want) client.res.write(data);
      } catch (e) {
        // Cliente desconectado, remover
        this.sseClients.delete(client);
      }
    }
  }

  /**
   * Obter replies recentes
   */
  getRecentReplies(agent = null) {
    if (agent) {
      return this.recentReplies.filter(r => this._norm(r?.agente) === this._norm(agent));
    }
    return this.recentReplies;
  }

  /**
   * Inicializar serviço (conectar automaticamente)
   */
  async initialize() {
    try {
      await this.connect();
      console.log(`[WHATSAPP:${this.connectionId}] Serviço inicializado`);
    } catch (error) {
      console.error(`[WHATSAPP:${this.connectionId}] Erro ao inicializar serviço:`, error);
      throw error;
    }
  }
}

module.exports = WhatsAppConnectionService;
