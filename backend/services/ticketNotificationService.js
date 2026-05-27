// VERSION: v1.1.3 | DATE: 2026-05-08 | AUTHOR: VeloHub Development Team
// CHANGELOG: v1.1.3 - getUserEmail: valor com @ sem cadastro devolve o e-mail normalizado; _userId com correspondência case-insensitive (único documento)
// CHANGELOG: v1.1.2 - Removido console.log duplicado; só emitLog (monitor SSE)
// CHANGELOG: v1.1.0 - getResponsibleUsersForTicketType: leitura nativa console_config.users (getConfigConnection)
/**
 * Serviço para buscar usuários responsáveis por categorias de tickets
 * (delegação Config do Console: _userTickets + _userMail em console_config.users)
 */
const Users = require('../models/Users');
const { getConfigConnection } = require('../config/configConnection');

async function ensureConfigDbReady() {
  const conn = getConfigConnection();
  if (conn.readyState === 1) {
    return;
  }
  await conn.asPromise();
}

/**
 * Busca usuários responsáveis por um tipo específico de ticket
 * @param {string} ticketType - Tipo do ticket (ex: 'artigos', 'processos', 'gestao')
 * @returns {Promise<Array<string>>} - Array de emails dos usuários responsáveis
 */
async function getResponsibleUsersForTicketType(ticketType) {
  try {
    if (!ticketType) {
      return [];
    }

    await ensureConfigDbReady();
    const conn = getConfigConnection();
    const db = conn.db;
    if (!db) {
      if (typeof global.emitLog === 'function') {
        global.emitLog(
          'error',
          'ticketNotificationService.getResponsibleUsersForTicketType - conn.db indisponível (console_config)'
        );
      }
      return [];
    }

    const filter = { [`_userTickets.${ticketType}`]: true };
    const docs = await db
      .collection('users')
      .find(filter)
      .project({ _userMail: 1, _id: 0 })
      .toArray();

    const seen = new Set();
    const emails = [];
    for (const u of docs) {
      const raw = u && typeof u._userMail === 'string' ? u._userMail.trim().toLowerCase() : '';
      if (raw.includes('@') && !seen.has(raw)) {
        seen.add(raw);
        emails.push(raw);
      }
    }

    const msg = `ticketNotificationService.getResponsibleUsersForTicketType(${ticketType}): ${emails.length} destinatário(s) em console_config.users`;
    if (typeof global.emitLog === 'function') {
      global.emitLog('info', msg);
    }

    return emails;
  } catch (error) {
    console.error('Erro ao buscar usuários responsáveis:', error);
    if (typeof global.emitLog === 'function') {
      global.emitLog(
        'error',
        `ticketNotificationService.getResponsibleUsersForTicketType - Erro: ${error.message}`
      );
    }
    return [];
  }
}

function escapeRegexForMongoIdentifier(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Busca email de um usuário específico por ID ou email
 * @param {string} userIdentifier - Email, _userId ou _userMail do cadastro console_config.users
 * @returns {Promise<string|null>} - Email do usuário ou null se não encontrado
 */
async function getUserEmail(userIdentifier) {
  try {
    if (!userIdentifier) {
      return null;
    }

    const raw = String(userIdentifier).trim();
    if (!raw) {
      return null;
    }

    // E-mail explícito: resolve pelo cadastro; se não existir usuário, ainda retorna o endereço (Atribuição pode guardar e-mail)
    if (raw.includes('@')) {
      const lower = raw.toLowerCase();
      const byMail = await Users.findOne({ _userMail: lower }).select('_userMail').lean();
      if (byMail?._userMail) {
        return byMail._userMail;
      }
      return lower;
    }

    let user = await Users.findOne({ _userMail: raw.toLowerCase() }).select('_userMail').lean();

    if (!user) {
      user = await Users.findOne({ _userId: raw }).select('_userMail').lean();
    }

    if (!user) {
      user = await Users.findOne({
        _userId: { $regex: new RegExp(`^${escapeRegexForMongoIdentifier(raw)}$`, 'i') }
      })
        .select('_userMail')
        .lean();
    }

    return user?._userMail || null;
  } catch (error) {
    console.error('Erro ao buscar email do usuário:', error);
    if (typeof global.emitLog === 'function') {
      global.emitLog('error', `ticketNotificationService.getUserEmail - Erro: ${error.message}`);
    }
    return null;
  }
}

module.exports = {
  getResponsibleUsersForTicketType,
  getUserEmail
};
