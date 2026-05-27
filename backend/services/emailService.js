// VERSION: v2.0.9 | DATE: 2026-05-27 | AUTHOR: VeloHub Development Team
// CHANGELOG: v2.0.9 - sendDenunciaVelohubEmail: assunto e corpo conforme canal Velohub (identificado / anônimo)
// CHANGELOG: v2.0.8 - sendDenunciaVelohubEmail (canal denúncias VeloHub → DENUNCIA_EMAIL_TO)
// CHANGELOG: v2.0.7 - Template novas mensagens: texto “interagiu novamente… Acesse o console para responder.”
// CHANGELOG: v2.0.6 - Mensagem do solicitante: assunto e HTML distintos do e-mail de “novo ticket na categoria” — “Seu ticket nº … tem novas mensagens” + texto de novo conteúdo do solicitante no Apoio
// CHANGELOG: v2.0.5 - getSLAExpiredTemplate: fechamento do template literal/HTML + JSDoc fora da string — corrige SyntaxError ao subir o servidor
// CHANGELOG: v2.0.3 - Fallback CONSOLE_URL nos templates (links chamados-internos): Cloud Run console-v2; prioridade: env CONSOLE_URL
// CHANGELOG: v2.0.2 - isReady(): Gmail API carregado do Mongo (hasGmailMongoReady) dispensa EMAIL_ENABLED — alinha com sendGmailTestMessage e evita email_not_ready após restart sem env
// CHANGELOG: v2.0.1 - E-mail "nova resposta": corpo da mensagem não é mais incluído (só dados do ticket + link)
// CHANGELOG: v2.0.0 - Envio via Gmail API (Mongo + service account + delegação) além do SMTP/Nodemailer; dispatch unificado para tickets
/**
 * Serviço de envio de e-mails: Nodemailer (SMTP) e/ou Gmail API (credenciais MongoDB singleton).
 */
const nodemailer = require('nodemailer');
const { sendViaGmailApi } = require('./gmailApiSend');

// Estado global do serviço
let transporter = null;
/** Estado carregado de models/EmailTransportConfig (console_config.email_config, _id email_tk_notifications) */
let mongoTransportSnapshot = null;

let emailEnabled = process.env.EMAIL_ENABLED === 'true';
let emailConfig = {
  host: process.env.SMTP_HOST || '',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true para 465, false para outras portas
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
};
let emailFrom = process.env.EMAIL_FROM || 'noreply@velohub.com.br';
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

/**
 * Injeta/atualiza configuração lida do MongoDB (coleção configurável pelo cluster).
 */
function applyMongoTransport(doc) {
  if (!doc) {
    mongoTransportSnapshot = null;
    return;
  }
  if (doc.transportMode === 'smtp') {
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
  return emailFrom;
}

/**
 * SMTP (Nodemailer) ou Gmail API (delegação).
 */
async function dispatchOutgoingMail({ to, subject, html }) {
  const fromAddr = getEffectiveFromAddress();

  if (hasGmailMongoReady()) {
    await sendViaGmailApi(
      {
        serviceAccountJson: mongoTransportSnapshot.serviceAccountJson,
        delegatedUserEmail: mongoTransportSnapshot.delegatedUserEmail
      },
      { from: fromAddr, to: String(to).trim(), subject, html }
    );
    return true;
  }

  if (!transporter) {
    throw new Error('SMTP não inicializado');
  }

  await transporter.sendMail({
    from: fromAddr,
    to,
    subject,
    html
  });
  return true;
}

/**
 * Inicializa o transporter do Nodemailer
 * @param {Object} config - Configuração SMTP opcional (se não fornecido, usa variáveis de ambiente)
 * @returns {Promise<boolean>} - true se inicializado com sucesso
 */
async function initializeTransporter(config = null) {
  try {
    const smtpConfig = config || emailConfig;
    
    if (!smtpConfig.host || !smtpConfig.auth.user || !smtpConfig.auth.pass) {
      global.emitLog('warning', 'emailService.initializeTransporter - Configuração SMTP incompleta');
      return false;
    }

    transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: {
        user: smtpConfig.auth.user,
        pass: smtpConfig.auth.pass
      }
    });

    // Verificar conexão
    await transporter.verify();
    global.emitLog('success', 'emailService.initializeTransporter - Transporter inicializado com sucesso');
    return true;
  } catch (error) {
    global.emitLog('error', `emailService.initializeTransporter - Erro: ${error.message}`);
    transporter = null;
    return false;
  }
}

/**
 * Atualiza configuração do email
 * @param {Object} config - Nova configuração SMTP
 * @param {string} from - Email remetente
 */
function updateConfig(config, from) {
  emailConfig = { ...emailConfig, ...config };
  if (from) {
    emailFrom = from;
  }
  // Reinicializar transporter com nova config
  if (transporter) {
    initializeTransporter();
  }
}

/**
 * Ativa/desativa serviço de email
 * @param {boolean} enabled - true para ativar, false para desativar
 */
function setEnabled(enabled) {
  emailEnabled = enabled;
}

/**
 * Verifica se o serviço está habilitado e configurado
 * @returns {boolean}
 */
function isReady() {
  if (hasGmailMongoReady()) {
    return true;
  }
  if (!emailEnabled) {
    return false;
  }
  return transporter !== null;
}

/**
 * Template HTML para novo ticket atribuído
 */
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

      <a href="${link}" class="button" style="display:inline-block;background-color:#1634FF;color:#ffffff !important;-webkit-text-fill-color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:4px;margin-top:20px;font-weight:600;"><span style="color:#ffffff;text-decoration:none;mso-line-height-rule:exactly;">Ver Ticket</span></a>
      
      <div class="footer">
        <p>Este é um email automático do sistema VeloHub Console.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * E-mail: nova mensagem do solicitante no Apoio (VeloHub → notify-user-reply ou PUT Console com _novaMensagem autor user).
 * Texto e assunto próprios — não reutilizar o template de abertura/atribuição na categoria.
 */
function getNewReplyTemplate(ticket, ticketId) {
  const assunto = ticket._assunto || ticket._direcionamento || 'Sem assunto';
  const solicitante = ticket._userEmail || 'N/A';
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
      <h1 style="margin:0;font-size:22px;">Novas mensagens no chamado</h1>
    </div>
    <div class="content">
      <p>Olá,</p>
      <p><strong>Seu ticket nº ${ticketId} tem novas mensagens.</strong></p>
      <p>O solicitante interagiu novamente com o chamado. Acesse o console para responder.</p>

      <div class="info-box">
        <strong>Ticket:</strong> ${ticketId}<br>
        <strong>Assunto:</strong> ${assunto}<br>
        <strong>E-mail do solicitante:</strong> ${solicitante}
      </div>

      <a href="${link}" class="button" style="display:inline-block;background-color:#1634FF;color:#ffffff !important;-webkit-text-fill-color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:4px;margin-top:20px;font-weight:600;"><span style="color:#ffffff;text-decoration:none;mso-line-height-rule:exactly;">Abrir no Console</span></a>

      <div class="footer">
        <p>Este é um email automático do sistema VeloHub Console.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Template HTML para SLA vencido
 */
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
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #EF4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
    .info-box { background-color: white; padding: 15px; margin: 10px 0; border-left: 4px solid #EF4444; border-radius: 4px; }
    .warning-box { background-color: #FFF3CD; padding: 15px; margin: 10px 0; border-left: 4px solid #FFC107; border-radius: 4px; }
    .button { display: inline-block; background-color: #EF4444; color: #ffffff !important; -webkit-text-fill-color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 20px; font-weight: 600; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ SLA Vencido</h1>
    </div>
    <div class="content">
      <p>Olá,</p>
      <p>O ticket <strong>#${ticketId}</strong> ultrapassou o prazo de SLA (48 horas):</p>
      
      <div class="info-box">
        <strong>ID do Ticket:</strong> ${ticketId}<br>
        <strong>Assunto:</strong> ${assunto}<br>
        <strong>Solicitante:</strong> ${solicitante}<br>
        <strong>Criado em:</strong> ${createdAt.toLocaleString('pt-BR')}<br>
        <strong>Prazo SLA:</strong> ${slaDeadline.toLocaleString('pt-BR')}
      </div>

      <div class="warning-box">
        <strong>⚠️ Atenção:</strong> O ticket está vencido há <strong>${horasVencidas} horas</strong>.
        Por favor, resolva o ticket o mais rápido possível.
      </div>

      <a href="${link}" class="button" style="display:inline-block;background-color:#EF4444;color:#ffffff !important;-webkit-text-fill-color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:4px;margin-top:20px;font-weight:600;"><span style="color:#ffffff;text-decoration:none;mso-line-height-rule:exactly;">Ver Ticket</span></a>
      
      <div class="footer">
        <p>Este é um email automático do sistema VeloHub Console.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Envia email de novo ticket atribuído
 * @param {Object} ticket - Objeto do ticket
 * @param {string} ticketId - ID do ticket
 * @param {string} ticketType - Tipo do ticket (para exibição)
 * @param {string} recipientEmail - Email do destinatário
 * @returns {Promise<boolean>} - true se enviado com sucesso
 */
async function sendTicketAssignedEmail(ticket, ticketId, ticketType, recipientEmail) {
  if (!isReady()) {
    global.emitLog('warning', 'emailService.sendTicketAssignedEmail - Serviço de email não está pronto');
    return false;
  }

  try {
    const assunto = ticket._assunto || ticket._direcionamento || 'Sem assunto';
    const html = getNewTicketTemplate(ticket, ticketId, ticketType);

    await dispatchOutgoingMail({
      to: recipientEmail,
      subject: `[Ticket ${ticketId}] Novo ticket atribuído - ${assunto}`,
      html
    });

    global.emitLog('success', `emailService.sendTicketAssignedEmail - Email enviado para ${recipientEmail}`);
    return true;
  } catch (error) {
    global.emitLog('error', `emailService.sendTicketAssignedEmail - Erro ao enviar email: ${error.message}`);
    return false;
  }
}

/**
 * Envia email de nova resposta recebida
 * @param {Object} ticket - Objeto do ticket
 * @param {string} ticketId - ID do ticket
 * @param {Object} replyMessage - Objeto da mensagem de resposta
 * @param {string} recipientEmail - Email do destinatário
 * @returns {Promise<boolean>} - true se enviado com sucesso
 */
async function sendTicketReplyEmail(ticket, ticketId, replyMessage, recipientEmail) {
  if (!isReady()) {
    global.emitLog('warning', 'emailService.sendTicketReplyEmail - Serviço de email não está pronto');
    return false;
  }

  try {
    const html = getNewReplyTemplate(ticket, ticketId);

    await dispatchOutgoingMail({
      to: recipientEmail,
      subject: `[Ticket ${ticketId}] Seu ticket nº ${ticketId} tem novas mensagens`,
      html
    });

    global.emitLog('success', `emailService.sendTicketReplyEmail - Email enviado para ${recipientEmail}`);
    return true;
  } catch (error) {
    global.emitLog('error', `emailService.sendTicketReplyEmail - Erro ao enviar email: ${error.message}`);
    return false;
  }
}

/**
 * Envia email de SLA vencido
 * @param {Object} ticket - Objeto do ticket
 * @param {string} ticketId - ID do ticket
 * @param {string} recipientEmail - Email do destinatário
 * @returns {Promise<boolean>} - true se enviado com sucesso
 */
async function sendSLAExpiredEmail(ticket, ticketId, recipientEmail) {
  if (!isReady()) {
    global.emitLog('warning', 'emailService.sendSLAExpiredEmail - Serviço de email não está pronto');
    return false;
  }

  try {
    const html = getSLAExpiredTemplate(ticket, ticketId);

    await dispatchOutgoingMail({
      to: recipientEmail,
      subject: `[Ticket ${ticketId}] ⚠️ SLA Vencido`,
      html
    });

    global.emitLog('success', `emailService.sendSLAExpiredEmail - Email enviado para ${recipientEmail}`);
    return true;
  } catch (error) {
    global.emitLog('error', `emailService.sendSLAExpiredEmail - Erro ao enviar email: ${error.message}`);
    return false;
  }
}

/**
 * Testa conexão SMTP com credenciais fornecidas
 * @param {Object} config - Configuração SMTP para teste
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function testConnection(config) {
  try {
    const testTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure || false,
      auth: {
        user: config.user,
        pass: config.password
      }
    });

    await testTransporter.verify();
    return { success: true, message: 'Conexão SMTP testada com sucesso' };
  } catch (error) {
    return { success: false, message: `Erro ao testar conexão: ${error.message}` };
  }
}

// Inicializar transporter na inicialização do módulo se configurado
if (emailConfig.host && emailConfig.auth.user && emailConfig.auth.pass) {
  initializeTransporter().catch(err => {
    global.emitLog('error', `emailService - Erro ao inicializar transporter: ${err.message}`);
  });
}

/**
 * E-mail de teste (aba Conexões) — Gmail API.
 */
async function sendGmailTestMessage({ to }) {
  if (!hasGmailMongoReady()) {
    throw new Error('Configuração Gmail incompleta no servidor');
  }
  const dest = String(to || mongoTransportSnapshot.delegatedUserEmail).trim();
  await dispatchOutgoingMail({
    to: dest,
    subject: '[VeloHub] Teste de envio Gmail API',
    html:
      `<p>Este é um e-mail de teste enviado pelo Console (configurações &gt; Conexões).</p><p>${new Date().toISOString()}</p>`
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
    second: '2-digit',
  });
}

/**
 * E-mail do canal de denúncias (VeloHub → destinatário configurado).
 * @param {{ to: string, modoComunicacao: string, mensagem: string, reportedBy?: { name: string, email: string } | null }} params
 */
async function sendDenunciaVelohubEmail({ to, modoComunicacao, mensagem, reportedBy }) {
  const modo = modoComunicacao === 'identificado' ? 'identificado' : 'anonimo';
  const subject = 'Velohub - Canal de denúncias';

  const safeMsg = escapeHtmlForEmail(mensagem).replace(/\n/g, '<br/>');
  const when = formatDenunciaDateTime(new Date());

  let html;
  if (modo === 'identificado' && reportedBy) {
    html =
      `<div style="font-family:Arial,sans-serif;font-size:14px;color:#333;line-height:1.5;">` +
      `<p><strong>Nome:</strong> ${escapeHtmlForEmail(reportedBy.name)}</p>` +
      `<p><strong>Email:</strong> ${escapeHtmlForEmail(reportedBy.email)}</p>` +
      `<p><strong>Data/hora do envio:</strong> ${escapeHtmlForEmail(when)}</p>` +
      `<p><strong>Manifestação:</strong></p>` +
      `<p style="white-space:pre-wrap;">${safeMsg}</p>` +
      `</div>`;
  } else {
    html =
      `<div style="font-family:Arial,sans-serif;font-size:14px;color:#333;line-height:1.5;">` +
      `<p><strong>Denúncia Anônima</strong></p>` +
      `<p><strong>Data/hora:</strong> ${escapeHtmlForEmail(when)}</p>` +
      `<p><strong>Manifestação:</strong></p>` +
      `<p style="white-space:pre-wrap;">${safeMsg}</p>` +
      `</div>`;
  }

  await dispatchOutgoingMail({ to: String(to).trim(), subject, html });
}

module.exports = {
  initializeTransporter,
  updateConfig,
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
  testConnection,
  getEffectiveFromAddress,
  getConfig: () => ({ ...emailConfig, from: emailFrom }),
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
