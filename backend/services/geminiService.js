// VERSION: v1.4.0 | DATE: 2026-04-27 | AUTHOR: VeloHub Development Team
// CHANGELOG: v1.4.0 - Modelo padrão gemini-2.5-flash (API Google AI Studio: gemini-2.0-flash indisponível a novos users); GEMINI_MODEL_ID opcional na env
// CHANGELOG: v1.3.0 - generateQaFeedbackEmail: corpo de e-mail QA (Gemini 2.0 flash, saída só texto)
let GoogleGenerativeAI = null;
try {
  GoogleGenerativeAI = require('@google/generative-ai').GoogleGenerativeAI;
} catch (error) {
  console.error('⚠️ Módulo @google/generative-ai não encontrado:', error.message);
  console.error('⚠️ Funcionalidades de IA não estarão disponíveis');
}

// Configurar API Key do Gemini
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/** Lista de modelos: https://ai.google.dev/gemini-api/docs/models — gemini-2.0-* deixou de estar disponível a novos utilizadores na AI Studio */
const GEMINI_MODEL_ID =
  typeof process.env.GEMINI_MODEL_ID === 'string' && process.env.GEMINI_MODEL_ID.trim()
    ? process.env.GEMINI_MODEL_ID.trim()
    : 'gemini-2.5-flash';

let genAI = null;

// Inicializar Gemini AI
const configureGemini = () => {
  if (!GoogleGenerativeAI) {
    console.warn('⚠️ @google/generative-ai não disponível');
    return null;
  }
  if (!genAI && GEMINI_API_KEY) {
    try {
      genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      console.log('✅ Gemini AI configurado');
    } catch (error) {
      console.error('⚠️ Erro ao configurar Gemini AI:', error.message);
      return null;
    }
  } else if (!GEMINI_API_KEY) {
    console.warn('⚠️ GEMINI_API_KEY não configurada');
  }
  return genAI;
};

// Analisar sentimento e motivo do contato
const analyzeSentimentAndReason = async (text) => {
  try {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return {
        success: false,
        error: 'Texto inválido para análise'
      };
    }

    if (!GoogleGenerativeAI) {
      return {
        success: false,
        error: 'Módulo @google/generative-ai não disponível',
        fallback: {
          sentiment: 'Neutro',
          reason: 'Suporte'
        }
      };
    }

    const ai = configureGemini();
    if (!ai) {
      return {
        success: false,
        error: 'Gemini AI não configurado. Verifique GEMINI_API_KEY',
        fallback: {
          sentiment: 'Neutro',
          reason: 'Suporte'
        }
      };
    }

    const model = ai.getGenerativeModel({ model: GEMINI_MODEL_ID });

    const prompt = `Analise o seguinte texto de atendimento de rede social e retorne APENAS um JSON válido com:
1. "sentiment": (Positivo, Neutro ou Negativo)
2. "reason": (Comercial, Suporte, Bug ou Elogio)

Texto: "${text}"

Retorne APENAS o JSON, sem markdown, sem código, sem explicações. Exemplo:
{"sentiment": "Positivo", "reason": "Elogio"}`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    let content = response.text().trim();

    // Limpar a resposta para garantir que seja um JSON válido
    if (content.includes('```json')) {
      content = content.split('```json')[1].split('```')[0].trim();
    } else if (content.includes('```')) {
      content = content.split('```')[1].split('```')[0].trim();
    }

    // Remover markdown se presente
    content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');

    try {
      const analysis = JSON.parse(content);
      
      // Validar estrutura
      const validSentiments = ['Positivo', 'Neutro', 'Negativo'];
      const validReasons = ['Comercial', 'Suporte', 'Bug', 'Elogio'];
      
      if (!validSentiments.includes(analysis.sentiment)) {
        analysis.sentiment = 'Neutro';
      }
      
      if (!validReasons.includes(analysis.reason)) {
        analysis.reason = 'Suporte';
      }

      return {
        success: true,
        data: {
          sentiment: analysis.sentiment,
          reason: analysis.reason
        }
      };
    } catch (parseError) {
      console.error('Erro ao parsear resposta do Gemini:', parseError);
      console.error('Conteúdo recebido:', content);
      return {
        success: false,
        error: 'Erro ao processar resposta da IA',
        fallback: {
          sentiment: 'Neutro',
          reason: 'Suporte'
        }
      };
    }
  } catch (error) {
    console.error('Erro na análise de IA:', error);
    return {
      success: false,
      error: error.message || 'Erro ao analisar texto com IA',
      fallback: {
        sentiment: 'Neutro',
        reason: 'Suporte'
      }
    };
  }
};

// Gerar relatório executivo
const generateExecutiveReport = async (data) => {
  try {
    if (!data || (typeof data === 'string' && data.trim().length === 0)) {
      return {
        success: false,
        error: 'Dados inválidos para gerar relatório'
      };
    }

    if (!GoogleGenerativeAI) {
      return {
        success: false,
        error: 'Módulo @google/generative-ai não disponível'
      };
    }

    const ai = configureGemini();
    if (!ai) {
      return {
        success: false,
        error: 'Gemini AI não configurado. Verifique GEMINI_API_KEY'
      };
    }

    const model = ai.getGenerativeModel({ model: GEMINI_MODEL_ID });

    // Preparar dados para o prompt
    let dataSummary = '';
    if (typeof data === 'string') {
      dataSummary = data;
    } else if (Array.isArray(data)) {
      dataSummary = data.map(item => {
        if (typeof item === 'object') {
          return JSON.stringify(item);
        }
        return String(item);
      }).join('\n');
    } else if (typeof data === 'object') {
      dataSummary = JSON.stringify(data, null, 2);
    } else {
      dataSummary = String(data);
    }

    const prompt = `Você é um consultor sênior de CX (Customer Experience). 
Com base nos seguintes dados de atendimentos de redes sociais, escreva um relatório executivo narrativo, profissional e humano.

Dados:
${dataSummary}

O relatório deve conter:
- Título impactante
- Resumo executivo (tópicos)
- Análise estratégica por rede social e sentimento
- Plano de Ação (Action Plan) com 3 pontos estratégicos
- Conclusão

Use formatação Markdown.
Seja objetivo, profissional e forneça insights acionáveis.`;

    const result = await model.generateContent(prompt);
    const report = result.response.text();

    return {
      success: true,
      data: report
    };
  } catch (error) {
    console.error('Erro ao gerar relatório executivo:', error);
    return {
      success: false,
      error: error.message || 'Erro ao gerar relatório executivo'
    };
  }
};

/**
 * Gera texto do e-mail de feedback QA (corpo único, sem preâmbulo do modelo).
 * @param {string} fullPrompt - Instruções + dados já interpolados
 * @returns {Promise<{ success: boolean, feedbackGerado?: string, error?: string }>}
 */
const generateQaFeedbackEmail = async (fullPrompt) => {
  try {
    if (!fullPrompt || String(fullPrompt).trim().length === 0) {
      return { success: false, error: 'Prompt vazio' };
    }
    if (!GoogleGenerativeAI) {
      return { success: false, error: 'Módulo @google/generative-ai não disponível' };
    }
    const ai = configureGemini();
    if (!ai) {
      return {
        success: false,
        error: 'Gemini AI não configurado. Verifique GEMINI_API_KEY'
      };
    }
    const model = ai.getGenerativeModel({ model: GEMINI_MODEL_ID });
    const result = await model.generateContent(String(fullPrompt));
    const text = (result.response && result.response.text()) ? result.response.text().trim() : '';
    if (!text) {
      return { success: false, error: 'Resposta vazia da IA' };
    }
    return { success: true, feedbackGerado: text };
  } catch (error) {
    console.error('generateQaFeedbackEmail:', error);
    return { success: false, error: error.message || 'Erro ao gerar e-mail de feedback' };
  }
};

module.exports = {
  configureGemini,
  analyzeSentimentAndReason,
  generateExecutiveReport,
  generateQaFeedbackEmail
};
