// VERSION: v1.0.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Configurar API Key do Gemini
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

let genAI = null;

// Inicializar Gemini AI
const configureGemini = () => {
  if (!genAI && GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    console.log('✅ Gemini AI configurado');
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

    const ai = configureGemini();
    if (!ai) {
      return {
        success: false,
        error: 'Gemini AI não configurado. Verifique GEMINI_API_KEY'
      };
    }

    const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
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

    const ai = configureGemini();
    if (!ai) {
      return {
        success: false,
        error: 'Gemini AI não configurado. Verifique GEMINI_API_KEY'
      };
    }

    const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
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

module.exports = {
  configureGemini,
  analyzeSentimentAndReason,
  generateExecutiveReport
};
