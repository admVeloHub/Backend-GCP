// VERSION: v1.0.0 | DATE: 2025-02-02 | AUTHOR: VeloHub Development Team
/**
 * Serviço de envio de emails usando Nodemailer
 * Templates HTML para notificações de tickets
 */
const nodemailer = require('nodemailer');

// Estado global do serviço
let transporter = null;
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
let consoleUrl = process.env.CONSOLE_URL || 'https://console.velotax.com.br';

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
  return emailEnabled && transporter !== null;
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
    .button { display: inline-block; background-color: #1634FF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 20px; }
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

      <a href="${link}" class="button">Ver Ticket</a>
      
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
 * Template HTML para nova resposta recebida
 */
function getNewReplyTemplate(ticket, ticketId, replyMessage) {
  const assunto = ticket._assunto || ticket._direcionamento || 'Sem assunto';
  const solicitante = ticket._userEmail || 'N/A';
  const mensagem = replyMessage.mensagem || 'N/A';
  const data = new Date(replyMessage.timestamp || Date.now()).toLocaleString('pt-BR');
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
    .message-box { background-color: #f0f0f0; padding: 15px; margin: 10px 0; border-radius: 4px; font-style: italic; }
    .button { display: inline-block; background-color: #1634FF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 20px; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Nova Resposta Recebida</h1>
    </div>
    <div class="content">
      <p>Olá,</p>
      <p>O ticket <strong>#${ticketId}</strong> recebeu uma nova resposta do usuário:</p>
      
      <div class="info-box">
        <strong>ID do Ticket:</strong> ${ticketId}<br>
        <strong>Assunto:</strong> ${assunto}<br>
        <strong>Solicitante:</strong> ${solicitante}
      </div>

      <div class="message-box">
        <strong>Nova Mensagem:</strong><br>
        ${mensagem}<br>
        <small>Enviada em: ${data}</small>
      </div>

      <a href="${link}" class="button">Ver Ticket</a>
      
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
    .button { display: inline-block; background-color: #EF4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 20px; }
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

      <a href="${link}" class="button">Ver Ticket</a>
      
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

    await transporter.sendMail({
      from: emailFrom,
      to: recipientEmail,
      subject: `[Ticket ${ticketId}] Novo ticket atribuído - ${assunto}`,
      html: html
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
    const html = getNewReplyTemplate(ticket, ticketId, replyMessage);

    await transporter.sendMail({
      from: emailFrom,
      to: recipientEmail,
      subject: `[Ticket ${ticketId}] Nova resposta recebida`,
      html: html
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

    await transporter.sendMail({
      from: emailFrom,
      to: recipientEmail,
      subject: `[Ticket ${ticketId}] ⚠️ SLA Vencido`,
      html: html
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

module.exports = {
  initializeTransporter,
  updateConfig,
  setEnabled,
  isReady,
  sendTicketAssignedEmail,
  sendTicketReplyEmail,
  sendSLAExpiredEmail,
  testConnection,
  getConfig: () => ({ ...emailConfig, from: emailFrom }),
  getEnabled: () => emailEnabled
};
