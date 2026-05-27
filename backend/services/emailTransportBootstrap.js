// VERSION: v1.0.1 | DATE: 2026-04-29 | AUTHOR: VeloHub Development Teamconst EmailTransportConfig = require('../models/EmailTransportConfig');
const emailService = require('./emailService');

/**
 * Carrega configuração de e-mail do MongoDB (singleton) ao subir o processo ou após salvar pela API.
 */
async function bootstrapEmailTransportFromMongo() {
  try {
    const doc = await EmailTransportConfig.findSingletonLean();
    emailService.applyMongoTransport(doc);
    if (doc) {
      global.emitLog?.(
        'info',
        `[email bootstrap] coleção="${EmailTransportConfig.COLLECTION_NAME}" transportMode=${doc.transportMode || '—'} gmail=${doc.serviceAccountJson?.client_email ? 'SIM' : 'NÃO'}`
      );
    } else {
      global.emitLog?.('info', `[email bootstrap] nenhum documento em ${EmailTransportConfig.COLLECTION_NAME}`);
    }
  } catch (e) {
    global.emitLog?.('warning', `[email bootstrap] ${e.message}`);
  }
}

module.exports = {
  bootstrapEmailTransportFromMongo
};
