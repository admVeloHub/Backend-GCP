// VERSION: v1.0.2 | DATE: 2026-03-26 | AUTHOR: VeloHub Development Team
const express = require('express');
const router = express.Router();
const ArtigosCategorias = require('../models/ArtigosCategorias');

// GET /api/artigos-categorias - Documento singleton com lista de categorias
router.get('/', async (req, res) => {
  try {
    global.emitTraffic('ArtigosCategorias', 'received', 'Entrada recebida - GET /api/artigos-categorias');
    global.emitLog('info', 'GET /api/artigos-categorias - Obtendo categorias');

    global.emitTraffic('ArtigosCategorias', 'processing', 'Consultando DB');
    const result = await ArtigosCategorias.getSingleton();

    if (result.success) {
      global.emitTraffic('ArtigosCategorias', 'completed', 'Concluído - Categorias obtidas');
      global.emitLog('success', 'GET /api/artigos-categorias - OK');
      global.emitJsonInput(result);
      return res.json(result);
    }

    global.emitTraffic('ArtigosCategorias', 'error', result.error);
    global.emitLog('error', `GET /api/artigos-categorias - ${result.error}`);
    return res.status(404).json(result);
  } catch (error) {
    global.emitTraffic('ArtigosCategorias', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/artigos-categorias - Erro: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// PUT /api/artigos-categorias - Atualiza o mesmo documento singleton (array Categorias completo)
router.put('/', async (req, res) => {
  try {
    const { Categorias } = req.body;

    global.emitTraffic('ArtigosCategorias', 'received', 'Entrada recebida - PUT /api/artigos-categorias');
    global.emitLog('info', 'PUT /api/artigos-categorias - Atualizando categorias');
    if (typeof global.emitJson === 'function') {
      global.emitJson({ Categorias });
    }

    global.emitTraffic('ArtigosCategorias', 'processing', 'Transmitindo para DB');
    const result = await ArtigosCategorias.replaceCategorias(Categorias);

    if (result.success) {
      global.emitTraffic('ArtigosCategorias', 'completed', 'Concluído - Categorias atualizadas');
      global.emitLog('success', 'PUT /api/artigos-categorias - OK');
      if (typeof global.emitJson === 'function') {
        global.emitJson(result);
      }
      return res.json(result);
    }

    global.emitTraffic('ArtigosCategorias', 'error', result.error);
    global.emitLog('error', `PUT /api/artigos-categorias - ${result.error}`);
    const clientErrors = ['obrigatório', 'duplicado', 'Informe ao menos', 'deve ser um array'];
    const is400 = result.error && clientErrors.some((s) => result.error.includes(s));
    return res.status(is400 ? 400 : 500).json(result);
  } catch (error) {
    global.emitTraffic('ArtigosCategorias', 'error', 'Erro interno do servidor');
    global.emitLog('error', `PUT /api/artigos-categorias - Erro: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

module.exports = router;
