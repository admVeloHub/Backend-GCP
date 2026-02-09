// VERSION: v1.0.0 | DATE: 2025-02-02 | AUTHOR: VeloHub Development Team
/**
 * VeloHub SKYNET - AI Services API Routes
 * 
 * Rotas para gerenciamento de serviços de IA
 * Requer permissão 'whatsapp' (mesma permissão do módulo Conexões)
 */

const express = require('express');
const router = express.Router();
const { checkPermission } = require('../middleware/auth');
const axios = require('axios');

// Middleware de autenticação
const requirePermission = checkPermission('whatsapp');

/**
 * Função auxiliar para mascarar API Key
 * Mostra primeiros 3 e últimos 3 caracteres
 */
const maskApiKey = (apiKey) => {
  if (!apiKey || apiKey.length < 6) {
    return '***';
  }
  const first = apiKey.substring(0, 3);
  const last = apiKey.substring(apiKey.length - 3);
  return `${first}***${last}`;
};

/**
 * Verificar status do Worker Qualidade
 */
const checkWorkerQualidadeStatus = async () => {
  try {
    // URL do worker (pode ser configurada via env)
    const workerUrl = process.env.WORKER_QUALIDADE_URL || 'https://audio-worker-278491073220.us-east1.run.app';
    const response = await axios.get(`${workerUrl}/health`, {
      timeout: 5000
    });
    
    if (response.status === 200 && response.data.status === 'healthy') {
      return {
        enabled: true,
        status: 'active',
        geminiApiKeyConfigured: response.data.components?.vertexAI?.status === 'healthy',
        openaiApiKeyConfigured: true // Assumir que está configurado se worker está healthy
      };
    }
    return {
      enabled: false,
      status: 'inactive',
      geminiApiKeyConfigured: false,
      openaiApiKeyConfigured: false
    };
  } catch (error) {
    console.error('Erro ao verificar status do Worker Qualidade:', error.message);
    return {
      enabled: false,
      status: 'error',
      geminiApiKeyConfigured: false,
      openaiApiKeyConfigured: false,
      error: error.message
    };
  }
};

/**
 * GET /api/ai-services/status
 * Obter status dos serviços de IA
 */
router.get('/status', requirePermission, async (req, res) => {
  try {
    // Status do Veloredes (SKYNET)
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const veloredesStatus = {
      enabled: !!geminiApiKey && geminiApiKey.trim().length > 0,
      status: geminiApiKey && geminiApiKey.trim().length > 0 ? 'active' : 'inactive',
      apiKeyConfigured: !!geminiApiKey && geminiApiKey.trim().length > 0
    };

    // Status do Worker Qualidade
    const workerQualidadeStatus = await checkWorkerQualidadeStatus();

    res.json({
      veloredes: veloredesStatus,
      workerQualidade: workerQualidadeStatus
    });
  } catch (error) {
    console.error('Erro ao obter status dos serviços de IA:', error);
    res.status(500).json({
      error: 'Erro ao obter status dos serviços de IA',
      message: error.message
    });
  }
});

/**
 * GET /api/ai-services/config
 * Obter configurações mascaradas dos serviços de IA
 */
router.get('/config', requirePermission, async (req, res) => {
  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    res.json({
      veloredes: {
        apiKey: geminiApiKey ? maskApiKey(geminiApiKey) : null
      },
      workerQualidade: {
        geminiApiKey: geminiApiKey ? maskApiKey(geminiApiKey) : null,
        openaiApiKey: openaiApiKey ? maskApiKey(openaiApiKey) : null
      }
    });
  } catch (error) {
    console.error('Erro ao obter configurações dos serviços de IA:', error);
    res.status(500).json({
      error: 'Erro ao obter configurações dos serviços de IA',
      message: error.message
    });
  }
});

/**
 * POST /api/ai-services/toggle
 * Ativar ou desativar um serviço de IA
 * 
 * Body: { service: 'veloredes' | 'workerQualidade', enabled: boolean }
 */
router.post('/toggle', requirePermission, async (req, res) => {
  try {
    const { service, enabled } = req.body;

    if (!service || (service !== 'veloredes' && service !== 'workerQualidade')) {
      return res.status(400).json({
        error: 'Serviço inválido. Deve ser "veloredes" ou "workerQualidade"'
      });
    }

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        error: 'Campo "enabled" deve ser boolean'
      });
    }

    // Por enquanto, apenas retornar status atual
    // Em produção, isso poderia atualizar variáveis de ambiente ou flags no GCP
    // Para SKYNET, podemos usar uma flag em memória ou variável de ambiente
    // Para Worker, seria necessário atualizar no GCP Secret Manager ou Cloud Run
    
    if (service === 'veloredes') {
      // Para Veloredes, verificar se API key está configurada
      const geminiApiKey = process.env.GEMINI_API_KEY;
      const canEnable = !!geminiApiKey && geminiApiKey.trim().length > 0;
      
      if (enabled && !canEnable) {
        return res.status(400).json({
          error: 'Não é possível ativar o serviço: GEMINI_API_KEY não está configurada'
        });
      }

      // Em produção, aqui poderia atualizar uma flag ou variável de ambiente
      // Por enquanto, retornamos o status baseado na configuração
      res.json({
        veloredes: {
          enabled: enabled && canEnable,
          status: enabled && canEnable ? 'active' : 'inactive',
          apiKeyConfigured: canEnable
        }
      });
    } else if (service === 'workerQualidade') {
      // Para Worker, verificar status atual
      const workerStatus = await checkWorkerQualidadeStatus();
      
      // Em produção, aqui poderia atualizar configuração no GCP
      // Por enquanto, retornamos status atual
      res.json({
        workerQualidade: {
          enabled: enabled ? workerStatus.enabled : false,
          status: enabled && workerStatus.status === 'active' ? 'active' : 'inactive',
          geminiApiKeyConfigured: workerStatus.geminiApiKeyConfigured,
          openaiApiKeyConfigured: workerStatus.openaiApiKeyConfigured
        }
      });
    }
  } catch (error) {
    console.error('Erro ao alterar status do serviço de IA:', error);
    res.status(500).json({
      error: 'Erro ao alterar status do serviço de IA',
      message: error.message
    });
  }
});

module.exports = router;
