// VERSION: v2.4.0 | DATE: 2025-11-25 | AUTHOR: VeloHub Development Team
const express = require('express');
const router = express.Router();
const UserActivity = require('../models/UserActivity');
const BotFeedback = require('../models/BotFeedback');

// Função para calcular datas baseado no período
const calculateDateRange = (period) => {
  const now = new Date();
  let startDate;

  switch (period) {
    case '1dia':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7dias':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30dias':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90dias':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '1ano':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    case 'todos':
      startDate = new Date('2020-01-01'); // Data inicial do sistema
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Default 30 dias
  }

  return { startDate, endDate: now };
};


// GET /api/bot-analises/dados-completos - Endpoint otimizado único com dados brutos + metadados
router.get('/dados-completos', async (req, res) => {
  try {
    global.emitTraffic('Bot Análises', 'received', 'Entrada recebida - GET /api/bot-analises/dados-completos');
    global.emitLog('info', 'GET /api/bot-analises/dados-completos - Processando dados brutos + metadados');
    
    const { periodo = '30dias', exibicao = 'dia' } = req.query;
    
    // Validar parâmetros
    const validPeriods = ['1dia', '7dias', '30dias', '90dias', '1ano', 'todos'];
    const validDisplays = ['dia', 'semana', 'mes'];
    
    if (!validPeriods.includes(periodo)) {
      global.emitTraffic('Bot Análises', 'error', 'Período inválido');
      global.emitLog('error', 'GET /api/bot-analises/dados-completos - Período inválido');
      return res.status(400).json({
        success: false,
        error: 'Período inválido. Use: 1dia, 7dias, 30dias, 90dias, 1ano, todos'
      });
    }
    
    if (!validDisplays.includes(exibicao)) {
      global.emitTraffic('Bot Análises', 'error', 'Exibição inválida');
      global.emitLog('error', 'GET /api/bot-analises/dados-completos - Exibição inválida');
      return res.status(400).json({
        success: false,
        error: 'Exibição inválida. Use: dia, semana, mes'
      });
    }
    
    global.emitTraffic('Bot Análises', 'processing', 'Calculando período e consultando MongoDB');
    
    // Calcular período
    const { startDate, endDate } = calculateDateRange(periodo);
    
    // Executar consultas em paralelo para otimização - DADOS BRUTOS
    const [
      userActivities,
      botFeedbacks
    ] = await Promise.all([
      // Buscar todos os registros de user_activity no período
      UserActivity.find({
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      }).lean(),
      
      // Buscar todos os registros de bot_feedback no período
      BotFeedback.find({
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      }).lean()
    ]);
    
    // Emitir dados recebidos do MongoDB para JSON Input
    global.emitJsonInput({
      source: 'MongoDB',
      collections: {
        user_activity: {
          count: userActivities.length,
          sample: userActivities.slice(0, 3) // Mostrar apenas 3 registros como exemplo
        },
        bot_feedback: {
          count: botFeedbacks.length,
          sample: botFeedbacks.slice(0, 3) // Mostrar apenas 3 registros como exemplo
        }
      },
      query: {
        periodo: periodo,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      },
      timestamp: new Date().toISOString()
    });
    
    global.emitTraffic('Bot Análises', 'processing', 'Processando metadados e resumos');
    
    // Extrair metadados únicos para filtros dinâmicos
    const agentes = [...new Set(botFeedbacks.map(f => f.colaboradorNome))].filter(Boolean);
    const usuarios = [...new Set(userActivities.map(a => a.userId))].filter(Boolean);
    const tiposAcao = [...new Set(userActivities.map(a => a.action))].filter(Boolean);
    const tiposFeedback = [...new Set(botFeedbacks.map(f => f.details?.feedbackType))].filter(Boolean);
    const sessoes = [...new Set([
      ...userActivities.map(a => a.sessionId),
      ...botFeedbacks.map(f => f.sessionId)
    ])].filter(Boolean);
    
    // Extrair períodos disponíveis nos dados (APENAS datas com ocorrências reais)
    const periodosDisponiveis = [];
    const allDates = [
      ...userActivities.map(a => new Date(a.createdAt)),
      ...botFeedbacks.map(f => new Date(f.createdAt))
    ];
    
    if (allDates.length > 0) {
      // Usar apenas datas únicas que realmente têm ocorrências (não preencher datas vazias)
      const datasUnicas = [...new Set(allDates.map(d => d.toISOString().split('T')[0]))];
      periodosDisponiveis.push(...datasUnicas.sort());
    }
    
    // Calcular resumo básico
    const totalRegistros = userActivities.length + botFeedbacks.length;
    const totalUsuarios = usuarios.length;
    const totalSessoes = sessoes.length;
    
    // Montar resposta final com dados brutos + metadados
    const response = {
      success: true,
      dadosBrutos: {
        user_activity: userActivities,
        bot_feedback: botFeedbacks
      },
      metadados: {
        agentes: agentes,
        usuarios: usuarios,
        periodos: periodosDisponiveis,
        tiposAcao: tiposAcao,
        tiposFeedback: tiposFeedback,
        sessoes: sessoes
      },
      resumo: {
        totalRegistros: totalRegistros,
        periodoInicio: startDate.toISOString(),
        periodoFim: endDate.toISOString(),
        totalUsuarios: totalUsuarios,
        totalSessoes: totalSessoes,
        totalUserActivities: userActivities.length,
        totalBotFeedbacks: botFeedbacks.length
      },
      metadata: {
        periodo: periodo,
        exibicao: exibicao,
        dataInicio: startDate.toISOString(),
        dataFim: endDate.toISOString(),
        timestamp: new Date().toISOString(),
        versao: '4.0.0'
      }
    };
    
    global.emitTraffic('Bot Análises', 'completed', 'Dados brutos + metadados processados com sucesso');
    global.emitLog('success', `GET /api/bot-analises/dados-completos - ${totalRegistros} registros brutos processados`);
    global.emitJson({
      resumo: response.resumo,
      metadados: response.metadados
    });
    
    res.json(response);
    
  } catch (error) {
    global.emitTraffic('Bot Análises', 'error', 'Erro ao processar dados');
    global.emitLog('error', `GET /api/bot-analises/dados-completos - Erro: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Erro ao processar dados'
    });
  }
});

// GET /api/bot-analises/metricas-gerais
router.get('/metricas-gerais', async (req, res) => {
  try {
    global.emitTraffic('Bot Análises', 'received', 'Entrada recebida - GET /api/bot-analises/metricas-gerais');
    global.emitLog('info', 'GET /api/bot-analises/metricas-gerais - Processando métricas gerais');
    
    const { periodo = '30dias' } = req.query;
    
    // Validar período
    const validPeriods = ['1dia', '7dias', '30dias', '90dias', '1ano', 'todos'];
    if (!validPeriods.includes(periodo)) {
      return res.status(400).json({
        success: false,
        error: 'Período inválido. Use: 1dia, 7dias, 30dias, 90dias, 1ano, todos'
      });
    }
    
    const { startDate, endDate } = calculateDateRange(periodo);
    
    // Buscar dados no período
    const [userActivities, botFeedbacks] = await Promise.all([
      UserActivity.find({
        createdAt: { $gte: startDate, $lte: endDate }
      }).lean(),
      BotFeedback.find({
        createdAt: { $gte: startDate, $lte: endDate }
      }).lean()
    ]);
    
    // Calcular métricas
    const totalRegistros = userActivities.length + botFeedbacks.length;
    const totalUsuarios = [...new Set(userActivities.map(a => a.colaboradorNome))].filter(Boolean).length;
    const totalSessoes = [...new Set([
      ...userActivities.map(a => a.sessionId),
      ...botFeedbacks.map(f => f.sessionId)
    ])].filter(Boolean).length;
    const totalBotFeedbacks = botFeedbacks.length;
    
    // Calcular horário pico (usar moda - hora mais frequente)
    const horarios = userActivities.map(a => new Date(a.createdAt).getHours());
    let horarioPico = "14:00-15:00";
    if (horarios.length > 0) {
      const frequenciaHorarios = {};
      horarios.forEach(h => {
        frequenciaHorarios[h] = (frequenciaHorarios[h] || 0) + 1;
      });
      const horarioMaisFrequente = Object.entries(frequenciaHorarios)
        .sort(([,a], [,b]) => b - a)[0]?.[0];
      if (horarioMaisFrequente !== undefined) {
        const horaInicio = parseInt(horarioMaisFrequente);
        const horaFim = horaInicio + 1;
        horarioPico = `${horaInicio.toString().padStart(2, '0')}:00-${horaFim.toString().padStart(2, '0')}:00`;
      }
    }
    
    // Calcular crescimento (simulado)
    const crescimento = { percentual: 15, positivo: true };
    
    // Calcular média diária
    const dias = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const mediaDiaria = dias > 0 ? Math.round(totalRegistros / dias) : 0;
    
    // Extrair perguntas frequentes
    const perguntasFrequentes = userActivities
      .filter(a => a.action === 'question_asked' && a.details?.question)
      .reduce((acc, a) => {
        const pergunta = a.details.question;
        acc[pergunta] = (acc[pergunta] || 0) + 1;
        return acc;
      }, {});
    
    const perguntasFrequentesArray = Object.entries(perguntasFrequentes)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    
    // Extrair metadados
    const agentes = [...new Set(botFeedbacks.map(f => f.colaboradorNome))].filter(Boolean);
    const usuarios = [...new Set(userActivities.map(a => a.colaboradorNome))].filter(Boolean);
    const tiposAcao = [...new Set(userActivities.map(a => a.action))].filter(Boolean);
    const tiposFeedback = [...new Set(botFeedbacks.map(f => f.details?.feedbackType))].filter(Boolean);
    const sessoes = [...new Set([
      ...userActivities.map(a => a.sessionId),
      ...botFeedbacks.map(f => f.sessionId)
    ])].filter(Boolean);
    
    const response = {
      success: true,
      totalPerguntas: userActivities.filter(a => a.action === 'question_asked').length,
      usuariosAtivos: totalUsuarios,
      horarioPico,
      crescimento,
      mediaDiaria,
      totalRegistros,
      totalAtividades: userActivities.length,
      dadosBrutos: {
        atividades: userActivities  // Incluir array completo de user_activity
      }
    };
    
    global.emitTraffic('Bot Análises', 'completed', 'Métricas gerais processadas com sucesso');
    global.emitJson(response);
    
    res.json(response);
    
  } catch (error) {
    global.emitTraffic('Bot Análises', 'error', 'Erro ao processar métricas gerais');
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/bot-analises/dados-uso-operacao
router.get('/dados-uso-operacao', async (req, res) => {
  try {
    global.emitTraffic('Bot Análises', 'received', 'Entrada recebida - GET /api/bot-analises/dados-uso-operacao');
    
    const { periodo = '30dias', exibicao = 'dia' } = req.query;
    const { startDate, endDate } = calculateDateRange(periodo);
    
    // Buscar dados
    const [userActivities, botFeedbacks] = await Promise.all([
      UserActivity.find({
        createdAt: { $gte: startDate, $lte: endDate }
      }).lean(),
      BotFeedback.find({
        createdAt: { $gte: startDate, $lte: endDate }
      }).lean()
    ]);
    
    // Função auxiliar para obter chave do período baseado na exibição
    const obterChavePeriodo = (data, exibicao) => {
      const date = new Date(data);
      switch (exibicao) {
        case 'dia':
          return date.toISOString().split('T')[0]; // YYYY-MM-DD
        case 'semana':
          // Calcular início da semana (domingo)
          const inicioSemana = new Date(date);
          inicioSemana.setDate(date.getDate() - date.getDay());
          return inicioSemana.toISOString().split('T')[0];
        case 'mes':
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
        default:
          return date.toISOString().split('T')[0];
      }
    };
    
    // Agrupar por período
    const totalUso = {};
    const feedbacksPositivos = {};
    const feedbacksNegativos = {};
    
    // Processar user activities
    userActivities.forEach(activity => {
      const chave = obterChavePeriodo(activity.createdAt, exibicao);
      totalUso[chave] = (totalUso[chave] || 0) + 1;
    });
    
    // Processar bot feedbacks
    botFeedbacks.forEach(feedback => {
      const chave = obterChavePeriodo(feedback.createdAt, exibicao);
      if (feedback.details?.feedbackType === 'positive') {
        feedbacksPositivos[chave] = (feedbacksPositivos[chave] || 0) + 1;
      } else if (feedback.details?.feedbackType === 'negative') {
        feedbacksNegativos[chave] = (feedbacksNegativos[chave] || 0) + 1;
      }
    });
    
    const response = {
      success: true,
      data: {
        totalUso,
        feedbacksPositivos,
        feedbacksNegativos
      }
    };
    
    global.emitTraffic('Bot Análises', 'completed', 'Dados de uso e operação processados');
    global.emitJson(response);
    
    res.json(response);
    
  } catch (error) {
    global.emitTraffic('Bot Análises', 'error', 'Erro ao processar dados de uso');
    console.error('Erro ao processar dados de uso:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/bot-analises/perguntas-frequentes
router.get('/perguntas-frequentes', async (req, res) => {
  try {
    global.emitTraffic('Bot Análises', 'received', 'Entrada recebida - GET /api/bot-analises/perguntas-frequentes');
    
    const { periodo = '30dias' } = req.query;
    const { startDate, endDate } = calculateDateRange(periodo);
    
    // Buscar perguntas no período
    const userActivities = await UserActivity.find({
      createdAt: { $gte: startDate, $lte: endDate },
      action: 'question_asked'
    }).lean();
    
    // Contar frequência das perguntas
    const perguntasFrequentes = userActivities
      .filter(a => a.details?.question)
      .reduce((acc, a) => {
        const pergunta = a.details.question;
        acc[pergunta] = (acc[pergunta] || 0) + 1;
        return acc;
      }, {});
    
    // Converter para array e ordenar
    const response = Object.entries(perguntasFrequentes)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    
    global.emitTraffic('Bot Análises', 'completed', 'Perguntas frequentes processadas');
    global.emitJson(response);
    
    res.json(response);
    
  } catch (error) {
    global.emitTraffic('Bot Análises', 'error', 'Erro ao processar perguntas frequentes');
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/bot-analises/ranking-agentes
router.get('/ranking-agentes', async (req, res) => {
  try {
    global.emitTraffic('Bot Análises', 'received', 'Entrada recebida - GET /api/bot-analises/ranking-agentes');
    
    const { periodo = '30dias' } = req.query;
    const { startDate, endDate } = calculateDateRange(periodo);
    
    // Buscar dados
    const [userActivities, botFeedbacks] = await Promise.all([
      UserActivity.find({
        createdAt: { $gte: startDate, $lte: endDate }
      }).lean(),
      BotFeedback.find({
        createdAt: { $gte: startDate, $lte: endDate }
      }).lean()
    ]);
    
    // Calcular métricas por agente
    const agentes = {};
    
    // Processar user activities
    userActivities.forEach(activity => {
      const agente = activity.userId || 'SISTEMA';
      if (!agentes[agente]) {
        agentes[agente] = { perguntas: 0, sessoes: new Set() };
      }
      agentes[agente].perguntas++;
      if (activity.sessionId) {
        agentes[agente].sessoes.add(activity.sessionId);
      }
    });
    
    // Processar bot feedbacks
    botFeedbacks.forEach(feedback => {
      const agente = feedback.colaboradorNome || 'SISTEMA';
      if (!agentes[agente]) {
        agentes[agente] = { perguntas: 0, sessoes: new Set() };
      }
      if (feedback.sessionId) {
        agentes[agente].sessoes.add(feedback.sessionId);
      }
    });
    
    // Converter para array e calcular score
    const response = Object.entries(agentes)
      .map(([name, data]) => ({
        name,
        perguntas: data.perguntas,
        sessoes: data.sessoes.size,
        score: data.perguntas + (data.sessoes.size * 0.5)
      }))
      .sort((a, b) => b.score - a.score);
    
    global.emitTraffic('Bot Análises', 'completed', 'Ranking de agentes processado');
    global.emitJson(response);
    
    res.json(response);
    
  } catch (error) {
    global.emitTraffic('Bot Análises', 'error', 'Erro ao processar ranking de agentes');
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/bot-analises/lista-atividades
router.get('/lista-atividades', async (req, res) => {
  try {
    global.emitTraffic('Bot Análises', 'received', 'Entrada recebida - GET /api/bot-analises/lista-atividades');
    
    const { periodo = '30dias' } = req.query;
    const { startDate, endDate } = calculateDateRange(periodo);
    
    // Buscar atividades
    const userActivities = await UserActivity.find({
      createdAt: { $gte: startDate, $lte: endDate }
    }).lean();
    
    // Converter para formato esperado
    const response = userActivities
      .filter(a => a.action === 'question_asked' && a.details?.question)
      .map(activity => ({
        usuario: activity.userId || 'SISTEMA',
        pergunta: activity.details.question,
        data: new Date(activity.createdAt).toISOString().split('T')[0],
        horario: new Date(activity.createdAt).toTimeString().split(' ')[0],
        acao: activity.action
      }))
      .sort((a, b) => new Date(b.data + ' ' + b.horario) - new Date(a.data + ' ' + a.horario))
      .slice(0, 100); // Limitar a 100 atividades
    
    global.emitTraffic('Bot Análises', 'completed', 'Lista de atividades processada');
    global.emitJson(response);
    
    res.json(response);
    
  } catch (error) {
    global.emitTraffic('Bot Análises', 'error', 'Erro ao processar lista de atividades');
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/bot-analises/analises-especificas
router.get('/analises-especificas', async (req, res) => {
  try {
    global.emitTraffic('Bot Análises', 'received', 'Entrada recebida - GET /api/bot-analises/analises-especificas');
    
    const { periodo = '30dias' } = req.query;
    const { startDate, endDate } = calculateDateRange(periodo);
    
    // Buscar dados
    const [userActivities, botFeedbacks] = await Promise.all([
      UserActivity.find({
        createdAt: { $gte: startDate, $lte: endDate }
      }).lean(),
      BotFeedback.find({
        createdAt: { $gte: startDate, $lte: endDate }
      }).lean()
    ]);
    
    // Calcular perguntas frequentes
    const perguntasFrequentes = userActivities
      .filter(a => a.action === 'question_asked' && a.details?.question)
      .reduce((acc, a) => {
        const pergunta = a.details.question;
        acc[pergunta] = (acc[pergunta] || 0) + 1;
        return acc;
      }, {});
    
    const perguntasFrequentesArray = Object.entries(perguntasFrequentes)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    
    // Calcular padrões de uso
    const padroesUso = [
      { metrica: 'Total de Perguntas', valor: userActivities.filter(a => a.action === 'question_asked').length.toString() },
      { metrica: 'Total de Feedbacks', valor: botFeedbacks.length.toString() },
      { metrica: 'Feedbacks Positivos', valor: botFeedbacks.filter(f => f.details?.feedbackType === 'positive').length.toString() },
      { metrica: 'Feedbacks Negativos', valor: botFeedbacks.filter(f => f.details?.feedbackType === 'negative').length.toString() }
    ];
    
    // Calcular análise de sessões
    const sessoes = [...new Set([
      ...userActivities.map(a => a.sessionId),
      ...botFeedbacks.map(f => f.sessionId)
    ])].filter(Boolean);
    
    const analiseSessoes = [
      { metrica: 'Total de Sessões', valor: sessoes.length.toString() },
      { metrica: 'Média Perguntas/Sessão', valor: sessoes.length > 0 ? Math.round(userActivities.length / sessoes.length).toString() : '0' },
      { metrica: 'Sessões com Feedback', valor: botFeedbacks.length.toString() }
    ];
    
    const response = {
      success: true,
      data: {
        perguntasFrequentes: perguntasFrequentesArray,
        padroesUso,
        analiseSessoes
      }
    };
    
    global.emitTraffic('Bot Análises', 'completed', 'Análises específicas processadas');
    global.emitJson(response);
    
    res.json(response);
    
  } catch (error) {
    global.emitTraffic('Bot Análises', 'error', 'Erro ao processar análises específicas');
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

module.exports = router;
