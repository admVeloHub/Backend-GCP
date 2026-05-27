// VERSION: v1.0.0 | DATE: 2026-04-27 | AUTHOR: VeloHub Development Team
// FONTE: console_analises.qa_feedback — LISTA_SCHEMAS.rb
const mongoose = require('mongoose');
const { getAnalisesConnection } = require('../config/analisesConnection');

const qaFeedbackSchema = new mongoose.Schema(
  {
    colaboradorNome: { type: String, required: true, trim: true },
    avaliador: { type: String, required: true, trim: true },
    mes: { type: String, required: true, trim: true },
    ano: { type: Number, required: true },
    feedbackType: { type: String, required: true, trim: true },
    feedbackBody: { type: String, default: '' },
    feedbackRecomendacoes: { type: String, default: '' }
  },
  { timestamps: true, collection: 'qa_feedback' }
);

qaFeedbackSchema.index({ colaboradorNome: 1, updatedAt: -1 });

let QaFeedbackModel = null;

const getModel = () => {
  if (!QaFeedbackModel) {
    const connection = getAnalisesConnection();
    if (!connection) {
      throw new Error('Conexão MongoDB (console_analises) indisponível');
    }
    QaFeedbackModel = connection.model('QaFeedback', qaFeedbackSchema, 'qa_feedback');
  }
  return QaFeedbackModel;
};

const QaFeedbackConstructor = function QaFeedbackConstructorWrapper(...args) {
  return new (getModel())(...args);
};
Object.setPrototypeOf(QaFeedbackConstructor.prototype, mongoose.Model.prototype);

module.exports = new Proxy(QaFeedbackConstructor, {
  get: (target, prop) => {
    if (prop === Symbol.toStringTag) {
      return 'QaFeedback';
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
