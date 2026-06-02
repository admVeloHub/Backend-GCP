// VERSION: v2.1.0 | DATE: 2026-05-29 | AUTHOR: VeloHub Development Team
// CHANGELOG: v2.1.0 - Removido SMTP/Nodemailer; envio exclusivamente via Gmail API (Mongo)
// CHANGELOG: v2.0.9 - sendDenunciaVelohubEmail: assunto e corpo conforme canal Velohub (identificado / anônimo)
/**
 * Serviço de envio de e-mails via Gmail API (credenciais MongoDB singleton).
 */
const { sendViaGmailApi } = require('./gmailApiSend');

/** Estado carregado de models/EmailTransportConfig (console_config.email_config, _id email_tk_notifications) */
let mongoTransportSnapshot = null;

let emailEnabled = process.env.EMAIL_ENABLED === 'true';
let consoleUrl = String(
  process.env.CONSOLE_URL || 'https://console-v2-hfsqj6konq-ue.a.run.app'
).replace(/\/+$/, '');

function hasGmailMongoReady() {
  const m = mongoTransportSnapshot;
  const sa = m?.serviceAccountJson;
  return !!(
    m &&
    typeof m.defaultFromEmail === 'string' &&
    m.defaultFromEmail.includes('@') &&
    typeof m.delegatedUserEmail === 'string' &&
    m.delegatedUserEmail.includes('@') &&
    sa &&
    typeof sa.private_key === 'string' &&
    typeof sa.client_email === 'string'
  );
}

function applyMongoTransport(doc) {
  if (!doc || doc.transportMode === 'smtp') {
    mongoTransportSnapshot = null;
    return;
  }
  mongoTransportSnapshot = {
    transportMode: 'gmail_api',
    defaultFromEmail: (doc.defaultFromEmail || '').trim().toLowerCase(),
    delegatedUserEmail: (doc.delegatedUserEmail || doc.defaultFromEmail || '').trim().toLowerCase(),
    serviceAccountJson: doc.serviceAccountJson || null
  };
  if (
    mongoTransportSnapshot.defaultFromEmail &&
    !mongoTransportSnapshot.delegatedUserEmail.includes('@')
  ) {
    mongoTransportSnapshot.delegatedUserEmail = mongoTransportSnapshot.defaultFromEmail;
  }
}

async function reloadMongoTransportFromDb() {
  const EmailTransportConfig = require('../models/EmailTransportConfig');
  const doc = await EmailTransportConfig.findSingletonLean();
  applyMongoTransport(doc);
}

function getEffectiveFromAddress() {
  if (hasGmailMongoReady()) {
    return mongoTransportSnapshot.defaultFromEmail;
  }
  return '';
}

async function dispatchOutgoingMail({ to, subject, html }) {
  if (!hasGmailMongoReady()) {
    throw new Error('Gmail API não configurado no servidor');
  }

  const fromAddr = getEffectiveFromAddress();
  await sendViaGmailApi(
    {
      serviceAccountJson: mongoTransportSnapshot.serviceAccountJson,
      delegatedUserEmail: mongoTransportSnapshot.delegatedUserEmail
    },
    { from: fromAddr, to: String(to).trim(), subject, html }
  );
  return true;
}

function setEnabled(enabled) {
  emailEnabled = enabled;
}

function isReady() {
  if (!emailEnabled) {
    return false;
  }
  return hasGmailMongoReady();
}

function getNewTicketTemplate(ticket, ticketId, ticketType) {
  const assunto = ticket._assunto || ticket._direcionamento || 'Sem assunto';
  const solicitante = ticket._userEmail || 'N/A';
  const data = new Date(ticket.createdAt || Date.now()).toLocaleString('pt-BR');
  const link = `${consoleUrl}/chamados-internos?ticket=${ticketId}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #1634FF; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
    .info-box { background-color: white; padding: 15px; margin: 10px 0; border-left: 4px solid #1634FF; border-radius: 4px; }
    .button { display: inline-block; background-color: #1634FF; color: #ffffff !important; -webkit-text-fill-color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 20px; font-weight: 600; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Novo Ticket Atribuído</h1>
    </div>
    <div class="content">
      <p>Olá,</p>
      <p>Um novo ticket foi atribuído à sua categoria:</p>
      <div class="info-box">
        <strong>ID do Ticket:</strong> ${ticketId}<br>
        <strong>Assunto:</strong> ${assunto}<br>
        <strong>Categoria:</strong> ${ticketType}<br>
        <strong>Solicitante:</strong> ${solicitante}<br>
        <strong>Data:</strong> ${data}
      </div>
      <a href="${link}" class="button"><span style="color:#ffffff;">Ver Ticket</span></a>
      <div class="footer">
        <p>Este é um email automático do sistema VeloHub Console.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

function getNewReplyTemplate(ticket, ticketId) {
  const assunto = ticket._assunto || ticket._direcionamento || 'Sem assunto';
  const solicitante = ticket._userEmail || 'N/A';
  const link = `${consoleUrl}/chamados-internos?ticket=${ticketId}`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;">
  <p>Olá,</p>
  <p><strong>Seu ticket nº ${ticketId} tem novas mensagens.</strong></p>
  <p>O solicitante interagiu novamente com o chamado. Acesse o console para responder.</p>
  <p><strong>Ticket:</strong> ${ticketId}<br><strong>Assunto:</strong> ${assunto}<br><strong>E-mail:</strong> ${solicitante}</p>
  <p><a href="${link}">Abrir no Console</a></p>
</body>
</html>
  `;
}

function getSLAExpiredTemplate(ticket, ticketId) {
  const assunto = ticket._assunto || ticket._direcionamento || 'Sem assunto';
  const solicitante = ticket._userEmail || 'N/A';
  const createdAt = new Date(ticket.createdAt || Date.now());
  const slaDeadline = new Date(createdAt.getTime() + 48 * 60 * 60 * 1000);
  const horasVencidas = Math.floor((Date.now() - slaDeadline.getTime()) / (1000 * 60 * 60));
  const link = `${consoleUrl}/chamados-internos?ticket=${ticketId}`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;">
  <h1>⚠️ SLA Vencido</h1>
  <p>O ticket <strong>#${ticketId}</strong> ultrapassou o prazo de SLA (48 horas).</p>
  <p><strong>Assunto:</strong> ${assunto}<br><strong>Solicitante:</strong> ${solicitante}</p>
  <p>Vencido há <strong>${horasVencidas} horas</strong>.</p>
  <p><a href="${link}">Ver Ticket</a></p>
</body>
</html>
  `;
}

async function sendTicketAssignedEmail(ticket, ticketId, ticketType, recipientEmail) {
  if (!isReady()) {
    global.emitLog('warning', 'emailService.sendTicketAssignedEmail - Serviço de email não está pronto');
    return false;
  }
  try {
    const assunto = ticket._assunto || ticket._direcionamento || 'Sem assunto';
    await dispatchOutgoingMail({
      to: recipientEmail,
      subject: `[Ticket ${ticketId}] Novo ticket atribuído - ${assunto}`,
      html: getNewTicketTemplate(ticket, ticketId, ticketType)
    });
    global.emitLog('success', `emailService.sendTicketAssignedEmail - Email enviado para ${recipientEmail}`);
    return true;
  } catch (error) {
    global.emitLog('error', `emailService.sendTicketAssignedEmail - ${error.message}`);
    return false;
  }
}

async function sendTicketReplyEmail(ticket, ticketId, replyMessage, recipientEmail) {
  if (!isReady()) {
    global.emitLog('warning', 'emailService.sendTicketReplyEmail - Serviço de email não está pronto');
    return false;
  }
  try {
    await dispatchOutgoingMail({
      to: recipientEmail,
      subject: `[Ticket ${ticketId}] Seu ticket nº ${ticketId} tem novas mensagens`,
      html: getNewReplyTemplate(ticket, ticketId)
    });
    global.emitLog('success', `emailService.sendTicketReplyEmail - Email enviado para ${recipientEmail}`);
    return true;
  } catch (error) {
    global.emitLog('error', `emailService.sendTicketReplyEmail - ${error.message}`);
    return false;
  }
}

async function sendSLAExpiredEmail(ticket, ticketId, recipientEmail) {
  if (!isReady()) {
    global.emitLog('warning', 'emailService.sendSLAExpiredEmail - Serviço de email não está pronto');
    return false;
  }
  try {
    await dispatchOutgoingMail({
      to: recipientEmail,
      subject: `[Ticket ${ticketId}] ⚠️ SLA Vencido`,
      html: getSLAExpiredTemplate(ticket, ticketId)
    });
    global.emitLog('success', `emailService.sendSLAExpiredEmail - Email enviado para ${recipientEmail}`);
    return true;
  } catch (error) {
    global.emitLog('error', `emailService.sendSLAExpiredEmail - ${error.message}`);
    return false;
  }
}

async function sendGmailTestMessage({ to }) {
  if (!hasGmailMongoReady()) {
    throw new Error('Configuração Gmail incompleta no servidor');
  }
  const dest = String(to || mongoTransportSnapshot.delegatedUserEmail).trim();
  await dispatchOutgoingMail({
    to: dest,
    subject: '[VeloHub] Teste de envio Gmail API',
    html: `<p>Este é um e-mail de teste enviado pelo Console (configurações &gt; Conexões).</p><p>${new Date().toISOString()}</p>`
  });
}

function escapeHtmlForEmail(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDenunciaDateTime(date = new Date()) {
  return date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

async function sendDenunciaVelohubEmail({ to, modoComunicacao, mensagem, reportedBy }) {
  const modo = modoComunicacao === 'identificado' ? 'identificado' : 'anonimo';
  const subject = 'Velohub - Canal de denúncias';
  const safeMsg = escapeHtmlForEmail(mensagem).replace(/\n/g, '<br/>');
  const when = formatDenunciaDateTime(new Date());

  let html;
  if (modo === 'identificado' && reportedBy) {
    html =
      `<div style="font-family:Arial,sans-serif;font-size:14px;">` +
      `<p><strong>Nome:</strong> ${escapeHtmlForEmail(reportedBy.name)}</p>` +
      `<p><strong>Email:</strong> ${escapeHtmlForEmail(reportedBy.email)}</p>` +
      `<p><strong>Data/hora:</strong> ${escapeHtmlForEmail(when)}</p>` +
      `<p><strong>Manifestação:</strong></p><p>${safeMsg}</p></div>`;
  } else {
    html =
      `<div style="font-family:Arial,sans-serif;font-size:14px;">` +
      `<p><strong>Denúncia Anônima</strong></p>` +
      `<p><strong>Data/hora:</strong> ${escapeHtmlForEmail(when)}</p>` +
      `<p><strong>Manifestação:</strong></p><p>${safeMsg}</p></div>`;
  }

  await dispatchOutgoingMail({ to: String(to).trim(), subject, html });
}

module.exports = {
  setEnabled,
  isReady,
  hasGmailMongoReady,
  applyMongoTransport,
  reloadMongoTransportFromDb,
  sendGmailTestMessage,
  sendDenunciaVelohubEmail,
  sendTicketAssignedEmail,
  sendTicketReplyEmail,
  sendSLAExpiredEmail,
  getEffectiveFromAddress,
  getMongoTransportSnapshotSanitized() {
    if (!mongoTransportSnapshot) return null;
    const sa = mongoTransportSnapshot.serviceAccountJson || {};
    return {
      transportMode: mongoTransportSnapshot.transportMode,
      defaultFromEmail: mongoTransportSnapshot.defaultFromEmail,
      delegatedUserEmail: mongoTransportSnapshot.delegatedUserEmail,
      hasServiceAccount: !!(sa.private_key && sa.client_email),
      serviceAccountClientEmail: sa.client_email || ''
    };
  },
  getEnabled: () => emailEnabled
};
