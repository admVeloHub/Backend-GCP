// VERSION: v1.8.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
const express = require('express');
const router = express.Router();
const Users = require('../models/Users');

// GET /api/users - Listar todos os usuários
router.get('/', async (req, res) => {
  try {
    const users = await Users.find({}).select('-__v');
    
    if (global.emitTraffic) {
      global.emitTraffic('GET /api/users', 'SUCCESS', `Listados ${users.length} usuários`);
    }
    
    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    
    if (global.emitTraffic) {
      global.emitTraffic('GET /api/users', 'ERROR', error.message);
    }
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// POST /api/users - Criar novo usuário
router.post('/', async (req, res) => {
  try {
    const { _userMail, _userId, _userRole, _userClearance, _userTickets, _funcoesAdministrativas } = req.body;
    
    // Validações básicas
    if (!_userMail || !_userId || !_userRole) {
      return res.status(400).json({
        success: false,
        error: 'Email, UserId e UserRole são obrigatórios'
      });
    }
    
    // Verificar se usuário já existe
    const existingUser = await Users.findOne({ 
      $or: [{ _userMail }, { _userId }] 
    });
    
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Usuário já existe com este email ou ID'
      });
    }
    
    const newUser = new Users({
      _userMail,
      _userId,
      _userRole,
      _userClearance: _userClearance || {
        artigos: false,
        velonews: false,
        botPerguntas: false,
        botAnalises: false,
        hubAnalises: false,
        chamadosInternos: false,
        igp: false,
        qualidade: false,
        capacity: false,
        config: false,
        servicos: false,
        academy: false
      },
      _userTickets: _userTickets || {
        artigos: false,
        processos: false,
        roteiros: false,
        treinamentos: false,
        funcionalidades: false,
        recursos: false,
        gestao: false,
        rhFin: false,
        facilities: false
      },
      _funcoesAdministrativas: _funcoesAdministrativas || {
        avaliador: false,
        auditoria: false,
        relatoriosGestao: false
      }
    });
    
    const savedUser = await newUser.save();
    
    if (global.emitTraffic) {
      global.emitTraffic('POST /api/users', 'SUCCESS', `Usuário criado: ${_userMail}`);
    }
    
    res.status(201).json({
      success: true,
      data: savedUser
    });
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    
    if (global.emitTraffic) {
      global.emitTraffic('POST /api/users', 'ERROR', error.message);
    }
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// PUT /api/users/{email} - Atualizar usuário
router.put('/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const updateData = req.body;
    
    // Log do payload recebido para debug
    console.log('📥 PUT /api/users/:email - Payload recebido:', JSON.stringify(updateData, null, 2));
    
    // Emitir JSON Input para o Monitor Skynet
    if (global.emitJsonInput) {
      global.emitJsonInput({
        endpoint: 'PUT /api/users/:email',
        email: email,
        payload: updateData,
        timestamp: new Date().toISOString()
      });
    }
    
    // Remover campos que não devem ser atualizados
    delete updateData._id;
    delete updateData._userMail;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    
    console.log('📝 PUT /api/users/:email - Dados para atualização:', JSON.stringify(updateData, null, 2));
    
    const updatedUser = await Users.findOneAndUpdate(
      { _userMail: email },
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }
    
    console.log('✅ PUT /api/users/:email - Usuário atualizado:', JSON.stringify(updatedUser, null, 2));
    
    // Emitir JSON de resposta para o Monitor Skynet
    if (global.emitJson) {
      global.emitJson({
        endpoint: 'PUT /api/users/:email',
        response: updatedUser,
        timestamp: new Date().toISOString()
      });
    }
    
    if (global.emitTraffic) {
      global.emitTraffic('PUT /api/users/:email', 'SUCCESS', `Usuário atualizado: ${email}`);
    }
    
    res.json({
      success: true,
      data: updatedUser
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar usuário:', error);
    
    if (global.emitTraffic) {
      global.emitTraffic('PUT /api/users/:email', 'ERROR', error.message);
    }
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// DELETE /api/users/{email} - Deletar usuário
router.delete('/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    const deletedUser = await Users.findOneAndDelete({ _userMail: email });
    
    if (!deletedUser) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }
    
    if (global.emitTraffic) {
      global.emitTraffic('DELETE /api/users/:email', 'SUCCESS', `Usuário deletado: ${email}`);
    }
    
    res.json({
      success: true,
      message: 'Usuário deletado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao deletar usuário:', error);
    
    if (global.emitTraffic) {
      global.emitTraffic('DELETE /api/users/:email', 'ERROR', error.message);
    }
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/users/check/{email} - Verificar se usuário está autorizado
router.get('/check/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    const user = await Users.findOne({ _userMail: email }).select('_userMail _userRole _userClearance _funcoesAdministrativas');
    
    if (!user) {
      return res.json({
        success: true,
        authorized: false,
        message: 'Usuário não encontrado'
      });
    }
    
    if (global.emitTraffic) {
      global.emitTraffic('GET /api/users/check/:email', 'SUCCESS', `Verificação de autorização: ${email}`);
    }
    
    res.json({
      success: true,
      authorized: true,
      data: {
        email: user._userMail,
        role: user._userRole,
        clearance: user._userClearance,
        funcoesAdministrativas: user._funcoesAdministrativas
      }
    });
  } catch (error) {
    console.error('Erro ao verificar usuário:', error);
    
    if (global.emitTraffic) {
      global.emitTraffic('GET /api/users/check/:email', 'ERROR', error.message);
    }
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/users/{email} - Obter dados do usuário
router.get('/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    const user = await Users.findOne({ _userMail: email }).select('-__v');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }
    
    if (global.emitTraffic) {
      global.emitTraffic('GET /api/users/:email', 'SUCCESS', `Dados obtidos: ${email}`);
    }
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Erro ao obter usuário:', error);
    
    if (global.emitTraffic) {
      global.emitTraffic('GET /api/users/:email', 'ERROR', error.message);
    }
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

module.exports = router;
