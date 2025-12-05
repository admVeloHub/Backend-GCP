// VERSION: v3.6.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
const express = require('express');
const router = express.Router();
const Velonews = require('../models/Velonews');
const { processContentImages } = require('../utils/contentProcessor');

// GET /api/velonews - Listar todas as velonews
router.get('/', async (req, res) => {
  try {
    global.emitTraffic('Velonews', 'received', 'Entrada recebida - GET /api/velonews');
    global.emitLog('info', 'GET /api/velonews - Listando todas as velonews');
    
    const result = await Velonews.getAll();
    
    global.emitTraffic('Velonews', 'processing', 'Consultando DB');
    
    global.emitTraffic('Velonews', 'completed', 'Concluído - Velonews listadas com sucesso');
    global.emitLog('success', `GET /api/velonews - ${result.count} velonews encontradas`);
    
    // INBOUND: Resposta para o frontend
    global.emitJsonInput(result);
    res.json(result);
  } catch (error) {
    global.emitTraffic('Velonews', 'error', 'Erro ao listar velonews');
    global.emitLog('error', `GET /api/velonews - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// GET /api/velonews/:id - Obter velonews por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    global.emitTraffic('Velonews', 'received', `Entrada recebida - GET /api/velonews/${id}`);
    global.emitLog('info', `GET /api/velonews/${id} - Obtendo velonews por ID`);
    
    global.emitTraffic('Velonews', 'processing', 'Consultando DB');
    const result = await Velonews.getById(id);
    
    if (result.success) {
      global.emitTraffic('Velonews', 'completed', 'Concluído - Velonews obtida com sucesso');
      global.emitLog('success', `GET /api/velonews/${id} - Velonews obtida com sucesso`);
      
      // INBOUND: Resposta para o frontend
      global.emitJsonInput(result);
      res.json(result);
    } else {
      global.emitTraffic('Velonews', 'error', result.error);
      global.emitLog('error', `GET /api/velonews/${id} - ${result.error}`);
      res.status(result.error === 'Velonews não encontrada' ? 404 : 500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Velonews', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/velonews/:id - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// POST /api/velonews - Criar nova velonews
router.post('/', async (req, res) => {
  try {
    global.emitTraffic('Velonews', 'received', 'Entrada recebida - POST /api/velonews');
    global.emitLog('info', 'POST /api/velonews - Criando nova velonews');
    
    const { titulo, conteudo, isCritical, solved, media } = req.body;
    
    // Validação mais flexível
    if (!titulo || titulo.trim().length === 0) {
      global.emitTraffic('Velonews', 'error', 'Título é obrigatório');
      global.emitLog('error', 'POST /api/velonews - Título é obrigatório');
      return res.status(400).json({ 
        success: false, 
        error: 'Título é obrigatório' 
      });
    }
    
    if (!conteudo || conteudo.trim().length === 0) {
      global.emitTraffic('Velonews', 'error', 'Conteúdo é obrigatório');
      global.emitLog('error', 'POST /api/velonews - Conteúdo é obrigatório');
      return res.status(400).json({ 
        success: false, 
        error: 'Conteúdo é obrigatório' 
      });
    }

    // Processar conteúdo: substituir URLs blob temporárias por URLs do GCS
    const imagePaths = media?.images || [];
    let processedConteudo = conteudo;
    
    if (imagePaths.length > 0) {
      console.log(`🔍 [POST /api/velonews] Processando ${imagePaths.length} imagem(ns) no conteúdo`);
      console.log(`🔍 [POST /api/velonews] Conteúdo antes: ${conteudo.substring(0, 200)}`);
      
      processedConteudo = processContentImages(conteudo, imagePaths);
      
      console.log(`🔍 [POST /api/velonews] Conteúdo depois: ${processedConteudo.substring(0, 200)}`);
    }

    const velonewsData = {
      titulo,
      conteudo: processedConteudo, // Usar conteúdo processado com URLs do GCS
      isCritical: isCritical || false,
      solved: solved || false,
      media: media || { images: [], videos: [] } // Campo media com arrays vazios por padrão
    };

    // OUTBOUND: Schema sendo enviado para MongoDB
    global.emitJson(velonewsData);

    global.emitTraffic('Velonews', 'processing', 'Transmitindo para DB');
    const result = await Velonews.create(velonewsData);
    
    if (result.success) {
      global.emitTraffic('Velonews', 'completed', 'Concluído - Velonews criada com sucesso');
      global.emitLog('success', `POST /api/velonews - Velonews "${titulo}" criada com sucesso`);
      
      // INBOUND: Resposta para o frontend
      global.emitJsonInput(result);
      res.status(201).json(result);
    } else {
      global.emitTraffic('Velonews', 'error', 'Erro ao criar velonews');
      global.emitLog('error', 'POST /api/velonews - Erro ao criar velonews');
      res.status(500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Velonews', 'error', 'Erro interno do servidor');
    global.emitLog('error', `POST /api/velonews - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// PUT /api/velonews/:id - Atualizar velonews
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, conteudo, isCritical, solved, media } = req.body;
    
    global.emitTraffic('Velonews', 'received', `Entrada recebida - PUT /api/velonews/${id}`);
    global.emitLog('info', `PUT /api/velonews/${id} - Atualizando velonews`);
    
    const updateData = {};
    if (titulo) updateData.titulo = titulo;
    if (conteudo) {
      // Processar conteúdo se houver imagens
      const imagePaths = media?.images || [];
      if (imagePaths.length > 0) {
        console.log(`🔍 [PUT /api/velonews/${id}] Processando ${imagePaths.length} imagem(ns) no conteúdo`);
        updateData.conteudo = processContentImages(conteudo, imagePaths);
      } else {
        updateData.conteudo = conteudo;
      }
    }
    if (isCritical !== undefined) updateData.isCritical = isCritical;
    if (solved !== undefined) updateData.solved = solved;
    if (media !== undefined) updateData.media = media;

    // OUTBOUND: Dados de atualização para MongoDB
    global.emitJson({ id, ...updateData });

    global.emitTraffic('Velonews', 'processing', 'Transmitindo para DB');
    const result = await Velonews.update(id, updateData);
    
    if (result.success) {
      global.emitTraffic('Velonews', 'completed', 'Concluído - Velonews atualizada com sucesso');
      global.emitLog('success', `PUT /api/velonews/${id} - Velonews atualizada com sucesso`);
      
      // INBOUND: Resposta para o frontend
      global.emitJsonInput(result);
      res.json(result);
    } else {
      global.emitTraffic('Velonews', 'error', result.error);
      global.emitLog('error', `PUT /api/velonews/${id} - ${result.error}`);
      res.status(result.error === 'Velonews não encontrada' ? 404 : 500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Velonews', 'error', 'Erro interno do servidor');
    global.emitLog('error', `PUT /api/velonews/:id - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// DELETE /api/velonews/:id - Deletar velonews
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    global.emitTraffic('Velonews', 'received', `Entrada recebida - DELETE /api/velonews/${id}`);
    global.emitLog('info', `DELETE /api/velonews/${id} - Deletando velonews`);
    
    // OUTBOUND: ID sendo deletado
    global.emitJson({ id });
    
    global.emitTraffic('Velonews', 'processing', 'Transmitindo para DB');
    const result = await Velonews.delete(id);
    
    if (result.success) {
      global.emitTraffic('Velonews', 'completed', 'Concluído - Velonews deletada com sucesso');
      global.emitLog('success', `DELETE /api/velonews/${id} - Velonews deletada com sucesso`);
      
      // INBOUND: Confirmação para o frontend
      global.emitJsonInput(result);
      res.json(result);
    } else {
      global.emitTraffic('Velonews', 'error', result.error);
      global.emitLog('error', `DELETE /api/velonews/${id} - ${result.error}`);
      res.status(result.error === 'Velonews não encontrada' ? 404 : 500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Velonews', 'error', 'Erro interno do servidor');
    global.emitLog('error', `DELETE /api/velonews/:id - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

module.exports = router;
