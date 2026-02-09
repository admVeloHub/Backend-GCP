// VERSION: v1.0.0 | DATE: 2025-02-02 | AUTHOR: VeloHub Development Team
/**
 * Utilitários para manipulação de tickets
 * - Mapeamento de gênero para ticketType
 * - Verificação de SLA vencido
 */

/**
 * Mapeia o gênero do ticket para o tipo usado em _userTickets
 * @param {string} genero - Gênero do ticket (ex: 'artigo', 'processo', 'gestão')
 * @param {string} collectionType - Tipo de coleção ('tk_conteudos' ou 'tk_gestao')
 * @returns {string|null} - Tipo do ticket para _userTickets ou null se não mapeado
 */
function mapGeneroToTicketType(genero, collectionType = 'tk_conteudos') {
  if (!genero || typeof genero !== 'string') {
    return null;
  }

  const generoLower = genero.toLowerCase().trim();

  if (collectionType === 'tk_conteudos') {
    // Mapeamento para tk_conteudos
    const mapping = {
      'artigo': 'artigos',
      'processo': 'processos',
      'velobot': 'processos',
      'roteiro': 'roteiros',
      'treinamento': 'treinamentos',
      'funcionalidade': 'funcionalidades',
      'recurso adicional': 'recursos',
      'recurso': 'recursos'
    };

    return mapping[generoLower] || null;
  } else if (collectionType === 'tk_gestao') {
    // Mapeamento para tk_gestao
    const mapping = {
      'gestão': 'gestao',
      'gestao': 'gestao',
      'rh e financeiro': 'rhFin',
      'rh & financeiro': 'rhFin',
      'facilities': 'facilities'
    };

    return mapping[generoLower] || null;
  }

  return null;
}

/**
 * Verifica se o SLA do ticket está vencido (48 horas a partir de createdAt)
 * @param {Date|string} createdAt - Data de criação do ticket
 * @returns {boolean} - true se SLA vencido, false caso contrário
 */
function isSLAExpired(createdAt) {
  if (!createdAt) {
    return false;
  }

  const createdDate = createdAt instanceof Date ? createdAt : new Date(createdAt);
  
  if (isNaN(createdDate.getTime())) {
    return false; // Data inválida
  }

  // SLA é de 48 horas
  const slaDeadline = new Date(createdDate.getTime() + 48 * 60 * 60 * 1000);
  const now = new Date();

  return now > slaDeadline;
}

/**
 * Identifica o tipo do ticket baseado na coleção e gênero
 * @param {Object} ticket - Objeto do ticket
 * @param {string} collectionType - Tipo de coleção ('tk_conteudos' ou 'tk_gestao')
 * @returns {string|null} - Tipo do ticket para _userTickets
 */
function getTicketTypeFromTicket(ticket, collectionType) {
  if (!ticket || !ticket._genero) {
    return null;
  }

  return mapGeneroToTicketType(ticket._genero, collectionType);
}

module.exports = {
  mapGeneroToTicketType,
  isSLAExpired,
  getTicketTypeFromTicket
};
