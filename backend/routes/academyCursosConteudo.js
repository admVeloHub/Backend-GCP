// VERSION: v1.1.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
const express = require('express');
const router = express.Router();
const CursosConteudo = require('../models/CursosConteudo');

// GET /api/academy/cursos-conteudo/active - Buscar apenas cursos ativos (deve vir antes de /:id)
router.get('/active', async (req, res) => {
  try {
    global.emitTraffic('CursosConteudo', 'received', 'Entrada recebida - GET /api/academy/cursos-conteudo/active');
    global.emitLog('info', 'GET /api/academy/cursos-conteudo/active - Buscando cursos ativos');
    
    global.emitTraffic('CursosConteudo', 'processing', 'Consultando DB');
    const result = await CursosConteudo.getActiveCourses();
    
    global.emitTraffic('CursosConteudo', 'completed', 'Concluído - Cursos ativos listados com sucesso');
    global.emitLog('success', `GET /api/academy/cursos-conteudo/active - ${result.count} cursos ativos encontrados`);
    
    // INBOUND: Resposta para o frontend
    global.emitJsonInput(result);
    res.json(result);
  } catch (error) {
    global.emitTraffic('CursosConteudo', 'error', 'Erro ao listar cursos ativos');
    global.emitLog('error', `GET /api/academy/cursos-conteudo/active - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// GET /api/academy/cursos-conteudo/curso/:cursoNome - Buscar por nome do curso
router.get('/curso/:cursoNome', async (req, res) => {
  try {
    const { cursoNome } = req.params;
    
    global.emitTraffic('CursosConteudo', 'received', `Entrada recebida - GET /api/academy/cursos-conteudo/curso/${cursoNome}`);
    global.emitLog('info', `GET /api/academy/cursos-conteudo/curso/${cursoNome} - Buscando curso por nome`);
    
    global.emitTraffic('CursosConteudo', 'processing', 'Consultando DB');
    const result = await CursosConteudo.getByCursoNome(cursoNome);
    
    if (result.success) {
      global.emitTraffic('CursosConteudo', 'completed', 'Concluído - Cursos obtidos com sucesso');
      global.emitLog('success', `GET /api/academy/cursos-conteudo/curso/${cursoNome} - ${result.count} cursos encontrados`);
      
      // INBOUND: Resposta para o frontend
      global.emitJsonInput(result);
      res.json(result);
    } else {
      global.emitTraffic('CursosConteudo', 'error', result.error);
      global.emitLog('error', `GET /api/academy/cursos-conteudo/curso/${cursoNome} - ${result.error}`);
      res.status(500).json(result);
    }
  } catch (error) {
    global.emitTraffic('CursosConteudo', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/academy/cursos-conteudo/curso/:cursoNome - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// GET /api/academy/cursos-conteudo/classe/:cursoClasse - Buscar por classe do curso
router.get('/classe/:cursoClasse', async (req, res) => {
  try {
    const { cursoClasse } = req.params;
    
    global.emitTraffic('CursosConteudo', 'received', `Entrada recebida - GET /api/academy/cursos-conteudo/classe/${cursoClasse}`);
    global.emitLog('info', `GET /api/academy/cursos-conteudo/classe/${cursoClasse} - Buscando cursos por classe`);
    
    global.emitTraffic('CursosConteudo', 'processing', 'Consultando DB');
    const result = await CursosConteudo.getByCursoClasse(cursoClasse);
    
    if (result.success) {
      global.emitTraffic('CursosConteudo', 'completed', 'Concluído - Cursos obtidos com sucesso');
      global.emitLog('success', `GET /api/academy/cursos-conteudo/classe/${cursoClasse} - ${result.count} cursos encontrados`);
      
      // INBOUND: Resposta para o frontend
      global.emitJsonInput(result);
      res.json(result);
    } else {
      global.emitTraffic('CursosConteudo', 'error', result.error);
      global.emitLog('error', `GET /api/academy/cursos-conteudo/classe/${cursoClasse} - ${result.error}`);
      res.status(500).json(result);
    }
  } catch (error) {
    global.emitTraffic('CursosConteudo', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/academy/cursos-conteudo/classe/:cursoClasse - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// GET /api/academy/cursos-conteudo - Listar todos os cursos
router.get('/', async (req, res) => {
  try {
    global.emitTraffic('CursosConteudo', 'received', 'Entrada recebida - GET /api/academy/cursos-conteudo');
    global.emitLog('info', 'GET /api/academy/cursos-conteudo - Listando todos os cursos');
    
    global.emitTraffic('CursosConteudo', 'processing', 'Consultando DB');
    const result = await CursosConteudo.getAll();
    
    global.emitTraffic('CursosConteudo', 'completed', 'Concluído - Cursos listados com sucesso');
    global.emitLog('success', `GET /api/academy/cursos-conteudo - ${result.count} cursos encontrados`);
    
    // INBOUND: Resposta para o frontend
    global.emitJsonInput(result);
    res.json(result);
  } catch (error) {
    global.emitTraffic('CursosConteudo', 'error', 'Erro ao listar cursos');
    global.emitLog('error', `GET /api/academy/cursos-conteudo - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// GET /api/academy/cursos-conteudo/:id - Obter curso por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    global.emitTraffic('CursosConteudo', 'received', `Entrada recebida - GET /api/academy/cursos-conteudo/${id}`);
    global.emitLog('info', `GET /api/academy/cursos-conteudo/${id} - Obtendo curso por ID`);
    
    global.emitTraffic('CursosConteudo', 'processing', 'Consultando DB');
    const result = await CursosConteudo.getById(id);
    
    if (result.success) {
      global.emitTraffic('CursosConteudo', 'completed', 'Concluído - Curso obtido com sucesso');
      global.emitLog('success', `GET /api/academy/cursos-conteudo/${id} - Curso obtido com sucesso`);
      
      // INBOUND: Resposta para o frontend
      global.emitJsonInput(result);
      res.json(result);
    } else {
      global.emitTraffic('CursosConteudo', 'error', result.error);
      global.emitLog('error', `GET /api/academy/cursos-conteudo/${id} - ${result.error}`);
      res.status(result.error === 'Curso não encontrado' ? 404 : 500).json(result);
    }
  } catch (error) {
    global.emitTraffic('CursosConteudo', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/academy/cursos-conteudo/:id - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// POST /api/academy/cursos-conteudo - Criar novo curso
router.post('/', async (req, res) => {
  try {
    global.emitTraffic('CursosConteudo', 'received', 'Entrada recebida - POST /api/academy/cursos-conteudo');
    global.emitLog('info', 'POST /api/academy/cursos-conteudo - Criando novo curso');
    
    const { cursoClasse, cursoNome, cursoDescription, courseOrder, isActive, modules, createdBy, version } = req.body;
    
    if (!cursoClasse || !cursoNome || !courseOrder || !createdBy) {
      global.emitTraffic('CursosConteudo', 'error', 'Dados obrigatórios ausentes');
      global.emitLog('error', 'POST /api/academy/cursos-conteudo - cursoClasse, cursoNome, courseOrder e createdBy são obrigatórios');
      return res.status(400).json({ 
        success: false, 
        error: 'cursoClasse, cursoNome, courseOrder e createdBy são obrigatórios' 
      });
    }

    const cursoData = {
      cursoClasse,
      cursoNome,
      courseOrder,
      isActive: isActive !== undefined ? isActive : true,
      modules: modules || [], // Permitir array vazio para cursos sem módulos
      createdBy,
      version: version || 1
    };
    
    // Adicionar cursoDescription se fornecido (sempre salva quando há valor)
    if (cursoDescription !== undefined) {
      if (cursoDescription !== null && cursoDescription !== '') {
        cursoData.cursoDescription = String(cursoDescription).trim();
      } else {
        cursoData.cursoDescription = null;
      }
    }

    // OUTBOUND: Schema sendo enviado para MongoDB
    global.emitJson(cursoData);

    global.emitTraffic('CursosConteudo', 'processing', 'Transmitindo para DB');
    const result = await CursosConteudo.createCurso(cursoData);
    
    if (result.success) {
      global.emitTraffic('CursosConteudo', 'completed', 'Concluído - Curso criado com sucesso');
      global.emitLog('success', `POST /api/academy/cursos-conteudo - Curso "${cursoNome}" criado com sucesso`);
      
      // INBOUND: Resposta para o frontend
      global.emitJsonInput(result);
      res.status(201).json(result);
    } else {
      global.emitTraffic('CursosConteudo', 'error', result.error);
      global.emitLog('error', `POST /api/academy/cursos-conteudo - ${result.error}`);
      res.status(500).json(result);
    }
  } catch (error) {
    global.emitTraffic('CursosConteudo', 'error', 'Erro interno do servidor');
    global.emitLog('error', `POST /api/academy/cursos-conteudo - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// PUT /api/academy/cursos-conteudo/:id - Atualizar curso
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { cursoClasse, cursoNome, cursoDescription, courseOrder, isActive, modules, createdBy, version } = req.body;
    
    global.emitTraffic('CursosConteudo', 'received', `Entrada recebida - PUT /api/academy/cursos-conteudo/${id}`);
    global.emitLog('info', `PUT /api/academy/cursos-conteudo/${id} - Atualizando curso`);
    global.emitJson({ id, ...req.body });
    
    const updateData = {};
    if (cursoClasse !== undefined) updateData.cursoClasse = cursoClasse;
    if (cursoNome !== undefined) updateData.cursoNome = cursoNome;
    // Adicionar cursoDescription se fornecido (sempre salva quando há valor)
    if (cursoDescription !== undefined) {
      if (cursoDescription !== null && cursoDescription !== '') {
        updateData.cursoDescription = String(cursoDescription).trim();
      } else {
        updateData.cursoDescription = null;
      }
    }
    if (courseOrder !== undefined) updateData.courseOrder = courseOrder;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (modules !== undefined) updateData.modules = modules;
    if (createdBy !== undefined) updateData.createdBy = createdBy;
    if (version !== undefined) updateData.version = version;

    global.emitTraffic('CursosConteudo', 'processing', 'Transmitindo para DB');
    const result = await CursosConteudo.updateCurso(id, updateData);
    
    if (result.success) {
      global.emitTraffic('CursosConteudo', 'completed', 'Concluído - Curso atualizado com sucesso');
      global.emitLog('success', `PUT /api/academy/cursos-conteudo/${id} - Curso atualizado com sucesso`);
      global.emitJson(result);
      res.json(result);
    } else {
      global.emitTraffic('CursosConteudo', 'error', result.error);
      global.emitLog('error', `PUT /api/academy/cursos-conteudo/${id} - ${result.error}`);
      res.status(result.error === 'Curso não encontrado' ? 404 : 500).json(result);
    }
  } catch (error) {
    global.emitTraffic('CursosConteudo', 'error', 'Erro interno do servidor');
    global.emitLog('error', `PUT /api/academy/cursos-conteudo/:id - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// DELETE /api/academy/cursos-conteudo/:id - Deletar curso
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    global.emitTraffic('CursosConteudo', 'received', `Entrada recebida - DELETE /api/academy/cursos-conteudo/${id}`);
    global.emitLog('info', `DELETE /api/academy/cursos-conteudo/${id} - Deletando curso`);
    // OUTBOUND: ID sendo deletado
    global.emitJson({ id });

    global.emitTraffic('CursosConteudo', 'processing', 'Transmitindo para DB');
    const result = await CursosConteudo.deleteCurso(id);
    
    if (result.success) {
      global.emitTraffic('CursosConteudo', 'completed', 'Concluído - Curso deletado com sucesso');
      global.emitLog('success', `DELETE /api/academy/cursos-conteudo/${id} - Curso deletado com sucesso`);
      global.emitJson(result);
      // INBOUND: Confirmação para o frontend
      global.emitJsonInput(result);
      res.json(result);
    } else {
      global.emitTraffic('CursosConteudo', 'error', result.error);
      global.emitLog('error', `DELETE /api/academy/cursos-conteudo/${id} - ${result.error}`);
      res.status(result.error === 'Curso não encontrado' ? 404 : 500).json(result);
    }
  } catch (error) {
    global.emitTraffic('CursosConteudo', 'error', 'Erro interno do servidor');
    global.emitLog('error', `DELETE /api/academy/cursos-conteudo/:id - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

module.exports = router;

