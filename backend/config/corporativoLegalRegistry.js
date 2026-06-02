// VERSION: v1.0.0 | DATE: 2026-06-01 | AUTHOR: VeloHub Development Team
/**
 * Registro extensível de documentos legais (Gestão de Documentos — Console Corporativo)
 */

const {
  getCorpoEticaCondutaCollection,
  getEticaCondutaAckCollection,
  getCorpoLgpdCollection,
  getLgpdAckCollection,
} = require('./hubCorporateDb');

/** @typedef {'politicas-normas' | 'lgpd-publica'} ParserType */

/**
 * @type {Array<{
 *   documentId: string,
 *   titulo: string,
 *   kind: 'lgpd' | 'politicas',
 *   getCorpoCol: (client: import('mongodb').MongoClient) => import('mongodb').Collection,
 *   getAckCol: (client: import('mongodb').MongoClient) => import('mongodb').Collection,
 *   parserType: ParserType,
 *   bodyFields: string[],
 *   ackType?: string,
 * }>}
 */
const LEGAL_DOCUMENT_REGISTRY = [
  {
    documentId: 'lgpd',
    titulo: 'LGPD',
    kind: 'lgpd',
    getCorpoCol: getCorpoLgpdCollection,
    getAckCol: getLgpdAckCollection,
    parserType: 'lgpd-publica',
    bodyFields: ['publica', 'corporativo'],
    ackType: 'lgpd',
  },
  {
    documentId: 'codigo-etica-conduta',
    titulo: 'Código de Ética e Conduta',
    kind: 'politicas',
    getCorpoCol: getCorpoEticaCondutaCollection,
    getAckCol: getEticaCondutaAckCollection,
    parserType: 'politicas-normas',
    bodyFields: ['corpo'],
    ackType: 'etica-conduta',
  },
];

function getDocumentDef(documentId) {
  return LEGAL_DOCUMENT_REGISTRY.find((d) => d.documentId === documentId) || null;
}

function getPoliticasDocuments() {
  return LEGAL_DOCUMENT_REGISTRY.filter((d) => d.kind === 'politicas');
}

module.exports = {
  LEGAL_DOCUMENT_REGISTRY,
  getDocumentDef,
  getPoliticasDocuments,
};
