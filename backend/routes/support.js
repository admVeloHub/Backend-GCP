// VERSION: v1.8.5 | DATE: 2026-05-27 | AUTHOR: VeloHub Development Team
// CHANGELOG: v1.8.5 - POST /send-denuncia-velohub (VeloHub canal denúncias → e-mail DENUNCIA_EMAIL_TO)
// CHANGELOG: v1.8.4 - notify-user-reply-velohub: remove skip quando atribuído resolve para o mesmo e-mail do solicitante (teste/uso pelo mesmo operador); e-mail “novas mensagens” deve seguir
// CHANGELOG: v1.8.3 - notify-user-reply-velohub: e-mail “novas mensagens” apenas para o admin em _atribuido (getUserEmail), não para toda a categoria (LISTA_SCHEMAS _atribuido)
// CHANGELOG: v1.8.2 - PUT tk-conteudos/tk-gestao: removido sendTicketAssignedEmail — atribuição no Console não envia e-mail (único broadcast de “novo na categoria” = notify-new-ticket VeloHub); removidos getById pré-update e helpers só usados nesse fluxo
// CHANGELOG: v1.8.1 - PUT: sendTicketAssignedEmail condicionado a mudança de _atribuido e notification (supersedido por v1.8.2 — sem e-mail em atribuição)
// CHANGELOG: v1.8.0 - notify-user-reply-velohub: mesmos destinatários que novo ticket (getResponsibleUsersForTicketType + e-mail do _atribuido); sendTicketReplyEmail em lote; resposta attempted/succeeded / partial_send_failure alinhada ao notify-new-ticket
// CHANGELOG: v1.7.0 - POST /notify-user-reply-velohub (VeloHub→SKYNET após nova mensagem do solicitante no Mongo; e-mail ao atribuído, mesmo contrato de segredo)
// CHANGELOG: v1.6.5 - Removidos console.log/warn/error de diagnóstico [Skynet]; mantidos emitLog/emitTraffic e reloadMongoTransportFromDb antes de isReady
// CHANGELOG: v1.6.4 - runNotify: reloadMongoTransportFromDb antes de isReady (alinha ao gmail-test; snapshot pode estar vazio após cold start)
// CHANGELOG: v1.6.3 - (instrumentação temporária removida em v1.6.5) logs stdout notify/runNotify
// CHANGELOG: v1.6.2 - requireVelohubTicketNotifySecret: log ao responder 403 (requisição chegou; header ausente ou segredo diferente)
// CHANGELOG: v1.6.1 - notify-new-ticket-velohub: ticketId como TKC-/TKG- (mesmo _id do Mongo); ObjectId hex 24 chars só legado
// CHANGELOG: v1.6.0 - POST /notify-new-ticket-velohub (Velohub → SKYNET após insert no Mongo; segredo; campo notification)
// CHANGELOG: v1.5.1 - Mensagem quando isReady falha menciona Gmail + interruptor ENV/Conexões
const express = require('express');
const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const router = express.Router();
const TkGestao = require('../models/TkGestao');
const TkConteudos = require('../models/TkConteudos');
const { getTicketTypeFromTicket, isSLAExpired } = require('../utils/ticketUtils');
const { getResponsibleUsersForTicketType, getUserEmail } = require('../services/ticketNotificationService');
const emailService = require('../services/emailService');

/**
 * Compara segredo em tempo constante (header vs env).
 */
function timingSafeSecretEqual(received, expected) {
  try {
    const a = Buffer.from(String(received), 'utf8');
    const b = Buffer.from(String(expected), 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Middleware: gatilho servidor-a-servidor Velohub → SKYNET.
 * Header: X-Velohub-Ticket-Notify-Secret = process.env.VELOHUB_TICKET_NOTIFY_SECRET
 */
function requireVelohubTicketNotifySecret(req, res, next) {
  const expected = process.env.VELOHUB_TICKET_NOTIFY_SECRET;
  if (expected === undefined || String(expected).trim() === '') {
    global.emitLog(
      'warning',
      'POST /notify-new-ticket-velohub - VELOHUB_TICKET_NOTIFY_SECRET não definido no SKYNET'
    );
    return res.status(503).json({
      success: false,
      error: 'Notificação servidor-a-servidor não configurada no SKYNET'
    });
  }
  const got = req.get('x-velohub-ticket-notify-secret');
  if (!got || !timingSafeSecretEqual(got, expected)) {
    const detail = !got
      ? 'header X-Velohub-Ticket-Notify-Secret ausente'
      : 'valor do header não confere com VELOHUB_TICKET_NOTIFY_SECRET deste processo SKYNET';
    global.emitLog(
      'warning',
      `POST /notify-new-ticket-velohub - recebido mas 403 (${detail}); alinhar .env Velohub↔SKYNET (mesmo valor, sem espaços extras)`
    );
    global.emitTraffic(
      'Support',
      'error',
      'POST /api/support/notify-new-ticket-velohub (403 segredo)'
    );
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  next();
}

/**
 * Normaliza collectionKind do JSON do Velohub para tk_conteudos | tk_gestao.
 */
function normalizeTicketCollectionKind(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim().toLowerCase();
  if (s === 'tk_conteudos' || s === 'conteudos' || s === 'tk_conteudo') return 'tk_conteudos';
  if (s === 'tk_gestao' || s === 'gestao') return 'tk_gestao';
  return null;
}

/**
 * Em console_chamados o _id das coleções tk_conteudos/tk_gestao é string (ex.: TKC-000042, TKG-000012).
 * Aceita ainda ObjectId hex de 24 caracteres por retrocompatibilidade.
 */
function resolveTicketLookupId(raw) {
  const s = String(raw).trim();
  if (!s) return null;
  if (/^[a-fA-F0-9]{24}$/.test(s)) {
    try {
      return new ObjectId(s);
    } catch {
      /* fall through */
    }
  }
  return s;
}

/**
 * Envia e-mails de novo ticket e retorna métricas (deduplicação Velohub usa campo notification no doc).
 * @returns {Promise<{ attempted: number, succeeded: number, skipReason?: string, ticketType?: string }>}
 */
async function runNotifyCategoryMembersNewTicket(ticket, collectionLabel) {
  try {
    if (!ticket?._id) {
      return { attempted: 0, succeeded: 0, skipReason: 'missing_id' };
    }
    const ticketId = ticket._id;
    const ticketType = getTicketTypeFromTicket(ticket, collectionLabel);

    if (!ticketType) {
      global.emitLog(
        'warning',
        `runNotifyCategoryMembersNewTicket - Gênero não mapeado para _userTickets (coleção=${collectionLabel}, _genero=${ticket._genero || '?'})`
      );
      return { attempted: 0, succeeded: 0, skipReason: 'no_ticket_type' };
    }

    try {
      await emailService.reloadMongoTransportFromDb();
    } catch (reloadErr) {
      if (typeof global.emitLog === 'function') {
        global.emitLog('warning', `reloadMongoTransportFromDb: ${reloadErr.message}`);
      }
    }

    if (!emailService.isReady()) {
      global.emitLog(
        'warning',
        `runNotifyCategoryMembersNewTicket - Serviço de e-mail não pronto (${ticketType}): interruptor DESLIGADO, EMAIL_ENABLED!=true ou sem Gmail/SMTP — Conexões / env`
      );
      return { attempted: 0, succeeded: 0, skipReason: 'email_not_ready' };
    }

    let responsibleEmails = await getResponsibleUsersForTicketType(ticketType);

    if (ticket._atribuido) {
      const assignedEmail = await getUserEmail(ticket._atribuido);
      if (assignedEmail && !responsibleEmails.includes(assignedEmail)) {
        responsibleEmails = [...responsibleEmails, assignedEmail];
      }
    }

    if (responsibleEmails.length === 0) {
      global.emitLog(
        'warning',
        `runNotifyCategoryMembersNewTicket - Nenhum destinatário com _userTickets.${ticketType}=true (Config do Console)`
      );
      return { attempted: 0, succeeded: 0, skipReason: 'no_recipients', ticketType };
    }

    const results = await Promise.all(
      responsibleEmails.map((email) =>
        emailService.sendTicketAssignedEmail(ticket, ticketId, ticketType, email)
      )
    );
    const attempted = responsibleEmails.length;
    const succeeded = results.filter(Boolean).length;

    global.emitLog(
      'info',
      `runNotifyCategoryMembersNewTicket - Novo ticket ${ticketId}: ${succeeded}/${attempted} e-mail(ns) (${ticketType})`
    );

    return { attempted, succeeded, ticketType };
  } catch (emailError) {
    global.emitLog('error', `runNotifyCategoryMembersNewTicket - ${emailError.message}`);
    return { attempted: 0, succeeded: 0, skipReason: 'exception' };
  }
}

/**
 * Envia um e-mail por membro da categoria (_userTickets.tipo) ao abrir ticket (POST legado SKYNET).
 * Falhas de e-mail não interrompem a resposta HTTP.
 */
async function notifyCategoryMembersNewTicket(ticket, collectionLabel) {
  await runNotifyCategoryMembersNewTicket(ticket, collectionLabel);
}

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

      await notifyCategoryMembersNewTicket(result.data, 'tk_conteudos');

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

      await notifyCategoryMembersNewTicket(result.data, 'tk_gestao');

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

    global.emitTraffic('Support', 'processing', 'Transmitindo para DB console_chamados');

    global.emitJson({ _id: idParam, ...updateData });
    const result = await TkConteudos.update(idParam, updateData);

    if (result.success) {
      global.emitTraffic('Support', 'completed', 'Concluído - Ticket de conteúdo atualizado');
      global.emitLog('success', `PUT /api/support/tk-conteudos - Ticket atualizado: ${idParam}`);
      global.emitJsonInput(result);
      
      // Notificações por email (não bloqueia resposta da API)
      try {
        const updatedTicket = result.data;
        
        if (emailService.isReady()) {
          // Nova mensagem do solicitante (autor user) — template “novas mensagens”, não atribuição
          if (req.body._novaMensagem && req.body._novaMensagem.autor === 'user' && updatedTicket._atribuido) {
            const assignedEmail = await getUserEmail(updatedTicket._atribuido);
            if (assignedEmail) {
              await emailService.sendTicketReplyEmail(
                updatedTicket,
                idParam,
                req.body._novaMensagem,
                assignedEmail
              );
              global.emitLog('info', `PUT /api/support/tk-conteudos - Notificação novas mensagens (solicitante) para ${assignedEmail}`);
            }
          }

          // Verificar SLA vencido
          if (updatedTicket.createdAt) {
            const slaExpired = isSLAExpired(updatedTicket.createdAt);
            if (slaExpired && updatedTicket._statusConsole !== 'resolvido') {
              // Determinar destinatário: atribuído ou responsáveis da categoria
              let recipientEmail = null;
              
              if (updatedTicket._atribuido) {
                recipientEmail = await getUserEmail(updatedTicket._atribuido);
              }
              
              if (!recipientEmail) {
                const ticketType = getTicketTypeFromTicket(updatedTicket, 'tk_conteudos');
                if (ticketType) {
                  const responsibleEmails = await getResponsibleUsersForTicketType(ticketType);
                  if (responsibleEmails.length > 0) {
                    recipientEmail = responsibleEmails[0]; // Notificar primeiro responsável
                  }
                }
              }
              
              if (recipientEmail) {
                await emailService.sendSLAExpiredEmail(updatedTicket, idParam, recipientEmail);
                global.emitLog('info', `PUT /api/support/tk-conteudos - Notificação de SLA vencido enviada para ${recipientEmail}`);
              }
            }
          }
        }
      } catch (emailError) {
        // Não bloquear resposta da API em caso de erro de email
        global.emitLog('error', `PUT /api/support/tk-conteudos - Erro ao enviar notificações: ${emailError.message}`);
      }
      
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

    global.emitTraffic('Support', 'processing', 'Transmitindo para DB console_chamados');

    global.emitJson({ _id: idParam, ...updateData });
    const result = await TkGestao.update(idParam, updateData);

    if (result.success) {
      global.emitTraffic('Support', 'completed', 'Concluído - Ticket de gestão atualizado');
      global.emitLog('success', `PUT /api/support/tk-gestao - Ticket atualizado: ${idParam}`);
      global.emitJsonInput(result);
      
      // Notificações por email (não bloqueia resposta da API)
      try {
        const updatedTicket = result.data;
        
        if (emailService.isReady()) {
          // Nova mensagem do solicitante (autor user) — template “novas mensagens”, não atribuição
          if (req.body._novaMensagem && req.body._novaMensagem.autor === 'user' && updatedTicket._atribuido) {
            const assignedEmail = await getUserEmail(updatedTicket._atribuido);
            if (assignedEmail) {
              await emailService.sendTicketReplyEmail(
                updatedTicket,
                idParam,
                req.body._novaMensagem,
                assignedEmail
              );
              global.emitLog('info', `PUT /api/support/tk-gestao - Notificação novas mensagens (solicitante) para ${assignedEmail}`);
            }
          }

          // Verificar SLA vencido
          if (updatedTicket.createdAt) {
            const slaExpired = isSLAExpired(updatedTicket.createdAt);
            if (slaExpired && updatedTicket._statusConsole !== 'resolvido') {
              // Determinar destinatário: atribuído ou responsáveis da categoria
              let recipientEmail = null;
              
              if (updatedTicket._atribuido) {
                recipientEmail = await getUserEmail(updatedTicket._atribuido);
              }
              
              if (!recipientEmail) {
                const ticketType = getTicketTypeFromTicket(updatedTicket, 'tk_gestao');
                if (ticketType) {
                  const responsibleEmails = await getResponsibleUsersForTicketType(ticketType);
                  if (responsibleEmails.length > 0) {
                    recipientEmail = responsibleEmails[0]; // Notificar primeiro responsável
                  }
                }
              }
              
              if (recipientEmail) {
                await emailService.sendSLAExpiredEmail(updatedTicket, idParam, recipientEmail);
                global.emitLog('info', `PUT /api/support/tk-gestao - Notificação de SLA vencido enviada para ${recipientEmail}`);
              }
            }
          }
        }
      } catch (emailError) {
        // Não bloquear resposta da API em caso de erro de email
        global.emitLog('error', `PUT /api/support/tk-gestao - Erro ao enviar notificações: ${emailError.message}`);
      }
      
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

/**
 * POST /api/support/notify-new-ticket-velohub
 *
 * Gatilho servidor-a-servidor: após o Velohub gravar o ticket no Mongo (`notification: false` ou ausente).
 *
 * Contrato HTTP (Velohub):
 * - Method + path: POST `/api/support/notify-new-ticket-velohub`
 * - Header `Content-Type: application/json`
 * - Header `X-Velohub-Ticket-Notify-Secret`: igual a `VELOHUB_TICKET_NOTIFY_SECRET` no processo SKYNET
 * - Corpo JSON: `{ "ticketId": "<_id Mongo>", "collectionKind": "tk_conteudos" | "tk_gestao" }`
 *   ticketId: normalmente **`TKC-000042`** ou **`TKG-000012`** (igual ao `_id` gerado pelo SKYNET/Velohub); também aceito **ObjectId hex 24 caracteres** legado
 *   aliases aceitos para collectionKind: `conteudos`, `tk_conteudo`, `gestao`
 *
 * Após todos os envios de e-mail com sucesso para os destinatários calculados: `$set.notification = true` no documento do ticket.
 * Se `notification === true`: 200 `{ success, skipped }` sem reenviar.
 *
 * Respostas típicas: 403 segredo incorreto; 503 secret não configurado; 400 corpo inválido; 404 ticket inexistente (coleção errada ou id inexistente);
 * 200 com `notified`/ `skipReason` / tentativas conforme resultado.
 */
router.post('/notify-new-ticket-velohub', requireVelohubTicketNotifySecret, async (req, res) => {
  try {
    global.emitTraffic('Support', 'received', 'POST /api/support/notify-new-ticket-velohub');
    const ticketIdRaw = req.body?.ticketId ?? req.body?.id ?? req.body?._id;
    const collectionRaw = req.body?.collectionKind ?? req.body?.collection;
    const collectionLabel = normalizeTicketCollectionKind(collectionRaw);

    if (!ticketIdRaw || String(ticketIdRaw).trim() === '' || !collectionLabel) {
      return res.status(400).json({
        success: false,
        error: 'Informe ticketId e collectionKind (tk_conteudos ou tk_gestao) no JSON'
      });
    }

    const mongoId = resolveTicketLookupId(ticketIdRaw);
    if (mongoId == null) {
      return res.status(400).json({ success: false, error: 'ticketId vazio ou inválido' });
    }

    const model = collectionLabel === 'tk_gestao' ? TkGestao : TkConteudos;
    const fetched = await model.getById(mongoId);

    if (!fetched.success || !fetched.data) {
      return res.status(404).json({ success: false, error: 'Ticket não encontrado' });
    }

    const ticket = fetched.data;

    /** Campo opcional criado/atualizado pelo fluxo Velohub; ausente tratado como ainda não notificado */
    if (ticket.notification === true) {
      global.emitLog(
        'info',
        `POST /notify-new-ticket-velohub - já notificado, skip (${collectionLabel}, ${String(mongoId)})`
      );
      return res.status(200).json({
        success: true,
        skipped: true,
        reason: 'already_notified'
      });
    }

    const run = await runNotifyCategoryMembersNewTicket(ticket, collectionLabel);

    if (run.skipReason) {
      return res.status(200).json({
        success: true,
        notified: false,
        skipReason: run.skipReason,
        attempted: run.attempted,
        succeeded: run.succeeded,
        ...(run.ticketType ? { ticketType: run.ticketType } : {})
      });
    }

    if (run.attempted > 0 && run.succeeded === run.attempted) {
      const up = await model.update(mongoId, { notification: true });
      if (!up.success) {
        global.emitLog(
          'error',
          `POST /notify-new-ticket-velohub - envios OK mas persistência notification falhou: ${up.error || '?'}`
        );
        return res.status(500).json({
          success: false,
          notified: false,
          emailsDelivered: true,
          persistNotification: false,
          error: up.error || 'Falha ao atualizar campo notification'
        });
      }
      global.emitLog(
        'success',
        `POST /notify-new-ticket-velohub - notificado (${collectionLabel}, ${String(mongoId)})`
      );
      return res.status(200).json({
        success: true,
        notified: true,
        attempted: run.attempted,
        succeeded: run.succeeded,
        ticketType: run.ticketType
      });
    }

    return res.status(200).json({
      success: false,
      notified: false,
      skipReason: 'partial_send_failure',
      attempted: run.attempted,
      succeeded: run.succeeded,
      ticketType: run.ticketType
    });
  } catch (err) {
    global.emitTraffic('Support', 'error', 'Erro POST /notify-new-ticket-velohub');
    global.emitLog('error', `POST /notify-new-ticket-velohub - ${err.message}`);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * POST /api/support/notify-user-reply-velohub
 *
 * Gatilho servidor-a-servidor: após o VeloHub gravar no Mongo uma nova mensagem do solicitante (PUT local em tk_conteudos / tk_gestão).
 * Mesmo header e segredo que notify-new-ticket-velohub.
 *
 * Corpo JSON: `{ "ticketId": "<_id>", "collectionKind": "tk_conteudos" | "tk_gestao" }`
 *
 * Lê o ticket no Mongo, usa a última entrada de `_corpo` com `autor === 'user'` e envia o e-mail de
 * novas mensagens **somente** ao admin indicado em **`_atribuido`** (e-mail resolvido via `getUserEmail`), conforme
 * `LISTA_SCHEMAS.rb` / campos `_atribuido` em `tk_conteudos` e `tk_gestão`. Não envia a todos da categoria.
 */
router.post('/notify-user-reply-velohub', requireVelohubTicketNotifySecret, async (req, res) => {
  try {
    global.emitTraffic('Support', 'received', 'POST /api/support/notify-user-reply-velohub');
    global.emitLog('info', 'POST /notify-user-reply-velohub - processando');

    const ticketIdRaw = req.body?.ticketId ?? req.body?.id ?? req.body?._id;
    const collectionRaw = req.body?.collectionKind ?? req.body?.collection;
    const collectionLabel = normalizeTicketCollectionKind(collectionRaw);

    if (!ticketIdRaw || String(ticketIdRaw).trim() === '' || !collectionLabel) {
      return res.status(400).json({
        success: false,
        error: 'Informe ticketId e collectionKind (tk_conteudos ou tk_gestao) no JSON'
      });
    }

    const mongoId = resolveTicketLookupId(ticketIdRaw);
    if (mongoId == null) {
      return res.status(400).json({ success: false, error: 'ticketId vazio ou inválido' });
    }

    const model = collectionLabel === 'tk_gestao' ? TkGestao : TkConteudos;
    const fetched = await model.getById(mongoId);

    if (!fetched.success || !fetched.data) {
      return res.status(404).json({ success: false, error: 'Ticket não encontrado' });
    }

    const ticket = fetched.data;
    const corpo = Array.isArray(ticket._corpo) ? ticket._corpo : [];

    if (corpo.length === 0) {
      global.emitLog('info', `POST /notify-user-reply-velohub - skip sem mensagens (${String(mongoId)})`);
      return res.status(200).json({ success: true, skipped: true, reason: 'no_messages' });
    }

    const lastMsg = corpo[corpo.length - 1];
    if (!lastMsg || lastMsg.autor !== 'user') {
      global.emitLog(
        'info',
        `POST /notify-user-reply-velohub - skip última mensagem não é do solicitante (${String(mongoId)})`
      );
      return res.status(200).json({ success: true, skipped: true, reason: 'last_message_not_user' });
    }

    if (!ticket._atribuido || String(ticket._atribuido).trim() === '') {
      global.emitLog(
        'info',
        `POST /notify-user-reply-velohub - skip sem _atribuido (${String(mongoId)})`
      );
      return res.status(200).json({
        success: true,
        notified: false,
        skipReason: 'no_assignee'
      });
    }

    try {
      await emailService.reloadMongoTransportFromDb();
    } catch (reloadErr) {
      if (typeof global.emitLog === 'function') {
        global.emitLog('warning', `POST /notify-user-reply-velohub - reloadMongoTransportFromDb: ${reloadErr.message}`);
      }
    }

    if (!emailService.isReady()) {
      global.emitLog(
        'warning',
        `POST /notify-user-reply-velohub - e-mail não pronto (${String(mongoId)})`
      );
      return res.status(200).json({
        success: true,
        notified: false,
        skipReason: 'email_not_ready'
      });
    }

    const assignedEmail = await getUserEmail(ticket._atribuido);
    if (!assignedEmail) {
      global.emitLog(
        'warning',
        `POST /notify-user-reply-velohub - e-mail do atribuído não resolvido (${String(mongoId)}, _atribuido=${ticket._atribuido})`
      );
      return res.status(200).json({
        success: true,
        notified: false,
        skipReason: 'assignee_email_not_found'
      });
    }

    const sent = await emailService.sendTicketReplyEmail(ticket, String(mongoId), lastMsg, assignedEmail);

    if (sent) {
      global.emitLog(
        'success',
        `POST /notify-user-reply-velohub - novas mensagens enviadas para ${assignedEmail} (${String(mongoId)})`
      );
      return res.status(200).json({
        success: true,
        notified: true,
        attempted: 1,
        succeeded: 1,
        recipient: assignedEmail,
        recipients: [assignedEmail]
      });
    }

    global.emitLog('error', `POST /notify-user-reply-velohub - falha ao enviar para ${assignedEmail} (${String(mongoId)})`);
    return res.status(200).json({
      success: true,
      notified: false,
      skipReason: 'send_failed',
      attempted: 1,
      succeeded: 0
    });
  } catch (err) {
    global.emitTraffic('Support', 'error', 'Erro POST /notify-user-reply-velohub');
    global.emitLog('error', `POST /notify-user-reply-velohub - ${err.message}`);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * POST /api/support/send-denuncia-velohub
 *
 * VeloHub → SKYNET: envia manifestação do canal de denúncias por e-mail.
 * Header: X-Velohub-Ticket-Notify-Secret (mesmo contrato dos notifies Apoio)
 * Body: { modoComunicacao: "identificado"|"anonimo", mensagem: string, reportedBy?: { name, email } }
 */
router.post('/send-denuncia-velohub', requireVelohubTicketNotifySecret, async (req, res) => {
  try {
    global.emitTraffic('Support', 'received', 'POST /api/support/send-denuncia-velohub');

    const modoRaw = req.body?.modoComunicacao;
    const modo = modoRaw != null ? String(modoRaw).trim().toLowerCase() : '';
    const mensagem = req.body?.mensagem != null ? String(req.body.mensagem).trim() : '';

    if (modo !== 'identificado' && modo !== 'anonimo') {
      return res.status(400).json({
        success: false,
        error: 'modoComunicacao deve ser identificado ou anonimo'
      });
    }

    if (!mensagem) {
      return res.status(400).json({ success: false, error: 'mensagem é obrigatória' });
    }

    if (mensagem.length > 5000) {
      return res.status(400).json({ success: false, error: 'mensagem excede o limite de 5000 caracteres' });
    }

    const dest = process.env.DENUNCIA_EMAIL_TO != null ? String(process.env.DENUNCIA_EMAIL_TO).trim() : '';
    if (!dest || !dest.includes('@')) {
      global.emitLog('warning', 'POST /send-denuncia-velohub - DENUNCIA_EMAIL_TO não configurado');
      return res.status(503).json({
        success: false,
        error: 'Canal de denúncias não configurado (DENUNCIA_EMAIL_TO ausente)'
      });
    }

    let reportedBy = null;
    if (modo === 'identificado') {
      const rb = req.body?.reportedBy;
      const name = rb?.name != null ? String(rb.name).trim() : '';
      const email = rb?.email != null ? String(rb.email).trim().toLowerCase() : '';
      if (!name || !email || !email.includes('@')) {
        return res.status(400).json({
          success: false,
          error: 'Modo identificado exige reportedBy.name e reportedBy.email válidos'
        });
      }
      reportedBy = { name, email };
    }

    try {
      await emailService.reloadMongoTransportFromDb();
    } catch (reloadErr) {
      global.emitLog('warning', `POST /send-denuncia-velohub - reloadMongoTransportFromDb: ${reloadErr.message}`);
    }

    if (!emailService.isReady()) {
      global.emitLog('warning', 'POST /send-denuncia-velohub - serviço de e-mail não pronto');
      return res.status(503).json({
        success: false,
        error: 'Serviço de e-mail indisponível no momento'
      });
    }

    await emailService.sendDenunciaVelohubEmail({
      to: dest,
      modoComunicacao: modo,
      mensagem,
      reportedBy
    });

    global.emitLog(
      'success',
      `POST /send-denuncia-velohub - enviado (modo=${modo})`
    );
    return res.status(200).json({ success: true, sent: true });
  } catch (err) {
    global.emitTraffic('Support', 'error', 'Erro POST /send-denuncia-velohub');
    global.emitLog('error', `POST /send-denuncia-velohub - ${err.message}`);
    return res.status(500).json({
      success: false,
      error: 'Erro ao enviar denúncia por e-mail'
    });
  }
});

module.exports = router;
