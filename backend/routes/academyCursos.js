// VERSION: v1.0.0 | DATE: 2025-02-02 | AUTHOR: VeloHub Development Team
const express = require('express');
const router = express.Router();
const Cursos = require('../models/Cursos');

// GET /api/academy/cursos/active - Buscar apenas cursos ativos (deve vir antes de /:id)
router.get('/active', async (req, res) => {
  try {
    global.emitTraffic('Cursos', 'received', 'Entrada recebida - GET /api/academy/cursos/active');
    global.emitLog('info', 'GET /api/academy/cursos/active - Buscando cursos ativos');
    
    global.emitTraffic('Cursos', 'processing', 'Consultando DB');
    const result = await Cursos.getActiveCourses();
    
    global.emitTraffic('Cursos', 'completed', 'Concluído - Cursos ativos listados com sucesso');
    global.emitLog('success', `GET /api/academy/cursos/active - ${result.count} cursos ativos encontrados`);
    
    global.emitJsonInput(result);
    res.json(result);
  } catch (error) {
    global.emitTraffic('Cursos', 'error', 'Erro ao listar cursos ativos');
    global.emitLog('error', `GET /api/academy/cursos/active - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// GET /api/academy/cursos/curso/:cursoNome - Buscar por nome do curso
router.get('/curso/:cursoNome', async (req, res) => {
  try {
    const { cursoNome } = req.params;
    
    global.emitTraffic('Cursos', 'received', `Entrada recebida - GET /api/academy/cursos/curso/${cursoNome}`);
    global.emitLog('info', `GET /api/academy/cursos/curso/${cursoNome} - Buscando curso por nome`);
    
    global.emitTraffic('Cursos', 'processing', 'Consultando DB');
    const result = await Cursos.getByCursoNome(cursoNome);
    
    if (result.success) {
      global.emitTraffic('Cursos', 'completed', 'Concluído - Cursos obtidos com sucesso');
      global.emitLog('success', `GET /api/academy/cursos/curso/${cursoNome} - ${result.count} cursos encontrados`);
      
      global.emitJsonInput(result);
      res.json(result);
    } else {
      global.emitTraffic('Cursos', 'error', result.error);
      global.emitLog('error', `GET /api/academy/cursos/curso/${cursoNome} - ${result.error}`);
      res.status(500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Cursos', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/academy/cursos/curso/:cursoNome - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// GET /api/academy/cursos/classe/:cursoClasse - Buscar por classe do curso
router.get('/classe/:cursoClasse', async (req, res) => {
  try {
    const { cursoClasse } = req.params;
    
    global.emitTraffic('Cursos', 'received', `Entrada recebida - GET /api/academy/cursos/classe/${cursoClasse}`);
    global.emitLog('info', `GET /api/academy/cursos/classe/${cursoClasse} - Buscando cursos por classe`);
    
    global.emitTraffic('Cursos', 'processing', 'Consultando DB');
    const result = await Cursos.getByCursoClasse(cursoClasse);
    
    if (result.success) {
      global.emitTraffic('Cursos', 'completed', 'Concluído - Cursos obtidos com sucesso');
      global.emitLog('success', `GET /api/academy/cursos/classe/${cursoClasse} - ${result.count} cursos encontrados`);
      
      global.emitJsonInput(result);
      res.json(result);
    } else {
      global.emitTraffic('Cursos', 'error', result.error);
      global.emitLog('error', `GET /api/academy/cursos/classe/${cursoClasse} - ${result.error}`);
      res.status(500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Cursos', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/academy/cursos/classe/:cursoClasse - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// GET /api/academy/cursos - Listar todos os cursos
router.get('/', async (req, res) => {
  try {
    global.emitTraffic('Cursos', 'received', 'Entrada recebida - GET /api/academy/cursos');
    global.emitLog('info', 'GET /api/academy/cursos - Listando todos os cursos');
    
    global.emitTraffic('Cursos', 'processing', 'Consultando DB');
    const result = await Cursos.getAll();
    
    global.emitTraffic('Cursos', 'completed', 'Concluído - Cursos listados com sucesso');
    global.emitLog('success', `GET /api/academy/cursos - ${result.count} cursos encontrados`);
    
    global.emitJsonInput(result);
    res.json(result);
  } catch (error) {
    global.emitTraffic('Cursos', 'error', 'Erro ao listar cursos');
    global.emitLog('error', `GET /api/academy/cursos - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// GET /api/academy/cursos/:id/complete - Obter curso completo com módulos, seções e aulas
router.get('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    
    global.emitTraffic('Cursos', 'received', `Entrada recebida - GET /api/academy/cursos/${id}/complete`);
    global.emitLog('info', `GET /api/academy/cursos/${id}/complete - Obtendo curso completo`);
    
    global.emitTraffic('Cursos', 'processing', 'Consultando DB');
    const cursoResult = await Cursos.getById(id);
    
    if (!cursoResult.success) {
      global.emitTraffic('Cursos', 'error', cursoResult.error);
      global.emitLog('error', `GET /api/academy/cursos/${id}/complete - ${cursoResult.error}`);
      return res.status(cursoResult.error === 'Curso não encontrado' ? 404 : 500).json(cursoResult);
    }
    
    const curso = cursoResult.data;
    
    // Buscar módulos do curso
    const modulosResult = await Modulos.getByCursoId(id);
    const modulos = modulosResult.success ? modulosResult.data : [];
    
    // Para cada módulo, buscar seções e aulas
    const modulosCompletos = await Promise.all(modulos.map(async (modulo) => {
      const secoesResult = await Secoes.getByModuloId(modulo._id);
      const secoes = secoesResult.success ? secoesResult.data : [];
      
      // Para cada seção, buscar aulas
      const secoesCompletas = await Promise.all(secoes.map(async (secao) => {
        const aulasResult = await Aulas.getBySecaoId(secao._id);
        const aulas = aulasResult.success ? aulasResult.data : [];
        
        return {
          ...secao.toObject(),
          lessons: aulas.map(aula => ({
            lessonId: aula.lessonId,
            lessonTipo: aula.lessonTipo,
            lessonTitulo: aula.lessonTitulo,
            lessonOrdem: aula.lessonOrdem,
            isActive: aula.isActive,
            lessonContent: aula.lessonContent,
            driveId: aula.driveId,
            youtubeId: aula.youtubeId,
            duration: aula.duration
          }))
        };
      }));
      
      // Converter módulo para formato compatível (manter moduleId e moduleNome)
      const moduloObj = modulo.toObject ? modulo.toObject() : modulo;
      return {
        moduleId: moduloObj.moduleId,
        moduleNome: moduloObj.moduleNome,
        isActive: moduloObj.isActive,
        sections: secoesCompletas
      };
    }));
    
    // Montar estrutura completa compatível com formato antigo
    const cursoObj = curso.toObject ? curso.toObject() : curso;
    const cursoCompleto = {
      ...cursoObj,
      modules: modulosCompletos
    };
    
    global.emitTraffic('Cursos', 'completed', 'Concluído - Curso completo obtido com sucesso');
    global.emitLog('success', `GET /api/academy/cursos/${id}/complete - Curso completo obtido com sucesso`);
    
    global.emitJsonInput({ success: true, data: cursoCompleto });
    res.json({
      success: true,
      data: cursoCompleto
    });
  } catch (error) {
    global.emitTraffic('Cursos', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/academy/cursos/:id/complete - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// GET /api/academy/cursos/:id - Obter curso por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    global.emitTraffic('Cursos', 'received', `Entrada recebida - GET /api/academy/cursos/${id}`);
    global.emitLog('info', `GET /api/academy/cursos/${id} - Obtendo curso por ID`);
    
    global.emitTraffic('Cursos', 'processing', 'Consultando DB');
    const result = await Cursos.getById(id);
    
    if (result.success) {
      global.emitTraffic('Cursos', 'completed', 'Concluído - Curso obtido com sucesso');
      global.emitLog('success', `GET /api/academy/cursos/${id} - Curso obtido com sucesso`);
      
      global.emitJsonInput(result);
      res.json(result);
    } else {
      global.emitTraffic('Cursos', 'error', result.error);
      global.emitLog('error', `GET /api/academy/cursos/${id} - ${result.error}`);
      res.status(result.error === 'Curso não encontrado' ? 404 : 500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Cursos', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/academy/cursos/:id - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// POST /api/academy/cursos - Criar novo curso
router.post('/', async (req, res) => {
  try {
    global.emitTraffic('Cursos', 'received', 'Entrada recebida - POST /api/academy/cursos');
    global.emitLog('info', 'POST /api/academy/cursos - Criando novo curso');
    
    const { cursoClasse, cursoNome, cursoDescription, courseOrder, isActive, createdBy, version } = req.body;
    
    if (!cursoClasse || !cursoNome || !courseOrder || !createdBy) {
      global.emitTraffic('Cursos', 'error', 'Dados obrigatórios ausentes');
      global.emitLog('error', 'POST /api/academy/cursos - cursoClasse, cursoNome, courseOrder e createdBy são obrigatórios');
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
      createdBy,
      version: version || 1
    };
    
    // Adicionar cursoDescription se fornecido
    if (cursoDescription !== undefined) {
      if (cursoDescription !== null && cursoDescription !== '') {
        cursoData.cursoDescription = String(cursoDescription).trim();
      } else {
        cursoData.cursoDescription = null;
      }
    }

    global.emitJson(cursoData);

    global.emitTraffic('Cursos', 'processing', 'Transmitindo para DB');
    const result = await Cursos.createCurso(cursoData);
    
    if (result.success) {
      global.emitTraffic('Cursos', 'completed', 'Concluído - Curso criado com sucesso');
      global.emitLog('success', `POST /api/academy/cursos - Curso "${cursoNome}" criado com sucesso`);
      
      global.emitJsonInput(result);
      res.status(201).json(result);
    } else {
      global.emitTraffic('Cursos', 'error', result.error);
      global.emitLog('error', `POST /api/academy/cursos - ${result.error}`);
      res.status(500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Cursos', 'error', 'Erro interno do servidor');
    global.emitLog('error', `POST /api/academy/cursos - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// PUT /api/academy/cursos/:id - Atualizar curso
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { cursoClasse, cursoNome, cursoDescription, courseOrder, isActive, createdBy, version } = req.body;
    
    global.emitTraffic('Cursos', 'received', `Entrada recebida - PUT /api/academy/cursos/${id}`);
    global.emitLog('info', `PUT /api/academy/cursos/${id} - Atualizando curso`);
    global.emitJson({ id, ...req.body });
    
    const updateData = {};
    if (cursoClasse !== undefined) updateData.cursoClasse = cursoClasse;
    if (cursoNome !== undefined) updateData.cursoNome = cursoNome;
    if (cursoDescription !== undefined) {
      if (cursoDescription !== null && cursoDescription !== '') {
        updateData.cursoDescription = String(cursoDescription).trim();
      } else {
        updateData.cursoDescription = null;
      }
    }
    if (courseOrder !== undefined) updateData.courseOrder = courseOrder;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (createdBy !== undefined) updateData.createdBy = createdBy;
    if (version !== undefined) updateData.version = version;

    global.emitTraffic('Cursos', 'processing', 'Transmitindo para DB');
    const result = await Cursos.updateCurso(id, updateData);
    
    if (result.success) {
      global.emitTraffic('Cursos', 'completed', 'Concluído - Curso atualizado com sucesso');
      global.emitLog('success', `PUT /api/academy/cursos/${id} - Curso atualizado com sucesso`);
      global.emitJson(result);
      res.json(result);
    } else {
      global.emitTraffic('Cursos', 'error', result.error);
      global.emitLog('error', `PUT /api/academy/cursos/${id} - ${result.error}`);
      res.status(result.error === 'Curso não encontrado' ? 404 : 500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Cursos', 'error', 'Erro interno do servidor');
    global.emitLog('error', `PUT /api/academy/cursos/:id - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// DELETE /api/academy/cursos/:id - Deletar curso (com cascade delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    global.emitTraffic('Cursos', 'received', `Entrada recebida - DELETE /api/academy/cursos/${id}`);
    global.emitLog('info', `DELETE /api/academy/cursos/${id} - Deletando curso com cascade delete`);
    global.emitJson({ id });

    // Buscar módulos do curso para deletar em cascata
    const Modulos = require('../models/Modulos');
    const Secoes = require('../models/Secoes');
    const Aulas = require('../models/Aulas');
    
    const modulosResult = await Modulos.getByCursoId(id);
    if (modulosResult.success && modulosResult.data.length > 0) {
      // Para cada módulo, deletar seções e aulas
      for (const modulo of modulosResult.data) {
        const secoesResult = await Secoes.getByModuloId(modulo._id);
        if (secoesResult.success && secoesResult.data.length > 0) {
          // Para cada seção, deletar aulas
          for (const secao of secoesResult.data) {
            await Aulas.deleteBySecaoId(secao._id);
          }
          // Deletar seções do módulo
          await Secoes.deleteByModuloId(modulo._id);
        }
        // Deletar módulo
        await Modulos.deleteModulo(modulo._id);
      }
    }

    global.emitTraffic('Cursos', 'processing', 'Transmitindo para DB');
    const result = await Cursos.deleteCurso(id);
    
    if (result.success) {
      global.emitTraffic('Cursos', 'completed', 'Concluído - Curso e dados relacionados deletados com sucesso');
      global.emitLog('success', `DELETE /api/academy/cursos/${id} - Curso deletado com sucesso`);
      global.emitJson(result);
      global.emitJsonInput(result);
      res.json(result);
    } else {
      global.emitTraffic('Cursos', 'error', result.error);
      global.emitLog('error', `DELETE /api/academy/cursos/${id} - ${result.error}`);
      res.status(result.error === 'Curso não encontrado' ? 404 : 500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Cursos', 'error', 'Erro interno do servidor');
    global.emitLog('error', `DELETE /api/academy/cursos/:id - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

module.exports = router;

