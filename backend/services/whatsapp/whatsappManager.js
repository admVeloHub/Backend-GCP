/**
 * VeloHub SKYNET - WhatsApp Manager
 * VERSION: v2.0.0 | DATE: 2025-02-11 | AUTHOR: VeloHub Development Team
 * 
 * Singleton para gerenciar múltiplas instâncias de WhatsAppConnectionService
 * Inicializa e mantém referências para todas as conexões WhatsApp
 */

const WhatsAppConnectionService = require('./whatsappConnectionService');

class WhatsAppManager {
  constructor() {
    this.connections = new Map(); // connectionId -> WhatsAppConnectionService
    this.initialized = false;
  }

  /**
   * Obter instância de conexão específica
   */
  getConnection(connectionId) {
    if (!this.connections.has(connectionId)) {
      throw new Error(`Conexão WhatsApp '${connectionId}' não encontrada`);
    }
    return this.connections.get(connectionId);
  }

  /**
   * Adicionar nova conexão
   */
  addConnection(connectionId, options = {}) {
    if (this.connections.has(connectionId)) {
      console.warn(`[WHATSAPP MANAGER] Conexão '${connectionId}' já existe. Retornando existente.`);
      return this.connections.get(connectionId);
    }

    const service = new WhatsAppConnectionService(connectionId, options);
    this.connections.set(connectionId, service);
    console.log(`[WHATSAPP MANAGER] Conexão '${connectionId}' adicionada`);
    return service;
  }

  /**
   * Inicializar todas as conexões
   */
  async initialize() {
    if (this.initialized) {
      console.log('[WHATSAPP MANAGER] Já inicializado');
      return;
    }

    console.log('[WHATSAPP MANAGER] Inicializando conexões WhatsApp...');

    // Criar conexões padrão
    const requisicoesProduto = this.addConnection('requisicoes-produto', {
      authorizedReactors: this._getAuthorizedReactorsFromEnv(),
      reactionCallbackUrl: this._getReactionCallbackUrl(),
      replyCallbackUrl: this._getReplyCallbackUrl(),
      panelBypassSecret: process.env.PANEL_BYPASS_SECRET || process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '',
      repliesStreamEnabled: String(process.env.REPLIES_STREAM_ENABLED || '0') === '1'
    });

    const velodesk = this.addConnection('velodesk', {
      authorizedReactors: this._getAuthorizedReactorsFromEnv(),
      reactionCallbackUrl: this._getReactionCallbackUrl(),
      replyCallbackUrl: this._getReplyCallbackUrl(),
      panelBypassSecret: process.env.PANEL_BYPASS_SECRET || process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '',
      repliesStreamEnabled: String(process.env.REPLIES_STREAM_ENABLED || '0') === '1'
    });

    // Inicializar conexões em paralelo
    try {
      await Promise.all([
        requisicoesProduto.initialize().catch(err => {
          console.error('[WHATSAPP MANAGER] Erro ao inicializar requisicoes-produto:', err.message);
        }),
        velodesk.initialize().catch(err => {
          console.error('[WHATSAPP MANAGER] Erro ao inicializar velodesk:', err.message);
        })
      ]);
      
      this.initialized = true;
      console.log('[WHATSAPP MANAGER] Todas as conexões inicializadas');
    } catch (error) {
      console.error('[WHATSAPP MANAGER] Erro ao inicializar conexões:', error);
      throw error;
    }
  }

  /**
   * Obter lista de números autorizados do ambiente
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
   * Listar todas as conexões
   */
  listConnections() {
    return Array.from(this.connections.keys());
  }

  /**
   * Verificar se conexão existe
   */
  hasConnection(connectionId) {
    return this.connections.has(connectionId);
  }
}

// Singleton
let instance = null;

function getWhatsAppManager() {
  if (!instance) {
    instance = new WhatsAppManager();
  }
  return instance;
}

module.exports = {
  WhatsAppManager,
  getWhatsAppManager
};
