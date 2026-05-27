// VERSION: v1.0.0 | DATE: 2026-04-27 | AUTHOR: VeloHub Development Team
// CHANGELOG: v1.0.0 - Schema alinhado a FONTE DA VERDADE (LISTA_SCHEMAS.rb) — console_analises.qualidade_ticket_avaliacoes; critérios em PascalCase (não reutilizam booleanos de ligação)
const mongoose = require('mongoose');
const { getAnalisesConnection } = require('../config/analisesConnection');

const qualidadeTicketAvaliacaoSchema = new mongoose.Schema(
  {
    colaboradorNome: { type: String, required: true, trim: true },
    avaliador: { type: String, required: true, trim: true },
    mes: { type: String, required: true, trim: true },
    ano: { type: Number, required: true },
    ProducaoTexto: { type: Boolean, default: false },
    ClarezaObjetividade: { type: Boolean, default: false },
    BoaResolucaoProcedimento: { type: Boolean, default: false },
    AderenciaEstruturaResposta: { type: Boolean, default: false },
    Tabulacao: { type: Boolean, default: false },
    PassouPrazoResposta: { type: Boolean, default: false },
    RepassouProcedimentoIncorreto: { type: Boolean, default: false },
    NaoUtilizouBotApoio: { type: Boolean, default: false },
    observacoes: { type: String, default: '' },
    dataChamado: { type: Date, required: true },
    numeroTicket: { type: Number, required: true },
    pontuacaoTotal: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  }
);

qualidadeTicketAvaliacaoSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

qualidadeTicketAvaliacaoSchema.pre('findOneAndUpdate', function (next) {
  this.set({ updatedAt: new Date() });
  next();
});

qualidadeTicketAvaliacaoSchema.index({ colaboradorNome: 1 });
qualidadeTicketAvaliacaoSchema.index({ mes: 1, ano: 1 });
qualidadeTicketAvaliacaoSchema.index({ dataChamado: -1 });
qualidadeTicketAvaliacaoSchema.index({ createdAt: -1 });
qualidadeTicketAvaliacaoSchema.index({ numeroTicket: 1 });

let QualidadeTicketAvaliacaoModel = null;

const getModel = () => {
  if (!QualidadeTicketAvaliacaoModel) {
    const connection = getAnalisesConnection();
    if (!connection) {
      throw new Error('Conexão MongoDB (analises) não foi criada');
    }
    QualidadeTicketAvaliacaoModel = connection.model(
      'QualidadeTicketAvaliacao',
      qualidadeTicketAvaliacaoSchema,
      'qualidade_ticket_avaliacoes'
    );
  }
  return QualidadeTicketAvaliacaoModel;
};

const QualidadeTicketAvaliacaoConstructor = function (...args) {
  const model = getModel();
  return new model(...args);
};

Object.setPrototypeOf(QualidadeTicketAvaliacaoConstructor.prototype, mongoose.Model.prototype);

module.exports = new Proxy(QualidadeTicketAvaliacaoConstructor, {
  get: (target, prop) => {
    if (prop === Symbol.toStringTag) {
      return 'QualidadeTicketAvaliacao';
    }
    const model = getModel();
    if (prop in model || typeof model[prop] !== 'undefined') {
      const value = model[prop];
      if (typeof value === 'function' && prop !== 'constructor') {
        return value.bind(model);
      }
      return value;
    }
    return target[prop];
  },
  construct: (target, args) => {
    const model = getModel();
    return new model(...args);
  }
});
