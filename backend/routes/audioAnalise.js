// VERSION: v1.4.0 | DATE: 2025-11-25 | AUTHOR: VeloHub Development Team
const express = require('express');
const router = express.Router();
const AudioAnaliseStatus = require('../models/AudioAnaliseStatus');
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
      const existingStatus = await AudioAnaliseStatus.findOne({ 
        avaliacaoId: avaliacaoId,
        sent: true 
      });

      if (existingStatus && !existingStatus.treated) {
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

    // Criar registro no MongoDB com sent=true e treated=false
    const audioStatusData = {
      nomeArquivo: uploadData.fileName,
      sent: true,
      treated: false
    };

    // Adicionar avaliacaoId se fornecido
    if (avaliacaoId) {
      audioStatusData.avaliacaoId = avaliacaoId;
    }

    const audioStatus = new AudioAnaliseStatus(audioStatusData);

    await audioStatus.save();

    if (global.emitTraffic) {
      global.emitTraffic('POST /api/audio-analise/generate-upload-url', 'SUCCESS', `Signed URL gerada para ${uploadData.fileName}`);
    }

    if (global.emitJson) {
      global.emitJson({
        tipo: 'OUTBOUND',
        origem: 'Audio Analise',
        dados: {
          audioId: audioStatus._id,
          uploadUrl: uploadData.url,
          fileName: uploadData.fileName,
          expiresIn: uploadData.expiresIn
        }
      });
    }

    res.json({
      success: true,
      data: {
        audioId: audioStatus._id,
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
router.get('/status/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const audioStatus = await AudioAnaliseStatus.findById(id);

    if (!audioStatus) {
      if (global.emitTraffic) {
        global.emitTraffic(`GET /api/audio-analise/status/${id}`, 'ERROR', 'Registro não encontrado');
      }
      
      return res.status(404).json({
        success: false,
        error: 'Registro não encontrado'
      });
    }

    // Determinar status baseado em sent e treated
    let status = 'pendente';
    if (audioStatus.sent && !audioStatus.treated) {
      status = 'processando';
    } else if (audioStatus.treated) {
      status = 'concluido';
    }

    // Disparar evento SSE se status mudou para concluido
    if (status === 'concluido' && global.broadcastAudioEvent) {
      global.broadcastAudioEvent(audioStatus._id.toString(), 'concluido', {
        nomeArquivo: audioStatus.nomeArquivo
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
          audioId: audioStatus._id,
          status: status,
          sent: audioStatus.sent,
          treated: audioStatus.treated
        }
      });
    }

    res.json({
      success: true,
      data: {
        audioId: audioStatus._id,
        nomeArquivo: audioStatus.nomeArquivo,
        status: status,
        sent: audioStatus.sent,
        treated: audioStatus.treated,
        createdAt: audioStatus.createdAt,
        updatedAt: audioStatus.updatedAt
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

    const audioStatus = await AudioAnaliseStatus.findOne({ avaliacaoId });

    if (!audioStatus) {
      if (global.emitTraffic) {
        global.emitTraffic(`GET /api/audio-analise/status-por-avaliacao/${avaliacaoId}`, 'SUCCESS', 'Nenhum status encontrado');
      }
      
      return res.json({
        success: true,
        data: null
      });
    }

    if (global.emitTraffic) {
      global.emitTraffic(`GET /api/audio-analise/status-por-avaliacao/${avaliacaoId}`, 'SUCCESS', `Status encontrado: sent=${audioStatus.sent}, treated=${audioStatus.treated}`);
    }

    if (global.emitJson) {
      global.emitJson({
        tipo: 'OUTBOUND',
        origem: 'Audio Analise',
        dados: {
          avaliacaoId: avaliacaoId,
          audioId: audioStatus._id,
          sent: audioStatus.sent,
          treated: audioStatus.treated,
          nomeArquivo: audioStatus.nomeArquivo
        }
      });
    }

    res.json({
      success: true,
      data: {
        audioId: audioStatus._id,
        nomeArquivo: audioStatus.nomeArquivo,
        sent: audioStatus.sent,
        treated: audioStatus.treated,
        createdAt: audioStatus.createdAt,
        updatedAt: audioStatus.updatedAt
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
router.get('/result/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Buscar resultado da análise
    const result = await AudioAnaliseResult.findOne({ audioStatusId: id });

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
router.post('/notify-completed', async (req, res) => {
  try {
    const { audioId } = req.body;

    if (!audioId) {
      return res.status(400).json({
        success: false,
        error: 'audioId é obrigatório'
      });
    }

    // Buscar status
    const audioStatus = await AudioAnaliseStatus.findById(audioId);

    if (!audioStatus) {
      return res.status(404).json({
        success: false,
        error: 'Registro não encontrado'
      });
    }

    // Disparar evento SSE de conclusão
    if (global.broadcastAudioEvent) {
      global.broadcastAudioEvent(audioId, 'concluido', {
        nomeArquivo: audioStatus.nomeArquivo,
        treated: audioStatus.treated
      });
    }

    if (global.emitTraffic) {
      global.emitTraffic('POST /api/audio-analise/notify-completed', 'SUCCESS', `Notificação enviada para audioId: ${audioId}`);
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

    // Buscar todas as análises com populate do audioStatusId
    const results = await AudioAnaliseResult.find({})
      .populate({
        path: 'audioStatusId',
        model: 'AudioAnaliseStatus',
        select: 'avaliacaoId nomeArquivo',
        strictPopulate: false
      })
      .sort({ createdAt: -1 });

    // Filtrar análises do colaborador específico
    const analisesDoColaborador = [];
    
    for (const result of results) {
      const resultObj = result.toObject();
      
      // Se houver avaliacaoId, buscar a avaliação para obter colaboradorNome
      if (resultObj.audioStatusId && resultObj.audioStatusId.avaliacaoId) {
        try {
          const avaliacao = await QualidadeAvaliacao.findById(resultObj.audioStatusId.avaliacaoId);
          if (avaliacao && avaliacao.colaboradorNome === colaboradorNome) {
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

    // Buscar todas as análises com populate do audioStatusId
    const results = await AudioAnaliseResult.find({})
      .populate({
        path: 'audioStatusId',
        model: 'AudioAnaliseStatus',
        select: 'avaliacaoId nomeArquivo',
        strictPopulate: false
      })
      .sort({ createdAt: -1 })
      .limit(100); // Limitar a 100 resultados

    // Processar resultados e adicionar colaboradorNome quando houver avaliacaoId
    const analisesComColaborador = [];
    
    for (const result of results) {
      const resultObj = result.toObject();
      let colaboradorEncontrado = null;

      // Se houver avaliacaoId, buscar a avaliação para obter colaboradorNome
      if (resultObj.audioStatusId && resultObj.audioStatusId.avaliacaoId) {
        try {
          const avaliacao = await QualidadeAvaliacao.findById(resultObj.audioStatusId.avaliacaoId);
          if (avaliacao) {
            colaboradorEncontrado = avaliacao.colaboradorNome;
          }
        } catch (error) {
          console.error('Erro ao buscar avaliação:', error);
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
        palavrasCriticas: resultObj.gptAnalysis?.palavrasCriticas || [],
        // Mapear confianca
        confianca: resultObj.gptAnalysis?.confianca || null,
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
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const audioStatus = await AudioAnaliseStatus.findById(id);

    if (!audioStatus) {
      if (global.emitTraffic) {
        global.emitTraffic(`GET /api/audio-analise/${id}`, 'ERROR', 'Registro não encontrado');
      }
      
      return res.status(404).json({
        success: false,
        error: 'Registro não encontrado'
      });
    }

    if (global.emitTraffic) {
      global.emitTraffic(`GET /api/audio-analise/${id}`, 'SUCCESS', 'Registro encontrado');
    }

    if (global.emitJson) {
      global.emitJson({
        tipo: 'OUTBOUND',
        origem: 'Audio Analise',
        dados: audioStatus.toObject()
      });
    }

    res.json({
      success: true,
      data: audioStatus
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

module.exports = router;

