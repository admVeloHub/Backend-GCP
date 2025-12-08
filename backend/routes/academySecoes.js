// VERSION: v1.0.0 | DATE: 2025-02-02 | AUTHOR: VeloHub Development Team
const express = require('express');
const router = express.Router();
const Secoes = require('../models/Secoes');

// GET /api/academy/secoes/modulo/:moduloId - Buscar seções por módulo
router.get('/modulo/:moduloId', async (req, res) => {
  try {
    const { moduloId } = req.params;
    
    global.emitTraffic('Secoes', 'received', `Entrada recebida - GET /api/academy/secoes/modulo/${moduloId}`);
    global.emitLog('info', `GET /api/academy/secoes/modulo/${moduloId} - Buscando seções por módulo`);
    
    global.emitTraffic('Secoes', 'processing', 'Consultando DB');
    const result = await Secoes.getByModuloId(moduloId);
    
    if (result.success) {
      global.emitTraffic('Secoes', 'completed', 'Concluído - Seções obtidas com sucesso');
      global.emitLog('success', `GET /api/academy/secoes/modulo/${moduloId} - ${result.count} seções encontradas`);
      
      global.emitJsonInput(result);
      res.json(result);
    } else {
      global.emitTraffic('Secoes', 'error', result.error);
      global.emitLog('error', `GET /api/academy/secoes/modulo/${moduloId} - ${result.error}`);
      res.status(500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Secoes', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/academy/secoes/modulo/:moduloId - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// GET /api/academy/secoes/:id - Obter seção por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    global.emitTraffic('Secoes', 'received', `Entrada recebida - GET /api/academy/secoes/${id}`);
    global.emitLog('info', `GET /api/academy/secoes/${id} - Obtendo seção por ID`);
    
    global.emitTraffic('Secoes', 'processing', 'Consultando DB');
    const result = await Secoes.getById(id);
    
    if (result.success) {
      global.emitTraffic('Secoes', 'completed', 'Concluído - Seção obtida com sucesso');
      global.emitLog('success', `GET /api/academy/secoes/${id} - Seção obtida com sucesso`);
      
      global.emitJsonInput(result);
      res.json(result);
    } else {
      global.emitTraffic('Secoes', 'error', result.error);
      global.emitLog('error', `GET /api/academy/secoes/${id} - ${result.error}`);
      res.status(result.error === 'Seção não encontrada' ? 404 : 500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Secoes', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/academy/secoes/:id - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// POST /api/academy/secoes - Criar nova seção
router.post('/', async (req, res) => {
  try {
    global.emitTraffic('Secoes', 'received', 'Entrada recebida - POST /api/academy/secoes');
    global.emitLog('info', 'POST /api/academy/secoes - Criando nova seção');
    
    const { moduloId, temaNome, temaOrder, isActive, hasQuiz, quizId } = req.body;
    
    if (!moduloId || !temaNome || !temaOrder) {
      global.emitTraffic('Secoes', 'error', 'Dados obrigatórios ausentes');
      global.emitLog('error', 'POST /api/academy/secoes - moduloId, temaNome e temaOrder são obrigatórios');
      return res.status(400).json({ 
        success: false, 
        error: 'moduloId, temaNome e temaOrder são obrigatórios' 
      });
    }

    const secaoData = {
      moduloId,
      temaNome,
      temaOrder,
      isActive: isActive !== undefined ? isActive : true,
      hasQuiz: hasQuiz !== undefined ? hasQuiz : false,
      quizId: quizId || null
    };

    global.emitJson(secaoData);

    global.emitTraffic('Secoes', 'processing', 'Transmitindo para DB');
    const result = await Secoes.createSecao(secaoData);
    
    if (result.success) {
      global.emitTraffic('Secoes', 'completed', 'Concluído - Seção criada com sucesso');
      global.emitLog('success', `POST /api/academy/secoes - Seção "${temaNome}" criada com sucesso`);
      
      global.emitJsonInput(result);
      res.status(201).json(result);
    } else {
      global.emitTraffic('Secoes', 'error', result.error);
      global.emitLog('error', `POST /api/academy/secoes - ${result.error}`);
      res.status(500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Secoes', 'error', 'Erro interno do servidor');
    global.emitLog('error', `POST /api/academy/secoes - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// PUT /api/academy/secoes/:id - Atualizar seção
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { moduloId, temaNome, temaOrder, isActive, hasQuiz, quizId } = req.body;
    
    global.emitTraffic('Secoes', 'received', `Entrada recebida - PUT /api/academy/secoes/${id}`);
    global.emitLog('info', `PUT /api/academy/secoes/${id} - Atualizando seção`);
    global.emitJson({ id, ...req.body });
    
    const updateData = {};
    if (moduloId !== undefined) updateData.moduloId = moduloId;
    if (temaNome !== undefined) updateData.temaNome = temaNome;
    if (temaOrder !== undefined) updateData.temaOrder = temaOrder;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (hasQuiz !== undefined) updateData.hasQuiz = hasQuiz;
    if (quizId !== undefined) updateData.quizId = quizId;

    global.emitTraffic('Secoes', 'processing', 'Transmitindo para DB');
    const result = await Secoes.updateSecao(id, updateData);
    
    if (result.success) {
      global.emitTraffic('Secoes', 'completed', 'Concluído - Seção atualizada com sucesso');
      global.emitLog('success', `PUT /api/academy/secoes/${id} - Seção atualizada com sucesso`);
      global.emitJson(result);
      res.json(result);
    } else {
      global.emitTraffic('Secoes', 'error', result.error);
      global.emitLog('error', `PUT /api/academy/secoes/${id} - ${result.error}`);
      res.status(result.error === 'Seção não encontrada' ? 404 : 500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Secoes', 'error', 'Erro interno do servidor');
    global.emitLog('error', `PUT /api/academy/secoes/:id - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// DELETE /api/academy/secoes/:id - Deletar seção (com cascade delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    global.emitTraffic('Secoes', 'received', `Entrada recebida - DELETE /api/academy/secoes/${id}`);
    global.emitLog('info', `DELETE /api/academy/secoes/${id} - Deletando seção com cascade delete`);
    global.emitJson({ id });

    // Deletar aulas da seção em cascata
    const Aulas = require('../models/Aulas');
    await Aulas.deleteBySecaoId(id);

    global.emitTraffic('Secoes', 'processing', 'Transmitindo para DB');
    const result = await Secoes.deleteSecao(id);
    
    if (result.success) {
      global.emitTraffic('Secoes', 'completed', 'Concluído - Seção e aulas deletadas com sucesso');
      global.emitLog('success', `DELETE /api/academy/secoes/${id} - Seção deletada com sucesso`);
      global.emitJson(result);
      global.emitJsonInput(result);
      res.json(result);
    } else {
      global.emitTraffic('Secoes', 'error', result.error);
      global.emitLog('error', `DELETE /api/academy/secoes/${id} - ${result.error}`);
      res.status(result.error === 'Seção não encontrada' ? 404 : 500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Secoes', 'error', 'Erro interno do servidor');
    global.emitLog('error', `DELETE /api/academy/secoes/:id - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

module.exports = router;

