// VERSION: v1.0.0 | DATE: 2025-02-02 | AUTHOR: VeloHub Development Team
const express = require('express');
const router = express.Router();
const Modulos = require('../models/Modulos');

// GET /api/academy/modulos/curso/:cursoId - Buscar módulos por curso
router.get('/curso/:cursoId', async (req, res) => {
  try {
    const { cursoId } = req.params;
    
    global.emitTraffic('Modulos', 'received', `Entrada recebida - GET /api/academy/modulos/curso/${cursoId}`);
    global.emitLog('info', `GET /api/academy/modulos/curso/${cursoId} - Buscando módulos por curso`);
    
    global.emitTraffic('Modulos', 'processing', 'Consultando DB');
    const result = await Modulos.getByCursoId(cursoId);
    
    if (result.success) {
      global.emitTraffic('Modulos', 'completed', 'Concluído - Módulos obtidos com sucesso');
      global.emitLog('success', `GET /api/academy/modulos/curso/${cursoId} - ${result.count} módulos encontrados`);
      
      global.emitJsonInput(result);
      res.json(result);
    } else {
      global.emitTraffic('Modulos', 'error', result.error);
      global.emitLog('error', `GET /api/academy/modulos/curso/${cursoId} - ${result.error}`);
      res.status(500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Modulos', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/academy/modulos/curso/:cursoId - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// GET /api/academy/modulos/:id - Obter módulo por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    global.emitTraffic('Modulos', 'received', `Entrada recebida - GET /api/academy/modulos/${id}`);
    global.emitLog('info', `GET /api/academy/modulos/${id} - Obtendo módulo por ID`);
    
    global.emitTraffic('Modulos', 'processing', 'Consultando DB');
    const result = await Modulos.getById(id);
    
    if (result.success) {
      global.emitTraffic('Modulos', 'completed', 'Concluído - Módulo obtido com sucesso');
      global.emitLog('success', `GET /api/academy/modulos/${id} - Módulo obtido com sucesso`);
      
      global.emitJsonInput(result);
      res.json(result);
    } else {
      global.emitTraffic('Modulos', 'error', result.error);
      global.emitLog('error', `GET /api/academy/modulos/${id} - ${result.error}`);
      res.status(result.error === 'Módulo não encontrado' ? 404 : 500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Modulos', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/academy/modulos/:id - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// POST /api/academy/modulos - Criar novo módulo
router.post('/', async (req, res) => {
  try {
    global.emitTraffic('Modulos', 'received', 'Entrada recebida - POST /api/academy/modulos');
    global.emitLog('info', 'POST /api/academy/modulos - Criando novo módulo');
    
    const { cursoId, moduleId, moduleNome, moduleOrder, isActive } = req.body;
    
    if (!cursoId || !moduleId || !moduleNome || !moduleOrder) {
      global.emitTraffic('Modulos', 'error', 'Dados obrigatórios ausentes');
      global.emitLog('error', 'POST /api/academy/modulos - cursoId, moduleId, moduleNome e moduleOrder são obrigatórios');
      return res.status(400).json({ 
        success: false, 
        error: 'cursoId, moduleId, moduleNome e moduleOrder são obrigatórios' 
      });
    }

    const moduloData = {
      cursoId,
      moduleId,
      moduleNome,
      moduleOrder,
      isActive: isActive !== undefined ? isActive : true
    };

    global.emitJson(moduloData);

    global.emitTraffic('Modulos', 'processing', 'Transmitindo para DB');
    const result = await Modulos.createModulo(moduloData);
    
    if (result.success) {
      global.emitTraffic('Modulos', 'completed', 'Concluído - Módulo criado com sucesso');
      global.emitLog('success', `POST /api/academy/modulos - Módulo "${moduleNome}" criado com sucesso`);
      
      global.emitJsonInput(result);
      res.status(201).json(result);
    } else {
      global.emitTraffic('Modulos', 'error', result.error);
      global.emitLog('error', `POST /api/academy/modulos - ${result.error}`);
      res.status(500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Modulos', 'error', 'Erro interno do servidor');
    global.emitLog('error', `POST /api/academy/modulos - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// PUT /api/academy/modulos/:id - Atualizar módulo
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { cursoId, moduleId, moduleNome, moduleOrder, isActive } = req.body;
    
    global.emitTraffic('Modulos', 'received', `Entrada recebida - PUT /api/academy/modulos/${id}`);
    global.emitLog('info', `PUT /api/academy/modulos/${id} - Atualizando módulo`);
    global.emitJson({ id, ...req.body });
    
    const updateData = {};
    if (cursoId !== undefined) updateData.cursoId = cursoId;
    if (moduleId !== undefined) updateData.moduleId = moduleId;
    if (moduleNome !== undefined) updateData.moduleNome = moduleNome;
    if (moduleOrder !== undefined) updateData.moduleOrder = moduleOrder;
    if (isActive !== undefined) updateData.isActive = isActive;

    global.emitTraffic('Modulos', 'processing', 'Transmitindo para DB');
    const result = await Modulos.updateModulo(id, updateData);
    
    if (result.success) {
      global.emitTraffic('Modulos', 'completed', 'Concluído - Módulo atualizado com sucesso');
      global.emitLog('success', `PUT /api/academy/modulos/${id} - Módulo atualizado com sucesso`);
      global.emitJson(result);
      res.json(result);
    } else {
      global.emitTraffic('Modulos', 'error', result.error);
      global.emitLog('error', `PUT /api/academy/modulos/${id} - ${result.error}`);
      res.status(result.error === 'Módulo não encontrado' ? 404 : 500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Modulos', 'error', 'Erro interno do servidor');
    global.emitLog('error', `PUT /api/academy/modulos/:id - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// DELETE /api/academy/modulos/:id - Deletar módulo (com cascade delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    global.emitTraffic('Modulos', 'received', `Entrada recebida - DELETE /api/academy/modulos/${id}`);
    global.emitLog('info', `DELETE /api/academy/modulos/${id} - Deletando módulo com cascade delete`);
    global.emitJson({ id });

    // Buscar seções do módulo para deletar em cascata
    const Secoes = require('../models/Secoes');
    const Aulas = require('../models/Aulas');
    
    const secoesResult = await Secoes.getByModuloId(id);
    if (secoesResult.success && secoesResult.data.length > 0) {
      // Para cada seção, deletar aulas
      for (const secao of secoesResult.data) {
        await Aulas.deleteBySecaoId(secao._id);
      }
      // Deletar seções do módulo
      await Secoes.deleteByModuloId(id);
    }

    global.emitTraffic('Modulos', 'processing', 'Transmitindo para DB');
    const result = await Modulos.deleteModulo(id);
    
    if (result.success) {
      global.emitTraffic('Modulos', 'completed', 'Concluído - Módulo e dados relacionados deletados com sucesso');
      global.emitLog('success', `DELETE /api/academy/modulos/${id} - Módulo deletado com sucesso`);
      global.emitJson(result);
      global.emitJsonInput(result);
      res.json(result);
    } else {
      global.emitTraffic('Modulos', 'error', result.error);
      global.emitLog('error', `DELETE /api/academy/modulos/${id} - ${result.error}`);
      res.status(result.error === 'Módulo não encontrado' ? 404 : 500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Modulos', 'error', 'Erro interno do servidor');
    global.emitLog('error', `DELETE /api/academy/modulos/:id - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

module.exports = router;

