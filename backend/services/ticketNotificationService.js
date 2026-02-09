// VERSION: v1.0.0 | DATE: 2025-02-02 | AUTHOR: VeloHub Development Team
/**
 * Serviço para buscar usuários responsáveis por categorias de tickets
 */
const Users = require('../models/Users');

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

    // Buscar usuários com _userTickets[ticketType] === true
    const users = await Users.find({
      [`_userTickets.${ticketType}`]: true
    }).select('_userMail').lean();

    // Extrair emails válidos
    const emails = users
      .map(user => user._userMail)
      .filter(email => email && typeof email === 'string' && email.includes('@'));

    return emails;
  } catch (error) {
    console.error('Erro ao buscar usuários responsáveis:', error);
    global.emitLog('error', `ticketNotificationService.getResponsibleUsersForTicketType - Erro: ${error.message}`);
    return [];
  }
}

/**
 * Busca email de um usuário específico por ID ou email
 * @param {string} userIdentifier - Email ou ID do usuário
 * @returns {Promise<string|null>} - Email do usuário ou null se não encontrado
 */
async function getUserEmail(userIdentifier) {
  try {
    if (!userIdentifier) {
      return null;
    }

    // Tentar buscar por email primeiro
    let user = await Users.findOne({ _userMail: userIdentifier.toLowerCase() }).select('_userMail').lean();
    
    // Se não encontrou, tentar por ID
    if (!user) {
      user = await Users.findOne({ _userId: userIdentifier }).select('_userMail').lean();
    }

    return user?._userMail || null;
  } catch (error) {
    console.error('Erro ao buscar email do usuário:', error);
    global.emitLog('error', `ticketNotificationService.getUserEmail - Erro: ${error.message}`);
    return null;
  }
}

module.exports = {
  getResponsibleUsersForTicketType,
  getUserEmail
};
