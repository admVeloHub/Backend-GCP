// VERSION: v1.3.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
const express = require('express');
const router = express.Router();
const TkGestao = require('../models/TkGestao');
const TkConteudos = require('../models/TkConteudos');

// Constantes para status válidos
const VALID_STATUS_HUB = ['novo', 'aberto', 'em espera', 'pendente', 'resolvido'];
const VALID_STATUS_CONSOLE = ['novo', 'aberto', 'em espera', 'pendente', 'resolvido'];

// Constantes para valores válidos de processamento
const VALID_PROCESSAMENTO = ['aprovação do gestor', 'consulta viabilidade', 'processamento'];

// POST /api/support/tk-conteudos - Criar ticket de conteúdo
router.post('/tk-conteudos', async (req, res) => {
  try {
    const conteudoData = req.body;
    
    // Validação de campos obrigatórios
    const requiredFields = ['_userEmail', '_assunto', '_genero', '_tipo', '_corpo', '_statusHub', '_statusConsole'];
    const missingFields = requiredFields.filter(field => !conteudoData[field]);
    
    if (missingFields.length > 0) {
      global.emitTraffic('Support', 'error', 'Campos obrigatórios ausentes');
      global.emitLog('error', `POST /api/support/tk-conteudos - Campos obrigatórios ausentes: ${missingFields.join(', ')}`);
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios ausentes',
        missingFields
      });
    }
    
    // Validação de status válidos
    if (!VALID_STATUS_HUB.includes(conteudoData._statusHub)) {
      global.emitTraffic('Support', 'error', 'Status Hub inválido');
      global.emitLog('error', `POST /api/support/tk-conteudos - Status Hub inválido: ${conteudoData._statusHub}`);
      return res.status(400).json({
        success: false,
        error: 'Status Hub inválido',
        validStatus: VALID_STATUS_HUB
      });
    }
    
    if (!VALID_STATUS_CONSOLE.includes(conteudoData._statusConsole)) {
      global.emitTraffic('Support', 'error', 'Status Console inválido');
      global.emitLog('error', `POST /api/support/tk-conteudos - Status Console inválido: ${conteudoData._statusConsole}`);
      return res.status(400).json({
        success: false,
        error: 'Status Console inválido',
        validStatus: VALID_STATUS_CONSOLE
      });
    }
    
    global.emitTraffic('Support', 'received', 'Entrada recebida - POST /api/support/tk-conteudos');
    global.emitLog('info', 'POST /api/support/tk-conteudos - Criando ticket de conteúdo');
    global.emitJson(conteudoData);
    
    global.emitTraffic('Support', 'processing', 'Transmitindo para DB console_chamados');
    const result = await TkConteudos.create(conteudoData);
    
    if (result.success) {
      global.emitTraffic('Support', 'completed', 'Concluído - Ticket de conteúdo criado');
      global.emitLog('success', `POST /api/support/tk-conteudos - Ticket criado: ${result.data._id}`);
      global.emitJsonInput(result);
      res.status(201).json(result);
    } else {
      global.emitTraffic('Support', 'error', result.error);
      global.emitLog('error', `POST /api/support/tk-conteudos - ${result.error}`);
      res.status(500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Support', 'error', 'Erro interno do servidor');
    global.emitLog('error', `POST /api/support/tk-conteudos - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// POST /api/support/tk-gestao - Criar ticket de gestão
router.post('/tk-gestao', async (req, res) => {
  try {
    const gestaoData = req.body;
    
    // Validação de campos obrigatórios
    const requiredFields = ['_userEmail', '_genero', '_tipo', '_direcionamento', '_corpo', '_statusHub', '_statusConsole'];
    const missingFields = requiredFields.filter(field => !gestaoData[field]);
    
    if (missingFields.length > 0) {
      global.emitTraffic('Support', 'error', 'Campos obrigatórios ausentes');
      global.emitLog('error', `POST /api/support/tk-gestao - Campos obrigatórios ausentes: ${missingFields.join(', ')}`);
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios ausentes',
        missingFields
      });
    }
    
    // Validação de status válidos
    if (!VALID_STATUS_HUB.includes(gestaoData._statusHub)) {
      global.emitTraffic('Support', 'error', 'Status Hub inválido');
      global.emitLog('error', `POST /api/support/tk-gestao - Status Hub inválido: ${gestaoData._statusHub}`);
      return res.status(400).json({
        success: false,
        error: 'Status Hub inválido',
        validStatus: VALID_STATUS_HUB
      });
    }
    
    if (!VALID_STATUS_CONSOLE.includes(gestaoData._statusConsole)) {
      global.emitTraffic('Support', 'error', 'Status Console inválido');
      global.emitLog('error', `POST /api/support/tk-gestao - Status Console inválido: ${gestaoData._statusConsole}`);
      return res.status(400).json({
        success: false,
        error: 'Status Console inválido',
        validStatus: VALID_STATUS_CONSOLE
      });
    }
    
    global.emitTraffic('Support', 'received', 'Entrada recebida - POST /api/support/tk-gestao');
    global.emitLog('info', 'POST /api/support/tk-gestao - Criando ticket de gestão');
    global.emitJson(gestaoData);
    
    global.emitTraffic('Support', 'processing', 'Transmitindo para DB console_chamados');
    const result = await TkGestao.create(gestaoData);
    
    if (result.success) {
      global.emitTraffic('Support', 'completed', 'Concluído - Ticket de gestão criado');
      global.emitLog('success', `POST /api/support/tk-gestao - Ticket criado: ${result.data._id}`);
      global.emitJsonInput(result);
      res.status(201).json(result);
    } else {
      global.emitTraffic('Support', 'error', result.error);
      global.emitLog('error', `POST /api/support/tk-gestao - ${result.error}`);
      res.status(500).json(result);
    }
  } catch (error) {
    global.emitTraffic('Support', 'error', 'Erro interno do servidor');
    global.emitLog('error', `POST /api/support/tk-gestao - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// GET /api/support/tickets - Listar todos os tickets (ambos os tipos)
router.get('/tickets', async (req, res) => {
  try {
    global.emitTraffic('Support', 'received', 'Entrada recebida - GET /api/support/tickets');
    global.emitLog('info', 'GET /api/support/tickets - Listando todos os tickets');
    
    global.emitTraffic('Support', 'processing', 'Transmitindo para DB console_chamados');
    
    // Buscar ambos os tipos de tickets
    const [gestaoResult, conteudosResult] = await Promise.all([
      TkGestao.getAll(),
      TkConteudos.getAll()
    ]);
    
    // Combinar resultados
    const allTickets = {
      success: true,
      data: {
        gestao: gestaoResult.data || [],
        conteudos: conteudosResult.data || []
      },
      count: (gestaoResult.data?.length || 0) + (conteudosResult.data?.length || 0),
      gestaoCount: gestaoResult.data?.length || 0,
      conteudosCount: conteudosResult.data?.length || 0
    };
    
    global.emitTraffic('Support', 'completed', 'Concluído - Tickets listados');
    global.emitLog('success', `GET /api/support/tickets - ${allTickets.count} tickets encontrados (${allTickets.gestaoCount} gestão, ${allTickets.conteudosCount} conteúdos)`);
    global.emitJsonInput(allTickets);
    
    res.json(allTickets);
  } catch (error) {
    global.emitTraffic('Support', 'error', 'Erro ao listar tickets');
    global.emitLog('error', `GET /api/support/tickets - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// GET /api/support/ticket/:id - Buscar ticket específico por ID
router.get('/ticket/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    global.emitTraffic('Support', 'received', `Entrada recebida - GET /api/support/ticket/${id}`);
    global.emitLog('info', `GET /api/support/ticket/${id} - Buscando ticket específico`);
    global.emitJson({ id });
    
    global.emitTraffic('Support', 'processing', 'Transmitindo para DB console_chamados');
    
    // Tentar buscar em ambas as collections
    const [gestaoResult, conteudosResult] = await Promise.all([
      TkGestao.getById(id),
      TkConteudos.getById(id)
    ]);
    
    let result;
    if (gestaoResult.success) {
      result = { ...gestaoResult, ticketType: 'gestao' };
    } else if (conteudosResult.success) {
      result = { ...conteudosResult, ticketType: 'conteudos' };
    } else {
      result = {
        success: false,
        error: 'Ticket não encontrado'
      };
    }
    
    if (result.success) {
      global.emitTraffic('Support', 'completed', 'Concluído - Ticket encontrado');
      global.emitLog('success', `GET /api/support/ticket/${id} - Ticket encontrado (${result.ticketType})`);
      global.emitJsonInput(result);
      res.json(result);
    } else {
      global.emitTraffic('Support', 'error', result.error);
      global.emitLog('error', `GET /api/support/ticket/${id} - ${result.error}`);
      res.status(404).json(result);
    }
  } catch (error) {
    global.emitTraffic('Support', 'error', 'Erro interno do servidor');
    global.emitLog('error', `GET /api/support/ticket/:id - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// PUT /api/support/tk-conteudos - Atualizar ticket de conteúdo
router.put('/tk-conteudos', async (req, res) => {
  try {
    // Suporta ambos: `_id` (novo contrato do front) e `id` (retrocompatibilidade)
    const idParam = req.body._id || req.body.id;
    if (!idParam) {
      global.emitTraffic('Support', 'error', 'ID do ticket é obrigatório');
      global.emitLog('error', 'PUT /api/support/tk-conteudos - ID do ticket é obrigatório');
      return res.status(400).json({ success: false, error: 'ID do ticket é obrigatório' });
    }

    // Se payload contém atribuição, aplicar validações mínimas e restringir atualização
    const isAssignmentUpdate = Object.prototype.hasOwnProperty.call(req.body, '_atribuido');
    if (isAssignmentUpdate) {
      const atribuido = req.body._atribuido;
      if (typeof atribuido !== 'string' || atribuido.trim().length === 0) {
        global.emitTraffic('Support', 'error', 'Campo _atribuido é obrigatório e deve ser string não vazia');
        global.emitLog('error', 'PUT /api/support/tk-conteudos - _atribuido inválido');
        return res.status(400).json({ success: false, error: 'Campo _atribuido é obrigatório e deve ser string não vazia' });
      }
      // Validação do prefixo TKC-
      if (!/^TKC-/.test(idParam)) {
        global.emitTraffic('Support', 'error', 'Prefixo do ID não corresponde à coleção tk_conteudos');
        global.emitLog('error', `PUT /api/support/tk-conteudos - Prefixo inválido para ID: ${idParam}`);
        return res.status(400).json({ success: false, error: 'Prefixo do ID não corresponde à coleção tk_conteudos' });
      }
    }

    // Validação do campo _processamento se presente
    if (Object.prototype.hasOwnProperty.call(req.body, '_processamento')) {
      const processamento = req.body._processamento;
      if (processamento !== null && processamento !== undefined && processamento !== '') {
        if (typeof processamento !== 'string' || !VALID_PROCESSAMENTO.includes(processamento)) {
          global.emitTraffic('Support', 'error', 'Valor inválido para campo _processamento');
          global.emitLog('error', `PUT /api/support/tk-conteudos - _processamento inválido: ${processamento}`);
          return res.status(400).json({
            success: false,
            error: 'Valor inválido para campo _processamento',
            validValues: VALID_PROCESSAMENTO
          });
        }
      }
    }

    // Validação da nova mensagem se presente
    if (Object.prototype.hasOwnProperty.call(req.body, '_novaMensagem')) {
      const novaMensagem = req.body._novaMensagem;
      if (novaMensagem && typeof novaMensagem === 'object') {
        if (!novaMensagem.mensagem || !novaMensagem.timestamp || !novaMensagem.userName || !novaMensagem.autor) {
          global.emitTraffic('Support', 'error', 'Campos obrigatórios da nova mensagem ausentes');
          global.emitLog('error', 'PUT /api/support/tk-conteudos - Campos obrigatórios da nova mensagem ausentes');
          return res.status(400).json({
            success: false,
            error: 'Nova mensagem deve conter: mensagem, timestamp, userName, autor'
          });
        }
      }
    }

    global.emitTraffic('Support', 'received', 'Entrada recebida - PUT /api/support/tk-conteudos');
    global.emitLog('info', `PUT /api/support/tk-conteudos - Atualizando ticket: ${idParam}`);

    // Montar payload de atualização
    let updateData;
    if (isAssignmentUpdate) {
      updateData = {
        _atribuido: req.body._atribuido,
        _lastUpdatedBy: req.body._lastUpdatedBy || 'admin',
      };
    } else {
      // Retrocompatibilidade: permitir outros campos existentes
      const { _id, id, ...rest } = req.body;
      updateData = rest;
    }

    global.emitJson({ _id: idParam, ...updateData });
    global.emitTraffic('Support', 'processing', 'Transmitindo para DB console_chamados');
    const result = await TkConteudos.update(idParam, updateData);

    if (result.success) {
      global.emitTraffic('Support', 'completed', 'Concluído - Ticket de conteúdo atualizado');
      global.emitLog('success', `PUT /api/support/tk-conteudos - Ticket atualizado: ${idParam}`);
      global.emitJsonInput(result);
      return res.json(result);
    }

    global.emitTraffic('Support', 'error', result.error);
    global.emitLog('error', `PUT /api/support/tk-conteudos - ${result.error}`);
    return res.status(result.error === 'Conteúdo não encontrado' ? 404 : 500).json(result);
  } catch (error) {
    global.emitTraffic('Support', 'error', 'Erro interno do servidor');
    global.emitLog('error', `PUT /api/support/tk-conteudos - Erro: ${error.message}`);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// PUT /api/support/tk-gestao - Atualizar ticket de gestão
router.put('/tk-gestao', async (req, res) => {
  try {
    // Suporta ambos: `_id` e `id`
    const idParam = req.body._id || req.body.id;
    if (!idParam) {
      global.emitTraffic('Support', 'error', 'ID do ticket é obrigatório');
      global.emitLog('error', 'PUT /api/support/tk-gestao - ID do ticket é obrigatório');
      return res.status(400).json({ success: false, error: 'ID do ticket é obrigatório' });
    }

    const isAssignmentUpdate = Object.prototype.hasOwnProperty.call(req.body, '_atribuido');
    if (isAssignmentUpdate) {
      const atribuido = req.body._atribuido;
      if (typeof atribuido !== 'string' || atribuido.trim().length === 0) {
        global.emitTraffic('Support', 'error', 'Campo _atribuido é obrigatório e deve ser string não vazia');
        global.emitLog('error', 'PUT /api/support/tk-gestao - _atribuido inválido');
        return res.status(400).json({ success: false, error: 'Campo _atribuido é obrigatório e deve ser string não vazia' });
      }
      // Validação do prefixo TKG-
      if (!/^TKG-/.test(idParam)) {
        global.emitTraffic('Support', 'error', 'Prefixo do ID não corresponde à coleção tk_gestão');
        global.emitLog('error', `PUT /api/support/tk-gestao - Prefixo inválido para ID: ${idParam}`);
        return res.status(400).json({ success: false, error: 'Prefixo do ID não corresponde à coleção tk_gestão' });
      }
    }

    // Validação do campo _processamento se presente
    if (Object.prototype.hasOwnProperty.call(req.body, '_processamento')) {
      const processamento = req.body._processamento;
      if (processamento !== null && processamento !== undefined && processamento !== '') {
        if (typeof processamento !== 'string' || !VALID_PROCESSAMENTO.includes(processamento)) {
          global.emitTraffic('Support', 'error', 'Valor inválido para campo _processamento');
          global.emitLog('error', `PUT /api/support/tk-gestao - _processamento inválido: ${processamento}`);
          return res.status(400).json({
            success: false,
            error: 'Valor inválido para campo _processamento',
            validValues: VALID_PROCESSAMENTO
          });
        }
      }
    }

    // Validação da nova mensagem se presente
    if (Object.prototype.hasOwnProperty.call(req.body, '_novaMensagem')) {
      const novaMensagem = req.body._novaMensagem;
      if (novaMensagem && typeof novaMensagem === 'object') {
        if (!novaMensagem.mensagem || !novaMensagem.timestamp || !novaMensagem.userName || !novaMensagem.autor) {
          global.emitTraffic('Support', 'error', 'Campos obrigatórios da nova mensagem ausentes');
          global.emitLog('error', 'PUT /api/support/tk-gestao - Campos obrigatórios da nova mensagem ausentes');
          return res.status(400).json({
            success: false,
            error: 'Nova mensagem deve conter: mensagem, timestamp, userName, autor'
          });
        }
      }
    }

    global.emitTraffic('Support', 'received', 'Entrada recebida - PUT /api/support/tk-gestao');
    global.emitLog('info', `PUT /api/support/tk-gestao - Atualizando ticket: ${idParam}`);

    let updateData;
    if (isAssignmentUpdate) {
      updateData = {
        _atribuido: req.body._atribuido,
        _lastUpdatedBy: req.body._lastUpdatedBy || 'admin',
      };
    } else {
      const { _id, id, ...rest } = req.body;
      updateData = rest;
    }

    global.emitJson({ _id: idParam, ...updateData });
    global.emitTraffic('Support', 'processing', 'Transmitindo para DB console_chamados');
    const result = await TkGestao.update(idParam, updateData);

    if (result.success) {
      global.emitTraffic('Support', 'completed', 'Concluído - Ticket de gestão atualizado');
      global.emitLog('success', `PUT /api/support/tk-gestao - Ticket atualizado: ${idParam}`);
      global.emitJsonInput(result);
      return res.json(result);
    }

    global.emitTraffic('Support', 'error', result.error);
    global.emitLog('error', `PUT /api/support/tk-gestao - ${result.error}`);
    return res.status(result.error === 'Gestão não encontrada' ? 404 : 500).json(result);
  } catch (error) {
    global.emitTraffic('Support', 'error', 'Erro interno do servidor');
    global.emitLog('error', `PUT /api/support/tk-gestao - Erro: ${error.message}`);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// GET /api/support/status-validos - Obter status válidos
router.get('/status-validos', async (req, res) => {
  try {
    global.emitTraffic('Support', 'received', 'Entrada recebida - GET /api/support/status-validos');
    global.emitLog('info', 'GET /api/support/status-validos - Obtendo status válidos');
    
    const statusValidos = {
      statusHub: VALID_STATUS_HUB,
      statusConsole: VALID_STATUS_CONSOLE
    };
    
    global.emitTraffic('Support', 'completed', 'Concluído - Status válidos obtidos');
    global.emitLog('success', 'GET /api/support/status-validos - Status válidos retornados');
    global.emitJson(statusValidos);
    
    res.json({
      success: true,
      data: statusValidos
    });
  } catch (error) {
    global.emitTraffic('Support', 'error', 'Erro ao obter status válidos');
    global.emitLog('error', `GET /api/support/status-validos - Erro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

module.exports = router;
