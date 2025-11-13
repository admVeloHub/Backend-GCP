// VERSION: v1.0.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
const express = require('express');
const router = express.Router();
const CourseProgress = require('../models/CourseProgress');

// GET /api/academy/course-progress - Listar todos os progressos
router.get('/', async (req, res) => {
  try {
    global.emitTraffic('CourseProgress', 'received', 'Entrada recebida - GET /api/academy/course-progress');
    global.emitLog('info', 'GET /api/academy/course-progress - Listando todos os progressos');
    
    global.emitTraffic('CourseProgress', 'processing', 'Consultando DB');
    const result = await CourseProgress.getAll();
    
    global.emitTraffic('CourseProgress', 'completed', 'Concluído - Progressos listados com sucesso');
    global.emitLog('success', `GET /api/academy/course-progress - ${result.count} progressos encontrados`);
    
    // INBOUND: Resposta para o frontend
    global.emitJsonInput(result);
    res.json(result);
  } catch (error) {
    global.emitTraffic('CourseProgress', 'error', 'Erro ao listar progressos');
    global.emitLog('error', `GET /api/academy/course-progress - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// GET /api/academy/course-progress/:id - Obter progresso por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    global.emitTraffic('CourseProgress', 'received', `Entrada recebida - GET /api/academy/course-progress/${id}`);
    global.emitLog('info', `GET /api/academy/course-progress/${id} - Obtendo progresso por ID`);
    
    global.emitTraffic('CourseProgress', 'processing', 'Consultando DB');
    const result = await CourseProgress.getById(id);
    
    if (result.success) {
      global.emitTraffic('CourseProgress', 'completed', 'Concluído - Progresso obtido com sucesso');
      global.emitLog('success', `GET /api/academy/course-progress/${id} - Progresso obtido com sucesso`);
      
      // INBOUND: Resposta para o frontend
      global.emitJsonInput(result);
      res.json(result);
    } else {
      global.emitTraffic('CourseProgress', 'error', result.error);
      global.emitLog('error', `GET /api/academy/course-progress/${id} - ${result.error}`);
      res.status(result.error === 'Progresso não encontrado' ? 404 : 500).json(result);
    }
  } catch (error) {
    global.emitTraffic('CourseProgress', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/academy/course-progress/:id - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// GET /api/academy/course-progress/user/:userEmail - Buscar progressos por usuário
router.get('/user/:userEmail', async (req, res) => {
  try {
    const { userEmail } = req.params;
    
    global.emitTraffic('CourseProgress', 'received', `Entrada recebida - GET /api/academy/course-progress/user/${userEmail}`);
    global.emitLog('info', `GET /api/academy/course-progress/user/${userEmail} - Buscando progressos do usuário`);
    
    global.emitTraffic('CourseProgress', 'processing', 'Consultando DB');
    const result = await CourseProgress.getByUserEmail(userEmail);
    
    if (result.success) {
      global.emitTraffic('CourseProgress', 'completed', 'Concluído - Progressos do usuário obtidos com sucesso');
      global.emitLog('success', `GET /api/academy/course-progress/user/${userEmail} - ${result.count} progressos encontrados`);
      
      // INBOUND: Resposta para o frontend
      global.emitJsonInput(result);
      res.json(result);
    } else {
      global.emitTraffic('CourseProgress', 'error', result.error);
      global.emitLog('error', `GET /api/academy/course-progress/user/${userEmail} - ${result.error}`);
      res.status(500).json(result);
    }
  } catch (error) {
    global.emitTraffic('CourseProgress', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/academy/course-progress/user/:userEmail - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// GET /api/academy/course-progress/user/:userEmail/subtitle/:subtitle - Buscar progresso específico
router.get('/user/:userEmail/subtitle/:subtitle', async (req, res) => {
  try {
    const { userEmail, subtitle } = req.params;
    
    global.emitTraffic('CourseProgress', 'received', `Entrada recebida - GET /api/academy/course-progress/user/${userEmail}/subtitle/${subtitle}`);
    global.emitLog('info', `GET /api/academy/course-progress/user/${userEmail}/subtitle/${subtitle} - Buscando progresso específico`);
    
    global.emitTraffic('CourseProgress', 'processing', 'Consultando DB');
    const result = await CourseProgress.getByUserAndSubtitle(userEmail, subtitle);
    
    if (result.success) {
      global.emitTraffic('CourseProgress', 'completed', 'Concluído - Progresso específico obtido com sucesso');
      global.emitLog('success', `GET /api/academy/course-progress/user/${userEmail}/subtitle/${subtitle} - Progresso obtido com sucesso`);
      
      // INBOUND: Resposta para o frontend
      global.emitJsonInput(result);
      res.json(result);
    } else {
      global.emitTraffic('CourseProgress', 'error', result.error);
      global.emitLog('error', `GET /api/academy/course-progress/user/${userEmail}/subtitle/${subtitle} - ${result.error}`);
      res.status(result.error === 'Progresso não encontrado' ? 404 : 500).json(result);
    }
  } catch (error) {
    global.emitTraffic('CourseProgress', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/academy/course-progress/user/:userEmail/subtitle/:subtitle - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// POST /api/academy/course-progress - Criar novo progresso
router.post('/', async (req, res) => {
  try {
    global.emitTraffic('CourseProgress', 'received', 'Entrada recebida - POST /api/academy/course-progress');
    global.emitLog('info', 'POST /api/academy/course-progress - Criando novo progresso');
    
    const { userEmail, subtitle, completedVideos, quizUnlocked, completedAt } = req.body;
    
    if (!userEmail || !subtitle) {
      global.emitTraffic('CourseProgress', 'error', 'Dados obrigatórios ausentes');
      global.emitLog('error', 'POST /api/academy/course-progress - userEmail e subtitle são obrigatórios');
      return res.status(400).json({ 
        success: false, 
        error: 'userEmail e subtitle são obrigatórios' 
      });
    }

    const progressData = {
      userEmail,
      subtitle,
      completedVideos: completedVideos || {},
      quizUnlocked: quizUnlocked || false,
      completedAt: completedAt || null
    };

    // OUTBOUND: Schema sendo enviado para MongoDB
    global.emitJson(progressData);

    global.emitTraffic('CourseProgress', 'processing', 'Transmitindo para DB');
    const result = await CourseProgress.createProgress(progressData);
    
    if (result.success) {
      global.emitTraffic('CourseProgress', 'completed', 'Concluído - Progresso criado com sucesso');
      global.emitLog('success', `POST /api/academy/course-progress - Progresso criado com sucesso`);
      
      // INBOUND: Resposta para o frontend
      global.emitJsonInput(result);
      res.status(201).json(result);
    } else {
      global.emitTraffic('CourseProgress', 'error', result.error);
      global.emitLog('error', `POST /api/academy/course-progress - ${result.error}`);
      res.status(result.error.includes('já existe') ? 409 : 500).json(result);
    }
  } catch (error) {
    global.emitTraffic('CourseProgress', 'error', 'Erro interno do servidor');
    global.emitLog('error', `POST /api/academy/course-progress - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// PUT /api/academy/course-progress/:id - Atualizar progresso
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userEmail, subtitle, completedVideos, quizUnlocked, completedAt } = req.body;
    
    global.emitTraffic('CourseProgress', 'received', `Entrada recebida - PUT /api/academy/course-progress/${id}`);
    global.emitLog('info', `PUT /api/academy/course-progress/${id} - Atualizando progresso`);
    global.emitJson({ id, ...req.body });
    
    const updateData = {};
    if (userEmail !== undefined) updateData.userEmail = userEmail;
    if (subtitle !== undefined) updateData.subtitle = subtitle;
    if (completedVideos !== undefined) updateData.completedVideos = completedVideos;
    if (quizUnlocked !== undefined) updateData.quizUnlocked = quizUnlocked;
    if (completedAt !== undefined) updateData.completedAt = completedAt;

    global.emitTraffic('CourseProgress', 'processing', 'Transmitindo para DB');
    const result = await CourseProgress.updateProgress(id, updateData);
    
    if (result.success) {
      global.emitTraffic('CourseProgress', 'completed', 'Concluído - Progresso atualizado com sucesso');
      global.emitLog('success', `PUT /api/academy/course-progress/${id} - Progresso atualizado com sucesso`);
      global.emitJson(result);
      res.json(result);
    } else {
      global.emitTraffic('CourseProgress', 'error', result.error);
      global.emitLog('error', `PUT /api/academy/course-progress/${id} - ${result.error}`);
      res.status(result.error === 'Progresso não encontrado' ? 404 : 500).json(result);
    }
  } catch (error) {
    global.emitTraffic('CourseProgress', 'error', 'Erro interno do servidor');
    global.emitLog('error', `PUT /api/academy/course-progress/:id - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// DELETE /api/academy/course-progress/:id - Deletar progresso
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    global.emitTraffic('CourseProgress', 'received', `Entrada recebida - DELETE /api/academy/course-progress/${id}`);
    global.emitLog('info', `DELETE /api/academy/course-progress/${id} - Deletando progresso`);
    // OUTBOUND: ID sendo deletado
    global.emitJson({ id });

    global.emitTraffic('CourseProgress', 'processing', 'Transmitindo para DB');
    const result = await CourseProgress.deleteProgress(id);
    
    if (result.success) {
      global.emitTraffic('CourseProgress', 'completed', 'Concluído - Progresso deletado com sucesso');
      global.emitLog('success', `DELETE /api/academy/course-progress/${id} - Progresso deletado com sucesso`);
      global.emitJson(result);
      // INBOUND: Confirmação para o frontend
      global.emitJsonInput(result);
      res.json(result);
    } else {
      global.emitTraffic('CourseProgress', 'error', result.error);
      global.emitLog('error', `DELETE /api/academy/course-progress/${id} - ${result.error}`);
      res.status(result.error === 'Progresso não encontrado' ? 404 : 500).json(result);
    }
  } catch (error) {
    global.emitTraffic('CourseProgress', 'error', 'Erro interno do servidor');
    global.emitLog('error', `DELETE /api/academy/course-progress/:id - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

module.exports = router;

