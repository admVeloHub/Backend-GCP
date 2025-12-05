// VERSION: v3.5.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
const express = require('express');
const router = express.Router();
const Artigos = require('../models/Artigos');
const { processContentImages } = require('../utils/contentProcessor');

// GET /api/artigos - Listar todos os artigos
router.get('/', async (req, res) => {
  try {
    global.emitTraffic('Artigos', 'received', 'Entrada recebida - GET /api/artigos');
    global.emitLog('info', 'GET /api/artigos - Listando todos os artigos');
    
    const result = await Artigos.getAll();
    
    global.emitTraffic('Artigos', 'processing', 'Consultando DB');
    
    global.emitTraffic('Artigos', 'completed', 'Concluído - Artigos listados com sucesso');
    global.emitLog('success', `GET /api/artigos - ${result.count} artigos encontrados`);
    
    // INBOUND: Resposta para o frontend
    global.emitJsonInput(result);
    res.json(result);
  } catch (error) {
    global.emitTraffic('Artigos', 'error', 'Erro ao listar artigos');
    global.emitLog('error', `GET /api/artigos - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// GET /api/artigos/:id - Obter artigo por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    global.emitTraffic('Artigos', 'received', `Entrada recebida - GET /api/artigos/${id}`);
    global.emitLog('info', `GET /api/artigos/${id} - Obtendo artigo por ID`);
    
    global.emitTraffic('Artigos', 'processing', 'Consultando DB');
    const result = await Artigos.getById(id);
    
    if (result.success) {
      global.emitTraffic('Artigos', 'completed', 'Concluído - Artigo obtido com sucesso');
      global.emitLog('success', `GET /api/artigos/${id} - Artigo obtido com sucesso`);
      
      // INBOUND: Resposta para o frontend
      global.emitJsonInput(result);
      res.json(result);
    } else {
      global.emitTraffic('Artigos', 'error', result.error);
      global.emitLog('error', `GET /api/artigos/${id} - ${result.error}`);
      res.status(result.error === 'Artigo não encontrado' ? 404 : 500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Artigos', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/artigos/:id - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// POST /api/artigos - Criar novo artigo
router.post('/', async (req, res) => {
  try {
    global.emitTraffic('Artigos', 'received', 'Entrada recebida - POST /api/artigos');
    global.emitLog('info', 'POST /api/artigos - Criando novo artigo');
    
    const { tag, artigo_titulo, artigo_conteudo, categoria_id, categoria_titulo, media } = req.body;
    
    if (!artigo_titulo || !artigo_conteudo || !categoria_titulo) {
      global.emitTraffic('Artigos', 'error', 'Dados obrigatórios ausentes');
      global.emitLog('error', 'POST /api/artigos - artigo_titulo, artigo_conteudo e categoria_titulo são obrigatórios');
      return res.status(400).json({ 
        success: false, 
        error: 'artigo_titulo, artigo_conteudo e categoria_titulo são obrigatórios' 
      });
    }

    // Processar conteúdo: substituir URLs blob temporárias por URLs do GCS
    const imagePaths = media?.images || [];
    let processedConteudo = artigo_conteudo;
    
    if (imagePaths.length > 0) {
      console.log(`🔍 [POST /api/artigos] Processando ${imagePaths.length} imagem(ns) no conteúdo`);
      console.log(`🔍 [POST /api/artigos] Conteúdo antes: ${artigo_conteudo.substring(0, 200)}`);
      
      processedConteudo = processContentImages(artigo_conteudo, imagePaths);
      
      console.log(`🔍 [POST /api/artigos] Conteúdo depois: ${processedConteudo.substring(0, 200)}`);
    }

    const artigoData = {
      tag: tag || '',
      artigo_titulo,
      artigo_conteudo: processedConteudo, // Usar conteúdo processado com URLs do GCS
      categoria_id: categoria_id || '',
      categoria_titulo,
      media: media || { images: [], videos: [] } // Campo media com arrays vazios por padrão
    };

    // OUTBOUND: Schema sendo enviado para MongoDB
    global.emitJson(artigoData);

    global.emitTraffic('Artigos', 'processing', 'Transmitindo para DB');
    const result = await Artigos.create(artigoData);
    
    if (result.success) {
      global.emitTraffic('Artigos', 'completed', 'Concluído - Artigo criado com sucesso');
      global.emitLog('success', `POST /api/artigos - Artigo "${artigo_titulo}" criado com sucesso`);
      
      // INBOUND: Resposta para o frontend
      global.emitJsonInput(result);
      res.status(201).json(result);
    } else {
      global.emitTraffic('Artigos', 'error', 'Erro ao criar artigo');
      global.emitLog('error', 'POST /api/artigos - Erro ao criar artigo');
      res.status(500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Artigos', 'error', 'Erro interno do servidor');
    global.emitLog('error', `POST /api/artigos - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// PUT /api/artigos/:id - Atualizar artigo
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { tag, artigo_titulo, artigo_conteudo, categoria_id, categoria_titulo, media } = req.body;
    
    global.emitTraffic('Artigos', 'received', `Entrada recebida - PUT /api/artigos/${id}`);
    global.emitLog('info', `PUT /api/artigos/${id} - Atualizando artigo`);
    global.emitJson({ id, ...req.body });
    
    const updateData = {};
    if (tag !== undefined) updateData.tag = tag;
    if (artigo_titulo) updateData.artigo_titulo = artigo_titulo;
    if (artigo_conteudo) {
      // Processar conteúdo se houver imagens
      const imagePaths = media?.images || [];
      if (imagePaths.length > 0) {
        console.log(`🔍 [PUT /api/artigos/${id}] Processando ${imagePaths.length} imagem(ns) no conteúdo`);
        updateData.artigo_conteudo = processContentImages(artigo_conteudo, imagePaths);
      } else {
        updateData.artigo_conteudo = artigo_conteudo;
      }
    }
    if (categoria_id !== undefined) updateData.categoria_id = categoria_id;
    if (categoria_titulo) updateData.categoria_titulo = categoria_titulo;
    if (media !== undefined) updateData.media = media;

    global.emitTraffic('Artigos', 'processing', 'Transmitindo para DB');
    const result = await Artigos.update(id, updateData);
    
    if (result.success) {
      global.emitTraffic('Artigos', 'completed', 'Concluído - Artigo atualizado com sucesso');
      global.emitLog('success', `PUT /api/artigos/${id} - Artigo atualizado com sucesso`);
      global.emitJson(result);
      res.json(result);
    } else {
      global.emitTraffic('Artigos', 'error', result.error);
      global.emitLog('error', `PUT /api/artigos/${id} - ${result.error}`);
      res.status(result.error === 'Artigo não encontrado' ? 404 : 500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Artigos', 'error', 'Erro interno do servidor');
    global.emitLog('error', `PUT /api/artigos/:id - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// DELETE /api/artigos/:id - Deletar artigo
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    global.emitTraffic('Artigos', 'received', `Entrada recebida - DELETE /api/artigos/${id}`);
    global.emitLog('info', `DELETE /api/artigos/${id} - Deletando artigo`);
       // OUTBOUND: ID sendo deletado
    global.emitJson({ id });

 global.emitTraffic('Artigos', 'processing', 'Transmitindo para DB');
    const result = await Artigos.delete(id);
    
    if (result.success) {
      global.emitTraffic('Artigos', 'completed', 'Concluído - Artigo deletado com sucesso');
      global.emitLog('success', `DELETE /api/artigos/${id} - Artigo deletado com sucesso`);
      global.emitJson(result);
      // INBOUND: Confirmação para o frontend
      global.emitJsonInput(result);
      res.json(result);
    } else {
      global.emitTraffic('Artigos', 'error', result.error);
      global.emitLog('error', `DELETE /api/artigos/${id} - ${result.error}`);
      res.status(result.error === 'Artigo não encontrado' ? 404 : 500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Artigos', 'error', 'Erro interno do servidor');
    global.emitLog('error', `DELETE /api/artigos/:id - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

module.exports = router;
