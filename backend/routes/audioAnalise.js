// VERSION: v2.0.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
const express = require('express');
const router = express.Router();
// AudioAnaliseStatus removido - campos fundidos em QualidadeAvaliacao
const AudioAnaliseResult = require('../models/AudioAnaliseResult');
const QualidadeAvaliacao = require('../models/QualidadeAvaliacao');
const { generateUploadSignedUrl, validateFileType, validateFileSize } = require('../config/gcs');

// POST /api/audio-analise/generate-upload-url - Gera Signed URL do GCS e cria registro com sent=true, treated=false
router.post('/generate-upload-url', async (req, res) => {
  try {
    const { nomeArquivo, mimeType, fileSize, avaliacaoId } = req.body;

    // Validações obrigatórias
    if (!nomeArquivo || !mimeType) {
      if (global.emitTraffic) {
        global.emitTraffic('POST /api/audio-analise/generate-upload-url', 'ERROR', 'Nome do arquivo e tipo MIME são obrigatórios');
      }
      
      return res.status(400).json({
        success: false,
        error: 'Nome do arquivo e tipo MIME são obrigatórios'
      });
    }

    // Validar tipo de arquivo
    const typeValidation = validateFileType(mimeType, nomeArquivo);
    if (!typeValidation.valid) {
      if (global.emitTraffic) {
        global.emitTraffic('POST /api/audio-analise/generate-upload-url', 'ERROR', typeValidation.error);
      }
      
      return res.status(400).json({
        success: false,
        error: typeValidation.error
      });
    }

    // Validar tamanho do arquivo (se fornecido)
    if (fileSize) {
      const sizeValidation = validateFileSize(fileSize);
      if (!sizeValidation.valid) {
        if (global.emitTraffic) {
          global.emitTraffic('POST /api/audio-analise/generate-upload-url', 'ERROR', sizeValidation.error);
        }
        
        return res.status(400).json({
          success: false,
          error: sizeValidation.error
        });
      }
    }

    // Verificar se já existe upload pendente para esta avaliação
    if (avaliacaoId) {
      const avaliacao = await QualidadeAvaliacao.findById(avaliacaoId);
      
      if (avaliacao && avaliacao.audioSent && !avaliacao.audioTreated) {
        if (global.emitTraffic) {
          global.emitTraffic('POST /api/audio-analise/generate-upload-url', 'ERROR', 'Já existe um upload pendente para esta avaliação');
        }
        
        return res.status(400).json({
          success: false,
          error: 'Já existe um upload pendente para esta avaliação. Aguarde o processamento concluir antes de enviar um novo arquivo.'
        });
      }
    }

    // Gerar Signed URL
    const uploadData = await generateUploadSignedUrl(nomeArquivo, mimeType);

    // Atualizar QualidadeAvaliacao diretamente com campos de status de áudio
    if (avaliacaoId) {
      const avaliacao = await QualidadeAvaliacao.findById(avaliacaoId);
      
      if (!avaliacao) {
        if (global.emitTraffic) {
          global.emitTraffic('POST /api/audio-analise/generate-upload-url', 'ERROR', 'Avaliação não encontrada');
        }
        
        return res.status(404).json({
          success: false,
          error: 'Avaliação não encontrada'
        });
      }
      
      // Atualizar campos de status de áudio
      avaliacao.nomeArquivoAudio = uploadData.fileName;
      avaliacao.audioSent = true;
      avaliacao.audioTreated = false;
      avaliacao.audioCreatedAt = new Date();
      avaliacao.audioUpdatedAt = new Date();
      
      await avaliacao.save();
    }

    if (global.emitTraffic) {
      global.emitTraffic('POST /api/audio-analise/generate-upload-url', 'SUCCESS', `Signed URL gerada para ${uploadData.fileName}`);
    }

    if (global.emitJson) {
      global.emitJson({
        tipo: 'OUTBOUND',
        origem: 'Audio Analise',
        dados: {
          avaliacaoId: avaliacaoId || null,
          uploadUrl: uploadData.url,
          fileName: uploadData.fileName,
          expiresIn: uploadData.expiresIn
        }
      });
    }

    res.json({
      success: true,
      data: {
        avaliacaoId: avaliacaoId || null,
        uploadUrl: uploadData.url,
        fileName: uploadData.fileName,
        bucket: uploadData.bucket,
        expiresIn: uploadData.expiresIn
      }
    });
  } catch (error) {
    console.error('Erro ao gerar Signed URL:', error);
    
    if (global.emitTraffic) {
      global.emitTraffic('POST /api/audio-analise/generate-upload-url', 'ERROR', error.message);
    }
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor ao gerar URL de upload'
    });
  }
});

// GET /api/audio-analise/status/:id - Retorna status do processamento (verifica sent e treated)
// Agora aceita avaliacaoId em vez de audioStatusId
router.get('/status/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const avaliacao = await QualidadeAvaliacao.findById(id);

    if (!avaliacao) {
      if (global.emitTraffic) {
        global.emitTraffic(`GET /api/audio-analise/status/${id}`, 'ERROR', 'Avaliação não encontrada');
      }
      
      return res.status(404).json({
        success: false,
        error: 'Avaliação não encontrada'
      });
    }

    // Verificar se tem status de áudio
    if (!avaliacao.audioSent) {
      return res.json({
        success: true,
        data: {
          avaliacaoId: avaliacao._id,
          nomeArquivoAudio: null,
          status: 'pendente',
          sent: false,
          treated: false,
          audioCreatedAt: null,
          audioUpdatedAt: null
        }
      });
    }

    // Determinar status baseado em sent e treated
    let status = 'pendente';
    if (avaliacao.audioSent && !avaliacao.audioTreated) {
      status = 'processando';
    } else if (avaliacao.audioTreated) {
      status = 'concluido';
    }

    // Disparar evento SSE se status mudou para concluido
    if (status === 'concluido' && global.broadcastAudioEvent) {
      global.broadcastAudioEvent(avaliacao._id.toString(), 'concluido', {
        nomeArquivo: avaliacao.nomeArquivoAudio
      });
    }

    if (global.emitTraffic) {
      global.emitTraffic(`GET /api/audio-analise/status/${id}`, 'SUCCESS', `Status: ${status}`);
    }

    if (global.emitJson) {
      global.emitJson({
        tipo: 'OUTBOUND',
        origem: 'Audio Analise',
        dados: {
          avaliacaoId: avaliacao._id,
          status: status,
          sent: avaliacao.audioSent,
          treated: avaliacao.audioTreated
        }
      });
    }

    res.json({
      success: true,
      data: {
        avaliacaoId: avaliacao._id,
        nomeArquivoAudio: avaliacao.nomeArquivoAudio,
        status: status,
        sent: avaliacao.audioSent,
        treated: avaliacao.audioTreated,
        audioCreatedAt: avaliacao.audioCreatedAt,
        audioUpdatedAt: avaliacao.audioUpdatedAt
      }
    });
  } catch (error) {
    console.error('Erro ao buscar status:', error);
    
    if (global.emitTraffic) {
      global.emitTraffic(`GET /api/audio-analise/status/${req.params.id}`, 'ERROR', error.message);
    }
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/audio-analise/status-por-avaliacao/:avaliacaoId - Retorna status de áudio por avaliacaoId
router.get('/status-por-avaliacao/:avaliacaoId', async (req, res) => {
  try {
    const { avaliacaoId } = req.params;

    if (!avaliacaoId) {
      if (global.emitTraffic) {
        global.emitTraffic('GET /api/audio-analise/status-por-avaliacao/:avaliacaoId', 'ERROR', 'ID da avaliação é obrigatório');
      }
      
      return res.status(400).json({
        success: false,
        error: 'ID da avaliação é obrigatório'
      });
    }

    const avaliacao = await QualidadeAvaliacao.findById(avaliacaoId);

    if (!avaliacao) {
      if (global.emitTraffic) {
        global.emitTraffic(`GET /api/audio-analise/status-por-avaliacao/${avaliacaoId}`, 'SUCCESS', 'Avaliação não encontrada');
      }
      
      return res.json({
        success: true,
        data: null
      });
    }

    // Verificar se tem status de áudio
    if (!avaliacao.audioSent) {
      return res.json({
        success: true,
        data: null
      });
    }

    if (global.emitTraffic) {
      global.emitTraffic(`GET /api/audio-analise/status-por-avaliacao/${avaliacaoId}`, 'SUCCESS', `Status encontrado: sent=${avaliacao.audioSent}, treated=${avaliacao.audioTreated}`);
    }

    if (global.emitJson) {
      global.emitJson({
        tipo: 'OUTBOUND',
        origem: 'Audio Analise',
        dados: {
          avaliacaoId: avaliacaoId,
          sent: avaliacao.audioSent,
          treated: avaliacao.audioTreated,
          nomeArquivoAudio: avaliacao.nomeArquivoAudio
        }
      });
    }

    res.json({
      success: true,
      data: {
        avaliacaoId: avaliacao._id,
        nomeArquivoAudio: avaliacao.nomeArquivoAudio,
        sent: avaliacao.audioSent,
        treated: avaliacao.audioTreated,
        audioCreatedAt: avaliacao.audioCreatedAt,
        audioUpdatedAt: avaliacao.audioUpdatedAt
      }
    });
  } catch (error) {
    console.error('Erro ao buscar status por avaliacaoId:', error);
    
    if (global.emitTraffic) {
      global.emitTraffic(`GET /api/audio-analise/status-por-avaliacao/${req.params.avaliacaoId}`, 'ERROR', error.message);
    }
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor ao buscar status'
    });
  }
});

// GET /api/audio-analise/result/:id - Busca resultado completo da análise
// Agora aceita avaliacaoId em vez de audioStatusId
router.get('/result/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Buscar resultado da análise usando avaliacaoMonitorId
    const result = await AudioAnaliseResult.findOne({ avaliacaoMonitorId: id })
      .populate({
        path: 'avaliacaoMonitorId',
        model: 'QualidadeAvaliacao',
        strictPopulate: false
      });

    if (!result) {
      if (global.emitTraffic) {
        global.emitTraffic(`GET /api/audio-analise/result/${id}`, 'ERROR', 'Resultado não encontrado');
      }
      
      return res.status(404).json({
        success: false,
        error: 'Resultado da análise não encontrado. O processamento pode ainda estar em andamento.'
      });
    }

    if (global.emitTraffic) {
      global.emitTraffic(`GET /api/audio-analise/result/${id}`, 'SUCCESS', 'Resultado encontrado');
    }

    if (global.emitJson) {
      global.emitJson({
        tipo: 'OUTBOUND',
        origem: 'Audio Analise',
        dados: result.toObject()
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Erro ao buscar resultado:', error);
    
    if (global.emitTraffic) {
      global.emitTraffic(`GET /api/audio-analise/result/${req.params.id}`, 'ERROR', error.message);
    }
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// POST /api/audio-analise/notify-completed - Notificação de conclusão (chamado pelo worker)
// Agora recebe avaliacaoId em vez de audioId
router.post('/notify-completed', async (req, res) => {
  try {
    const { avaliacaoId } = req.body;

    if (!avaliacaoId) {
      return res.status(400).json({
        success: false,
        error: 'avaliacaoId é obrigatório'
      });
    }

    // Buscar avaliação e atualizar audioTreated
    const avaliacao = await QualidadeAvaliacao.findById(avaliacaoId);

    if (!avaliacao) {
      return res.status(404).json({
        success: false,
        error: 'Avaliação não encontrada'
      });
    }

    // Atualizar audioTreated diretamente na avaliação
    avaliacao.audioTreated = true;
    avaliacao.audioUpdatedAt = new Date();
    await avaliacao.save();

    // Disparar evento SSE de conclusão
    if (global.broadcastAudioEvent) {
      global.broadcastAudioEvent(avaliacaoId, 'concluido', {
        nomeArquivoAudio: avaliacao.nomeArquivoAudio,
        treated: avaliacao.audioTreated
      });
    }

    if (global.emitTraffic) {
      global.emitTraffic('POST /api/audio-analise/notify-completed', 'SUCCESS', `Notificação enviada para avaliacaoId: ${avaliacaoId}`);
    }

    res.json({
      success: true,
      message: 'Notificação de conclusão enviada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao notificar conclusão:', error);
    
    if (global.emitTraffic) {
      global.emitTraffic('POST /api/audio-analise/notify-completed', 'ERROR', error.message);
    }
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/audio-analise/media-agente/:colaboradorNome - Calcular média IA do agente
router.get('/media-agente/:colaboradorNome', async (req, res) => {
  try {
    const { colaboradorNome } = req.params;
    const { dataInicio, dataFim } = req.query;

    if (!colaboradorNome) {
      if (global.emitTraffic) {
        global.emitTraffic('GET /api/audio-analise/media-agente/:colaboradorNome', 'ERROR', 'Nome do colaborador é obrigatório');
      }
      
      return res.status(400).json({
        success: false,
        error: 'Nome do colaborador é obrigatório'
      });
    }

    // Buscar todas as análises com populate do avaliacaoMonitorId
    const results = await AudioAnaliseResult.find({})
      .populate({
        path: 'avaliacaoMonitorId',
        model: 'QualidadeAvaliacao',
        select: 'colaboradorNome dataLigacao',
        strictPopulate: false
      })
      .sort({ createdAt: -1 });

    // Filtrar análises do colaborador específico
    const analisesDoColaborador = [];
    
    for (const result of results) {
      const resultObj = result.toObject();
      
      // Se houver avaliacaoMonitorId populado, verificar colaboradorNome diretamente
      if (resultObj.avaliacaoMonitorId && resultObj.avaliacaoMonitorId.colaboradorNome) {
        try {
          if (resultObj.avaliacaoMonitorId.colaboradorNome === colaboradorNome) {
            // Verificar filtro de período se fornecido
            if (dataInicio || dataFim) {
              const dataCriacao = new Date(resultObj.createdAt);
              if (isNaN(dataCriacao.getTime())) continue;
              
              // Normalizar para início do dia
              const inicio = dataInicio ? new Date(dataInicio) : null;
              if (inicio) inicio.setHours(0, 0, 0, 0);
              
              const fim = dataFim ? new Date(dataFim) : null;
              if (fim) fim.setHours(23, 59, 59, 999);
              
              const dataNormalizada = new Date(dataCriacao);
              dataNormalizada.setHours(0, 0, 0, 0);
              
              const dentroInicio = !inicio || dataNormalizada >= inicio;
              const dentroFim = !fim || dataNormalizada <= fim;
              
              if (!dentroInicio || !dentroFim) {
                continue; // Pular se não estiver no período
              }
            }
            
            // Adicionar análise se tiver pontuação
            // Priorizar pontuacaoConsensual, depois gptAnalysis.pontuacao, depois qualityAnalysis.pontuacao
            let pontuacao = null;
            if (resultObj.pontuacaoConsensual !== null && resultObj.pontuacaoConsensual !== undefined && typeof resultObj.pontuacaoConsensual === 'number') {
              pontuacao = resultObj.pontuacaoConsensual;
            } else if (resultObj.gptAnalysis && typeof resultObj.gptAnalysis.pontuacao === 'number') {
              pontuacao = resultObj.gptAnalysis.pontuacao;
            } else if (resultObj.qualityAnalysis && typeof resultObj.qualityAnalysis.pontuacao === 'number') {
              pontuacao = resultObj.qualityAnalysis.pontuacao;
            }
            
            if (pontuacao !== null) {
              analisesDoColaborador.push(pontuacao);
            }
          }
        } catch (error) {
          console.error('Erro ao buscar avaliação:', error);
        }
      }
    }

    // Calcular média
    let mediaIA = null;
    if (analisesDoColaborador.length > 0) {
      const soma = analisesDoColaborador.reduce((a, b) => a + b, 0);
      mediaIA = Math.round((soma / analisesDoColaborador.length) * 100) / 100;
    }

    // Log detalhado para debug
    console.log(`[DEBUG] Média IA calculada para ${colaboradorNome}:`, {
      mediaIA,
      totalAnalises: analisesDoColaborador.length,
      periodo: { inicio: dataInicio || null, fim: dataFim || null },
      pontuacoes: analisesDoColaborador
    });

    if (global.emitTraffic) {
      global.emitTraffic(`GET /api/audio-analise/media-agente/${colaboradorNome}`, 'SUCCESS', `Média IA: ${mediaIA || 'N/A'}, Total: ${analisesDoColaborador.length}`);
    }

    res.json({
      success: true,
      mediaIA: mediaIA,
      totalAnalises: analisesDoColaborador.length,
      periodo: {
        inicio: dataInicio || null,
        fim: dataFim || null
      }
    });
  } catch (error) {
    console.error('[ERROR] Erro ao calcular média IA do agente:', error);
    console.error('[ERROR] Stack trace:', error.stack);
    
    if (global.emitTraffic) {
      global.emitTraffic(`GET /api/audio-analise/media-agente/${req.params.colaboradorNome}`, 'ERROR', error.message);
    }
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor ao calcular média IA',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/audio-analise/listar - Listar análises por colaborador
router.get('/listar', async (req, res) => {
  try {
    const { colaboradorNome, mes, ano } = req.query;

    if (!colaboradorNome) {
      if (global.emitTraffic) {
        global.emitTraffic('GET /api/audio-analise/listar', 'ERROR', 'Nome do colaborador é obrigatório');
      }
      
      return res.status(400).json({
        success: false,
        error: 'Nome do colaborador é obrigatório'
      });
    }

    // Buscar todas as análises com populate do avaliacaoMonitorId
    const results = await AudioAnaliseResult.find({})
      .populate({
        path: 'avaliacaoMonitorId',
        model: 'QualidadeAvaliacao',
        select: 'colaboradorNome dataLigacao',
        strictPopulate: false
      })
      .sort({ createdAt: -1 })
      .limit(100); // Limitar a 100 resultados

    // Processar resultados e adicionar colaboradorNome diretamente do populate
    const analisesComColaborador = [];
    
    for (const result of results) {
      const resultObj = result.toObject();
      let colaboradorEncontrado = null;

      // Obter colaboradorNome diretamente do populate de avaliacaoMonitorId
      let avaliacaoData = null;
      if (resultObj.avaliacaoMonitorId) {
        try {
          colaboradorEncontrado = resultObj.avaliacaoMonitorId.colaboradorNome;
          avaliacaoData = {
            dataLigacao: resultObj.avaliacaoMonitorId.dataLigacao,
            avaliacaoId: resultObj.avaliacaoMonitorId._id
          };
        } catch (error) {
          console.error('Erro ao processar avaliação:', error);
        }
      }

      // Filtrar por colaboradorNome se fornecido
      if (colaboradorNome && colaboradorEncontrado !== colaboradorNome) {
        continue; // Pular este resultado se não corresponder ao colaborador
      }

      // Filtrar por ano se fornecido
      if (ano) {
        const resultYear = new Date(resultObj.createdAt).getFullYear();
        if (resultYear !== parseInt(ano)) {
          continue;
        }
      }

      // Filtrar por mês se fornecido (comparar nome do mês em português)
      if (mes) {
        const mesesPtBr = [
          'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        const resultDate = new Date(resultObj.createdAt);
        const resultMonth = mesesPtBr[resultDate.getMonth()];
        if (resultMonth !== mes) {
          continue;
        }
      }

      // Adicionar colaboradorNome ao resultado
      resultObj.colaboradorNome = colaboradorEncontrado || null;
      
      // Mapear campos para o formato esperado pelo frontend
      const analiseMapeada = {
        ...resultObj,
        // Mapear pontuacaoGPT
        pontuacaoGPT: resultObj.pontuacaoConsensual !== null && resultObj.pontuacaoConsensual !== undefined 
          ? resultObj.pontuacaoConsensual 
          : (resultObj.gptAnalysis?.pontuacao || null),
        // Mapear analiseGPT
        analiseGPT: resultObj.gptAnalysis?.analysis || null,
        // Mapear palavrasCriticas
        palavrasCriticas: resultObj.gptAnalysis?.palavrasCriticas || resultObj.qualityAnalysis?.palavrasCriticas || [],
        // Mapear confianca
        confianca: resultObj.gptAnalysis?.confianca || null,
        // Dados da avaliação
        dataLigacao: avaliacaoData?.dataLigacao || null,
        avaliacaoId: resultObj.avaliacaoMonitorId?._id || null,
        // Campos de emoção e nuance
        emotion: resultObj.emotion || null,
        nuance: resultObj.nuance || null,
        // Cálculo detalhado
        calculoDetalhado: resultObj.qualityAnalysis?.calculoDetalhado || null,
        // Extrair mes e ano de createdAt
        mes: resultObj.createdAt ? (() => {
          const mesesPtBr = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
          ];
          const date = new Date(resultObj.createdAt);
          return mesesPtBr[date.getMonth()];
        })() : null,
        ano: resultObj.createdAt ? new Date(resultObj.createdAt).getFullYear() : null
      };
      
      analisesComColaborador.push(analiseMapeada);
    }

    // Log detalhado para debug
    console.log(`[DEBUG] Análises listadas:`, {
      colaboradorNome,
      mes,
      ano,
      totalEncontradas: analisesComColaborador.length,
      primeiraAnalise: analisesComColaborador[0] || null
    });

    if (global.emitTraffic) {
      global.emitTraffic('GET /api/audio-analise/listar', 'SUCCESS', `${analisesComColaborador.length} análises encontradas`);
    }

    res.json({
      success: true,
      analises: analisesComColaborador,
      count: analisesComColaborador.length
    });
  } catch (error) {
    console.error('[ERROR] Erro ao listar análises:', error);
    console.error('[ERROR] Stack trace:', error.stack);
    
    if (global.emitTraffic) {
      global.emitTraffic('GET /api/audio-analise/listar', 'ERROR', error.message);
    }
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor ao listar análises',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/audio-analise/:id - Busca registro completo por ID
// Agora busca QualidadeAvaliacao em vez de AudioAnaliseStatus
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const avaliacao = await QualidadeAvaliacao.findById(id);

    if (!avaliacao) {
      if (global.emitTraffic) {
        global.emitTraffic(`GET /api/audio-analise/${id}`, 'ERROR', 'Avaliação não encontrada');
      }
      
      return res.status(404).json({
        success: false,
        error: 'Avaliação não encontrada'
      });
    }

    // Retornar apenas campos de status de áudio
    const audioStatusData = {
      avaliacaoId: avaliacao._id,
      nomeArquivoAudio: avaliacao.nomeArquivoAudio,
      audioSent: avaliacao.audioSent,
      audioTreated: avaliacao.audioTreated,
      audioCreatedAt: avaliacao.audioCreatedAt,
      audioUpdatedAt: avaliacao.audioUpdatedAt
    };

    if (global.emitTraffic) {
      global.emitTraffic(`GET /api/audio-analise/${id}`, 'SUCCESS', 'Registro encontrado');
    }

    if (global.emitJson) {
      global.emitJson({
        tipo: 'OUTBOUND',
        origem: 'Audio Analise',
        dados: audioStatusData
      });
    }

    res.json({
      success: true,
      data: audioStatusData
    });
  } catch (error) {
    console.error('Erro ao buscar registro:', error);
    
    if (global.emitTraffic) {
      global.emitTraffic(`GET /api/audio-analise/${req.params.id}`, 'ERROR', error.message);
    }
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// PUT /api/audio-analise/:id/editar-analise - Editar campo analysis da análise
router.put('/:id/editar-analise', async (req, res) => {
  try {
    const { id } = req.params;
    const { analysis, tipo = 'gpt' } = req.body;

    if (!id) {
      if (global.emitTraffic) {
        global.emitTraffic('PUT /api/audio-analise/:id/editar-analise', 'ERROR', 'ID da análise é obrigatório');
      }
      
      return res.status(400).json({
        success: false,
        error: 'ID da análise é obrigatório'
      });
    }

    if (!analysis || typeof analysis !== 'string') {
      if (global.emitTraffic) {
        global.emitTraffic('PUT /api/audio-analise/:id/editar-analise', 'ERROR', 'Campo analysis é obrigatório e deve ser uma string');
      }
      
      return res.status(400).json({
        success: false,
        error: 'Campo analysis é obrigatório e deve ser uma string'
      });
    }

    if (tipo !== 'gpt' && tipo !== 'quality') {
      if (global.emitTraffic) {
        global.emitTraffic('PUT /api/audio-analise/:id/editar-analise', 'ERROR', 'Tipo deve ser "gpt" ou "quality"');
      }
      
      return res.status(400).json({
        success: false,
        error: 'Tipo deve ser "gpt" ou "quality"'
      });
    }

    // Buscar a análise
    const analise = await AudioAnaliseResult.findById(id);

    if (!analise) {
      if (global.emitTraffic) {
        global.emitTraffic(`PUT /api/audio-analise/${id}/editar-analise`, 'ERROR', 'Análise não encontrada');
      }
      
      return res.status(404).json({
        success: false,
        error: 'Análise não encontrada'
      });
    }

    // Atualizar o campo analysis conforme o tipo
    if (tipo === 'gpt') {
      if (!analise.gptAnalysis) {
        analise.gptAnalysis = {};
      }
      analise.gptAnalysis.analysis = analysis;
    } else {
      if (!analise.qualityAnalysis) {
        analise.qualityAnalysis = {};
      }
      analise.qualityAnalysis.analysis = analysis;
    }

    // Salvar alterações
    await analise.save();

    // Log de auditoria
    console.log(`[AUDITORIA] Análise ${id} editada - Tipo: ${tipo}, Data: ${new Date().toISOString()}`);

    if (global.emitTraffic) {
      global.emitTraffic(`PUT /api/audio-analise/${id}/editar-analise`, 'SUCCESS', `Análise ${tipo} editada com sucesso`);
    }

    if (global.emitJson) {
      global.emitJson({
        tipo: 'OUTBOUND',
        origem: 'Audio Analise',
        dados: {
          id: analise._id,
          tipo: tipo,
          analysis: analysis.substring(0, 100) + '...' // Primeiros 100 caracteres para log
        }
      });
    }

    res.json({
      success: true,
      message: 'Análise editada com sucesso',
      data: {
        id: analise._id,
        tipo: tipo,
        analysis: analise.gptAnalysis?.analysis || analise.qualityAnalysis?.analysis
      }
    });
  } catch (error) {
    console.error('[ERROR] Erro ao editar análise:', error);
    console.error('[ERROR] Stack trace:', error.stack);
    
    if (global.emitTraffic) {
      global.emitTraffic(`PUT /api/audio-analise/${req.params.id}/editar-analise`, 'ERROR', error.message);
    }
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor ao editar análise',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;

