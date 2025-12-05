// VERSION: v3.4.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
const express = require('express');
const router = express.Router();
const BotPerguntas = require('../models/BotPerguntas');
const { processContentImages } = require('../utils/contentProcessor');

// GET /api/bot-perguntas - Listar todas as perguntas do bot
router.get('/', async (req, res) => {
  try {
    global.emitTraffic('Bot Perguntas', 'received', 'Entrada recebida - GET /api/bot-perguntas');
    global.emitLog('info', 'GET /api/bot-perguntas - Listando todas as perguntas do bot');
    
    const result = await BotPerguntas.getAll();
    
    global.emitTraffic('Bot Perguntas', 'completed', 'Concluído - Perguntas listadas com sucesso');
    global.emitLog('success', `GET /api/bot-perguntas - ${result.count} perguntas encontradas`);
    
       // INBOUND: Resposta para o frontend
    global.emitJsonInput(result);
 res.json(result);
  } catch (error) {
    global.emitTraffic('Bot Perguntas', 'error', 'Erro ao listar perguntas');
    global.emitLog('error', `GET /api/bot-perguntas - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// POST /api/bot-perguntas - Criar nova pergunta do bot
router.post('/', async (req, res) => {
  try {
    global.emitTraffic('Bot Perguntas', 'received', 'Entrada recebida - POST /api/bot-perguntas');
    global.emitLog('info', 'POST /api/bot-perguntas - Criando nova pergunta do bot');
    global.emitJson(req.body);
    
    const { pergunta, resposta, palavrasChave, sinonimos, tabulacao, media } = req.body;
    
    // Validar campos obrigatórios conforme schema MongoDB padrão
    if (!pergunta || !resposta || !palavrasChave) {
      global.emitTraffic('Bot Perguntas', 'error', 'Dados obrigatórios ausentes');
      global.emitLog('error', 'POST /api/bot-perguntas - pergunta, resposta e palavrasChave são obrigatórios');
      return res.status(400).json({ 
        success: false, 
        error: 'pergunta, resposta e palavrasChave são obrigatórios' 
      });
    }

    // Processar conteúdo: substituir URLs blob temporárias por URLs do GCS
    const imagePaths = media?.images || [];
    let processedResposta = resposta;
    
    if (imagePaths.length > 0) {
      console.log(`🔍 [POST /api/bot-perguntas] Processando ${imagePaths.length} imagem(ns) no conteúdo`);
      console.log(`🔍 [POST /api/bot-perguntas] Resposta antes: ${resposta.substring(0, 200)}`);
      
      processedResposta = processContentImages(resposta, imagePaths);
      
      console.log(`🔍 [POST /api/bot-perguntas] Resposta depois: ${processedResposta.substring(0, 200)}`);
    }

    const perguntaData = {
      pergunta,
      resposta: processedResposta, // Usar resposta processada com URLs do GCS
      palavrasChave,
      sinonimos: sinonimos || '',
      tabulacao: tabulacao || '',
      media: media || { images: [], videos: [] } // Campo media com arrays vazios por padrão
    };

       // OUTBOUND: Schema sendo enviado para MongoDB
    global.emitJson(perguntaData);

    global.emitTraffic('Bot Perguntas', 'processing', 'Transmitindo para DB');
    const result = await BotPerguntas.create(perguntaData);
    
    if (result.success) {
      global.emitTraffic('Bot Perguntas', 'completed', 'Concluído - Pergunta criada com sucesso');
      global.emitLog('success', `POST /api/bot-perguntas - Pergunta "${pergunta}" criada com sucesso`);
      global.emitJson(result);
      // INBOUND: Resposta para o frontend
      global.emitJsonInput(result);
      res.status(201).json(result);
    } else {
      global.emitTraffic('Bot Perguntas', 'error', 'Erro ao criar pergunta');
      global.emitLog('error', 'POST /api/bot-perguntas - Erro ao criar pergunta');
      res.status(500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Bot Perguntas', 'error', 'Erro interno do servidor');
    global.emitLog('error', `POST /api/bot-perguntas - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// PUT /api/bot-perguntas/:id - Atualizar pergunta do bot
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { pergunta, resposta, palavrasChave, sinonimos, tabulacao, media } = req.body;
    
    global.emitTraffic('Bot Perguntas', 'received', `Entrada recebida - PUT /api/bot-perguntas/${id}`);
    global.emitLog('info', `PUT /api/bot-perguntas/${id} - Atualizando pergunta do bot`);
    global.emitJson({ id, ...req.body });
    
    const updateData = {};
    if (pergunta) updateData.pergunta = pergunta;
    if (resposta) {
      // Processar conteúdo se houver imagens
      const imagePaths = media?.images || [];
      if (imagePaths.length > 0) {
        console.log(`🔍 [PUT /api/bot-perguntas/${id}] Processando ${imagePaths.length} imagem(ns) no conteúdo`);
        updateData.resposta = processContentImages(resposta, imagePaths);
      } else {
        updateData.resposta = resposta;
      }
    }
    if (palavrasChave) updateData.palavrasChave = palavrasChave;
    if (sinonimos !== undefined) updateData.sinonimos = sinonimos;
    if (tabulacao !== undefined) updateData.tabulacao = tabulacao;
    if (media !== undefined) updateData.media = media;

    global.emitTraffic('Bot Perguntas', 'processing', 'Transmitindo para DB');
    const result = await BotPerguntas.update(id, updateData);
    
    if (result.success) {
      global.emitTraffic('Bot Perguntas', 'completed', 'Concluído - Pergunta atualizada com sucesso');
      global.emitLog('success', `PUT /api/bot-perguntas/${id} - Pergunta atualizada com sucesso`);
      global.emitJson(result);
      res.json(result);
    } else {
      global.emitTraffic('Bot Perguntas', 'error', result.error);
      global.emitLog('error', `PUT /api/bot-perguntas/${id} - ${result.error}`);
      res.status(result.error === 'Pergunta não encontrada' ? 404 : 500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Bot Perguntas', 'error', 'Erro interno do servidor');
    global.emitLog('error', `PUT /api/bot-perguntas/:id - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// DELETE /api/bot-perguntas/:id - Deletar pergunta do bot
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    global.emitTraffic('Bot Perguntas', 'received', `Entrada recebida - DELETE /api/bot-perguntas/${id}`);
    global.emitLog('info', `DELETE /api/bot-perguntas/${id} - Deletando pergunta do bot`);
       // OUTBOUND: ID sendo deletado
    global.emitJson({ id });

 global.emitTraffic('Bot Perguntas', 'processing', 'Transmitindo para DB');
    const result = await BotPerguntas.delete(id);
    
    if (result.success) {
      global.emitTraffic('Bot Perguntas', 'completed', 'Concluído - Pergunta deletada com sucesso');
      global.emitLog('success', `DELETE /api/bot-perguntas/${id} - Pergunta deletada com sucesso`);
      global.emitJson(result);
      // INBOUND: Confirmação para o frontend
      global.emitJsonInput(result);
      res.json(result);
    } else {
      global.emitTraffic('Bot Perguntas', 'error', result.error);
      global.emitLog('error', `DELETE /api/bot-perguntas/${id} - ${result.error}`);
      res.status(result.error === 'Pergunta não encontrada' ? 404 : 500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Bot Perguntas', 'error', 'Erro interno do servidor');
    global.emitLog('error', `DELETE /api/bot-perguntas/:id - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

module.exports = router;
