// VERSION: v1.0.0 | DATE: 2025-02-02 | AUTHOR: VeloHub Development Team
const express = require('express');
const router = express.Router();
const Aulas = require('../models/Aulas');

// GET /api/academy/aulas/secao/:secaoId - Buscar aulas por seção
router.get('/secao/:secaoId', async (req, res) => {
  try {
    const { secaoId } = req.params;
    
    global.emitTraffic('Aulas', 'received', `Entrada recebida - GET /api/academy/aulas/secao/${secaoId}`);
    global.emitLog('info', `GET /api/academy/aulas/secao/${secaoId} - Buscando aulas por seção`);
    
    global.emitTraffic('Aulas', 'processing', 'Consultando DB');
    const result = await Aulas.getBySecaoId(secaoId);
    
    if (result.success) {
      global.emitTraffic('Aulas', 'completed', 'Concluído - Aulas obtidas com sucesso');
      global.emitLog('success', `GET /api/academy/aulas/secao/${secaoId} - ${result.count} aulas encontradas`);
      
      global.emitJsonInput(result);
      res.json(result);
    } else {
      global.emitTraffic('Aulas', 'error', result.error);
      global.emitLog('error', `GET /api/academy/aulas/secao/${secaoId} - ${result.error}`);
      res.status(500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Aulas', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/academy/aulas/secao/:secaoId - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// GET /api/academy/aulas/:id - Obter aula por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    global.emitTraffic('Aulas', 'received', `Entrada recebida - GET /api/academy/aulas/${id}`);
    global.emitLog('info', `GET /api/academy/aulas/${id} - Obtendo aula por ID`);
    
    global.emitTraffic('Aulas', 'processing', 'Consultando DB');
    const result = await Aulas.getById(id);
    
    if (result.success) {
      global.emitTraffic('Aulas', 'completed', 'Concluído - Aula obtida com sucesso');
      global.emitLog('success', `GET /api/academy/aulas/${id} - Aula obtida com sucesso`);
      
      global.emitJsonInput(result);
      res.json(result);
    } else {
      global.emitTraffic('Aulas', 'error', result.error);
      global.emitLog('error', `GET /api/academy/aulas/${id} - ${result.error}`);
      res.status(result.error === 'Aula não encontrada' ? 404 : 500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Aulas', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/academy/aulas/:id - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// POST /api/academy/aulas - Criar nova aula
router.post('/', async (req, res) => {
  try {
    global.emitTraffic('Aulas', 'received', 'Entrada recebida - POST /api/academy/aulas');
    global.emitLog('info', 'POST /api/academy/aulas - Criando nova aula');
    
    const { secaoId, lessonId, lessonTipo, lessonTitulo, lessonOrdem, isActive, lessonContent, driveId, youtubeId, duration } = req.body;
    
    if (!secaoId || !lessonId || !lessonTipo || !lessonTitulo || !lessonOrdem || !lessonContent) {
      global.emitTraffic('Aulas', 'error', 'Dados obrigatórios ausentes');
      global.emitLog('error', 'POST /api/academy/aulas - secaoId, lessonId, lessonTipo, lessonTitulo, lessonOrdem e lessonContent são obrigatórios');
      return res.status(400).json({ 
        success: false, 
        error: 'secaoId, lessonId, lessonTipo, lessonTitulo, lessonOrdem e lessonContent são obrigatórios' 
      });
    }

    const aulaData = {
      secaoId,
      lessonId,
      lessonTipo,
      lessonTitulo,
      lessonOrdem,
      isActive: isActive !== undefined ? isActive : true,
      lessonContent,
      driveId: driveId || null,
      youtubeId: youtubeId || null,
      duration: duration || null
    };

    global.emitJson(aulaData);

    global.emitTraffic('Aulas', 'processing', 'Transmitindo para DB');
    const result = await Aulas.createAula(aulaData);
    
    if (result.success) {
      global.emitTraffic('Aulas', 'completed', 'Concluído - Aula criada com sucesso');
      global.emitLog('success', `POST /api/academy/aulas - Aula "${lessonTitulo}" criada com sucesso`);
      
      global.emitJsonInput(result);
      res.status(201).json(result);
    } else {
      global.emitTraffic('Aulas', 'error', result.error);
      global.emitLog('error', `POST /api/academy/aulas - ${result.error}`);
      res.status(500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Aulas', 'error', 'Erro interno do servidor');
    global.emitLog('error', `POST /api/academy/aulas - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// PUT /api/academy/aulas/:id - Atualizar aula
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { secaoId, lessonId, lessonTipo, lessonTitulo, lessonOrdem, isActive, lessonContent, driveId, youtubeId, duration } = req.body;
    
    global.emitTraffic('Aulas', 'received', `Entrada recebida - PUT /api/academy/aulas/${id}`);
    global.emitLog('info', `PUT /api/academy/aulas/${id} - Atualizando aula`);
    global.emitJson({ id, ...req.body });
    
    const updateData = {};
    if (secaoId !== undefined) updateData.secaoId = secaoId;
    if (lessonId !== undefined) updateData.lessonId = lessonId;
    if (lessonTipo !== undefined) updateData.lessonTipo = lessonTipo;
    if (lessonTitulo !== undefined) updateData.lessonTitulo = lessonTitulo;
    if (lessonOrdem !== undefined) updateData.lessonOrdem = lessonOrdem;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (lessonContent !== undefined) updateData.lessonContent = lessonContent;
    if (driveId !== undefined) updateData.driveId = driveId;
    if (youtubeId !== undefined) updateData.youtubeId = youtubeId;
    if (duration !== undefined) updateData.duration = duration;

    global.emitTraffic('Aulas', 'processing', 'Transmitindo para DB');
    const result = await Aulas.updateAula(id, updateData);
    
    if (result.success) {
      global.emitTraffic('Aulas', 'completed', 'Concluído - Aula atualizada com sucesso');
      global.emitLog('success', `PUT /api/academy/aulas/${id} - Aula atualizada com sucesso`);
      global.emitJson(result);
      res.json(result);
    } else {
      global.emitTraffic('Aulas', 'error', result.error);
      global.emitLog('error', `PUT /api/academy/aulas/${id} - ${result.error}`);
      res.status(result.error === 'Aula não encontrada' ? 404 : 500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Aulas', 'error', 'Erro interno do servidor');
    global.emitLog('error', `PUT /api/academy/aulas/:id - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// DELETE /api/academy/aulas/:id - Deletar aula
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    global.emitTraffic('Aulas', 'received', `Entrada recebida - DELETE /api/academy/aulas/${id}`);
    global.emitLog('info', `DELETE /api/academy/aulas/${id} - Deletando aula`);
    global.emitJson({ id });

    global.emitTraffic('Aulas', 'processing', 'Transmitindo para DB');
    const result = await Aulas.deleteAula(id);
    
    if (result.success) {
      global.emitTraffic('Aulas', 'completed', 'Concluído - Aula deletada com sucesso');
      global.emitLog('success', `DELETE /api/academy/aulas/${id} - Aula deletada com sucesso`);
      global.emitJson(result);
      global.emitJsonInput(result);
      res.json(result);
    } else {
      global.emitTraffic('Aulas', 'error', result.error);
      global.emitLog('error', `DELETE /api/academy/aulas/${id} - ${result.error}`);
      res.status(result.error === 'Aula não encontrada' ? 404 : 500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Aulas', 'error', 'Erro interno do servidor');
    global.emitLog('error', `DELETE /api/academy/aulas/:id - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

module.exports = router;

