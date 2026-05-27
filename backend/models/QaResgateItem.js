// VERSION: v1.0.0 | DATE: 2026-04-30 | AUTHOR: VeloHub Development Team
// Coleção console_analises.qa_resgate_items — FONTE LISTA_SCHEMAS.rb
const mongoose = require('mongoose');
const { getAnalisesConnection } = require('../config/analisesConnection');

const qaResgateItemSchema = new mongoose.Schema(
  {
    item: {
      type: String,
      required: true,
      trim: true
    },
    xpPrice: {
      type: Number,
      required: true,
      min: 0
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { versionKey: false, collection: 'qa_resgate_items' }
);

qaResgateItemSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

qaResgateItemSchema.pre(['updateOne', 'findOneAndUpdate'], function (next) {
  this.set({ updatedAt: new Date() });
  next();
});

let QaResgateItemModel = null;

const getModel = () => {
  if (!QaResgateItemModel) {
    const connection = getAnalisesConnection();
    if (!connection) {
      throw new Error('Conexão MongoDB não foi criada');
    }
    QaResgateItemModel = connection.model('QaResgateItem', qaResgateItemSchema, 'qa_resgate_items');
  }
  return QaResgateItemModel;
};

const QaResgateItemConstructor = function (...args) {
  const model = getModel();
  return new model(...args);
};

Object.setPrototypeOf(QaResgateItemConstructor.prototype, mongoose.Model.prototype);

module.exports = new Proxy(QaResgateItemConstructor, {
  get: (target, prop) => {
    if (prop === Symbol.toStringTag) {
      return 'QaResgateItem';
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
