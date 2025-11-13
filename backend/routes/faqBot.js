// VERSION: v1.0.1 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team
const express = require('express');
const router = express.Router();
const { FAQ } = require('../models/ModuleStatus');

// GET /api/faq-bot - Buscar perguntas frequentes do bot
router.get('/', async (req, res) => {
  try {
    if (global.emitTraffic) {
      global.emitTraffic('FAQBot', 'received', 'Entrada recebida - GET /api/faq-bot');
    }
    if (global.emitLog) {
      global.emitLog('info', 'GET /api/faq-bot - Buscando perguntas frequentes do bot');
    }
    
    // Buscar documento de FAQ (ou criar se não existir)
    let faqDoc = await FAQ.findOne({ _id: 'faq' });
    
    if (!faqDoc) {
      if (global.emitTraffic) {
        global.emitTraffic('FAQBot', 'processing', 'Criando documento padrão de FAQ no MongoDB');
      }
      faqDoc = new FAQ({ 
        _id: 'faq',
        dados: [],
        totalPerguntas: 0
      });
      await faqDoc.save();
    } else {
      if (global.emitTraffic) {
        global.emitTraffic('FAQBot', 'processing', 'Consultando documento de FAQ existente no MongoDB');
      }
    }
    
    const result = {
      success: true,
      data: {
        dados: faqDoc.dados,
        totalPerguntas: faqDoc.totalPerguntas,
        updatedAt: faqDoc.updatedAt
      }
    };
    
    if (global.emitTraffic) {
      global.emitTraffic('FAQBot', 'completed', `FAQ obtido com ${faqDoc.dados.length} perguntas`);
    }
    
    if (global.emitJson) {
      global.emitJson(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Erro ao buscar FAQ do bot:', error);
    console.error('Stack trace:', error.stack);
    
    if (global.emitTraffic) {
      global.emitTraffic('FAQBot', 'error', `Erro detalhado: ${error.message}`);
    }
    
    if (global.emitLog) {
      global.emitLog('error', `GET /api/faq-bot - Erro: ${error.message}`);
    }
    
    // Determinar tipo de erro para resposta mais específica
    let errorMessage = 'Erro interno do servidor';
    let statusCode = 500;
    
    if (error.name === 'MongoNetworkError' || error.name === 'MongoTimeoutError') {
      errorMessage = 'Erro de conexão com o banco de dados';
      statusCode = 503;
    } else if (error.name === 'ValidationError') {
      errorMessage = 'Erro de validação dos dados';
      statusCode = 400;
    } else if (error.name === 'CastError') {
      errorMessage = 'Erro de formato de dados';
      statusCode = 400;
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/faq-bot - Atualizar perguntas frequentes do bot
router.post('/', async (req, res) => {
  try {
    const { dados, totalPerguntas, updatedBy } = req.body;
    
    if (global.emitTraffic) {
      global.emitTraffic('FAQBot', 'received', 'Entrada recebida - POST /api/faq-bot');
    }
    if (global.emitLog) {
      global.emitLog('info', 'POST /api/faq-bot - Processando atualização do FAQ');
    }
    if (global.emitJson) {
      global.emitJson(req.body);
    }
    
    // Validações para FAQ
    if (!dados || !Array.isArray(dados) || totalPerguntas === undefined) {
      return res.status(400).json({
        success: false,
        error: 'dados (array) e totalPerguntas são obrigatórios'
      });
    }
    
    if (dados.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Máximo de 10 perguntas permitidas no array dados'
      });
    }
    
    if (totalPerguntas < 0) {
      return res.status(400).json({
        success: false,
        error: 'totalPerguntas deve ser maior ou igual a 0'
      });
    }
    
    const updateData = {
      dados: dados,
      totalPerguntas: totalPerguntas
    };
    
    if (global.emitTraffic) {
      global.emitTraffic('FAQBot', 'processing', `Atualizando FAQ com ${dados.length} perguntas`);
    }
    
    // Atualizar documento de FAQ
    const updatedFAQ = await FAQ.findOneAndUpdate(
      { _id: 'faq' },
      updateData,
      { 
        upsert: true, 
        new: true, 
        runValidators: true 
      }
    );
    
    console.log(`FAQ atualizado com ${dados.length} perguntas e total de ${totalPerguntas} perguntas${updatedBy ? ` por ${updatedBy}` : ''}`);
    
    const responseData = {
      success: true,
      message: `FAQ atualizado com ${dados.length} perguntas`,
      data: {
        dados: updatedFAQ.dados,
        totalPerguntas: updatedFAQ.totalPerguntas,
        updatedAt: updatedFAQ.updatedAt
      }
    };
    
    if (global.emitTraffic) {
      global.emitTraffic('FAQBot', 'completed', `FAQ atualizado com ${dados.length} perguntas`);
    }
    
    if (global.emitJson) {
      global.emitJson(responseData);
    }
    
    res.json(responseData);
    
  } catch (error) {
    console.error('Erro ao atualizar FAQ do bot:', error);
    
    if (global.emitTraffic) {
      global.emitTraffic('FAQBot', 'error', error.message);
    }
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// PUT /api/faq-bot - Atualizar FAQ (mesmo comportamento do POST)
router.put('/', async (req, res) => {
  try {
    const { dados, totalPerguntas, updatedBy } = req.body;
    
    if (global.emitTraffic) {
      global.emitTraffic('FAQBot', 'received', 'Entrada recebida - PUT /api/faq-bot');
    }
    if (global.emitLog) {
      global.emitLog('info', 'PUT /api/faq-bot - Processando atualização do FAQ');
    }
    if (global.emitJson) {
      global.emitJson(req.body);
    }
    
    // Validações para FAQ
    if (!dados || !Array.isArray(dados) || totalPerguntas === undefined) {
      return res.status(400).json({
        success: false,
        error: 'dados (array) e totalPerguntas são obrigatórios'
      });
    }
    
    if (dados.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Máximo de 10 perguntas permitidas no array dados'
      });
    }
    
    if (totalPerguntas < 0) {
      return res.status(400).json({
        success: false,
        error: 'totalPerguntas deve ser maior ou igual a 0'
      });
    }
    
    const updateData = {
      dados: dados,
      totalPerguntas: totalPerguntas
    };
    
    if (global.emitTraffic) {
      global.emitTraffic('FAQBot', 'processing', `Atualizando FAQ com ${dados.length} perguntas`);
    }
    
    // Atualizar documento de FAQ
    const updatedFAQ = await FAQ.findOneAndUpdate(
      { _id: 'faq' },
      updateData,
      { 
        upsert: true, 
        new: true, 
        runValidators: true 
      }
    );
    
    console.log(`FAQ atualizado com ${dados.length} perguntas e total de ${totalPerguntas} perguntas${updatedBy ? ` por ${updatedBy}` : ''}`);
    
    const responseData = {
      success: true,
      message: `FAQ atualizado com ${dados.length} perguntas`,
      data: {
        dados: updatedFAQ.dados,
        totalPerguntas: updatedFAQ.totalPerguntas,
        updatedAt: updatedFAQ.updatedAt
      }
    };
    
    if (global.emitTraffic) {
      global.emitTraffic('FAQBot', 'completed', `FAQ atualizado com ${dados.length} perguntas`);
    }
    
    if (global.emitJson) {
      global.emitJson(responseData);
    }
    
    res.json(responseData);
    
  } catch (error) {
    console.error('Erro ao atualizar FAQ do bot:', error);
    
    if (global.emitTraffic) {
      global.emitTraffic('FAQBot', 'error', error.message);
    }
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

module.exports = router;
