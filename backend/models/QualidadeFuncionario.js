// VERSION: v1.11.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
// CHANGELOG: v1.11.0 - Adicionado campo Desk ao objeto acessos {Velohub: Boolean, Console: Boolean, Academy: Boolean, Desk: Boolean}
const mongoose = require('mongoose');
// ✅ USAR CONEXÃO COMPARTILHADA para garantir que populate funcione corretamente
const { getAnalisesConnection } = require('../config/analisesConnection');

// Schema para acessos dos funcionários (FORMATO ANTIGO - mantido para compatibilidade)
const acessoSchema = new mongoose.Schema({
  sistema: {
    type: String,
    required: true
  },
  perfil: {
    type: String,
    required: true
  },
  observacoes: {
    type: String,
    default: ''
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Schema principal para qualidade_funcionarios
const qualidadeFuncionarioSchema = new mongoose.Schema({
  colaboradorNome: {
    type: String,
    required: true,
    trim: true
  },
  dataAniversario: {
    type: Date,
    default: null
  },
  CPF: {
    type: String,
    default: null,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Opcional
        // CPF deve ter 11 dígitos, sem pontos ou traços
        return /^\d{11}$/.test(v);
      },
      message: 'CPF deve conter exatamente 11 dígitos numéricos'
    }
  },
  profile_pic: {
    type: String,
    default: null,
    trim: true
  },
  empresa: {
    type: String,
    required: true,
    trim: true
  },
  dataContratado: {
    type: Date,
    required: true
  },
  telefone: {
    type: String,
    default: '',
    trim: true
  },
  userMail: {
    type: String,
    default: null,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Opcional
        // Validação básica de email
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Email inválido'
    }
  },
  password: {
    type: String,
    default: null
  },
  atuacao: {
    type: mongoose.Schema.Types.Mixed, // Suporta String (antigo) e Array de ObjectIds (novo)
    default: '',
    validate: {
      validator: function(v) {
        // Aceita string vazia, string não vazia, ou array de ObjectIds
        if (typeof v === 'string') return true;
        if (Array.isArray(v)) {
          return v.every(id => mongoose.Types.ObjectId.isValid(id));
        }
        return false;
      },
      message: 'Atuação deve ser uma string ou array de ObjectIds válidos'
    }
  },
  escala: {
    type: String,
    default: '',
    trim: true
  },
  // Campo acessos suporta ambos os formatos durante transição
  // Formato antigo: Array de objetos [{sistema, perfil, observacoes, updatedAt}]
  // Formato novo: Objeto booleano {Velohub: Boolean, Console: Boolean, Academy: Boolean, Desk: Boolean}
  acessos: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
    validate: {
      validator: function(v) {
        if (!v) return true; // Opcional
        
        // Formato novo: objeto com Velohub, Console, Academy e/ou Desk (booleanos)
        if (typeof v === 'object' && !Array.isArray(v)) {
          const keys = Object.keys(v);
          const validKeys = ['Velohub', 'Console', 'Academy', 'Desk'];
          return keys.every(key => validKeys.includes(key) && typeof v[key] === 'boolean');
        }
        
        // Formato antigo: array de objetos
        if (Array.isArray(v)) {
          return v.every(item => 
            typeof item === 'object' && 
            item.sistema && 
            item.perfil
          );
        }
        
        return false;
      },
      message: 'Acessos deve ser um objeto {Velohub: Boolean, Console: Boolean, Academy: Boolean, Desk: Boolean} ou array de objetos [{sistema, perfil, ...}]'
    }
  },
  desligado: {
    type: Boolean,
    default: false
  },
  dataDesligamento: {
    type: Date,
    default: null
  },
  afastado: {
    type: Boolean,
    default: false
  },
  dataAfastamento: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware para atualizar updatedAt antes de salvar
qualidadeFuncionarioSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Middleware para atualizar updatedAt antes de atualizar
qualidadeFuncionarioSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

// Função helper para normalizar formato de acessos (compatibilidade durante transição)
qualidadeFuncionarioSchema.methods.normalizeAcessos = function() {
  if (!this.acessos) {
    return null;
  }
  
  // Se já está no formato novo (objeto booleano), retornar como está
  if (typeof this.acessos === 'object' && !Array.isArray(this.acessos)) {
    return this.acessos;
  }
  
  // Se está no formato antigo (array), converter para objeto booleano
  if (Array.isArray(this.acessos)) {
    const novoAcessos = {};
    this.acessos.forEach(acesso => {
      if (acesso.sistema === 'Velohub' || acesso.sistema === 'velohub') {
        novoAcessos.Velohub = true;
      }
      if (acesso.sistema === 'Console' || acesso.sistema === 'console') {
        novoAcessos.Console = true;
      }
      if (acesso.sistema === 'Academy' || acesso.sistema === 'academy') {
        novoAcessos.Academy = true;
      }
      if (acesso.sistema === 'Desk' || acesso.sistema === 'desk') {
        novoAcessos.Desk = true;
      }
    });
    // Retornar objeto vazio se não houver correspondências, ou null se array vazio
    return Object.keys(novoAcessos).length > 0 ? novoAcessos : null;
  }
  
  return null;
};

// Método estático para normalizar acessos em documentos
qualidadeFuncionarioSchema.statics.normalizeAcessosFormat = function(acessos) {
  if (!acessos) {
    return null;
  }
  
  // Se já está no formato novo (objeto booleano), retornar como está
  if (typeof acessos === 'object' && !Array.isArray(acessos)) {
    return acessos;
  }
  
  // Se está no formato antigo (array), converter para objeto booleano
  if (Array.isArray(acessos)) {
    const novoAcessos = {};
    acessos.forEach(acesso => {
      if (acesso.sistema === 'Velohub' || acesso.sistema === 'velohub') {
        novoAcessos.Velohub = true;
      }
      if (acesso.sistema === 'Console' || acesso.sistema === 'console') {
        novoAcessos.Console = true;
      }
      if (acesso.sistema === 'Academy' || acesso.sistema === 'academy') {
        novoAcessos.Academy = true;
      }
      if (acesso.sistema === 'Desk' || acesso.sistema === 'desk') {
        novoAcessos.Desk = true;
      }
    });
    // Retornar objeto vazio se não houver correspondências, ou null se array vazio
    return Object.keys(novoAcessos).length > 0 ? novoAcessos : null;
  }
  
  return null;
};

// Índices para otimização de consultas
qualidadeFuncionarioSchema.index({ colaboradorNome: 1 });
qualidadeFuncionarioSchema.index({ empresa: 1 });
qualidadeFuncionarioSchema.index({ desligado: 1, afastado: 1 });
qualidadeFuncionarioSchema.index({ createdAt: -1 });
qualidadeFuncionarioSchema.index({ CPF: 1 }, { unique: true, sparse: true }); // Índice único esparso (apenas para CPFs definidos)
qualidadeFuncionarioSchema.index({ userMail: 1 }, { unique: true, sparse: true }); // Índice único esparso (apenas para emails definidos)

// Modelo - criado com lazy loading
let QualidadeFuncionarioModel = null;

const getModel = () => {
  if (!QualidadeFuncionarioModel) {
    try {
      const connection = getAnalisesConnection();
      
      // Validar que conexão existe e está válida
      if (!connection) {
        throw new Error('Conexão MongoDB não foi criada');
      }
      
      QualidadeFuncionarioModel = connection.model('QualidadeFuncionario', qualidadeFuncionarioSchema, 'qualidade_funcionarios');

      // Método estático para obter funcionários ativos (não desligados e não afastados)
      QualidadeFuncionarioModel.getActiveFuncionarios = async function() {
        try {
          const funcionarios = await this.find({
            desligado: { $ne: true },
            afastado: { $ne: true }
          }).select('colaboradorNome').lean();
          
          return {
            success: true,
            data: funcionarios,
            count: funcionarios.length
          };
        } catch (error) {
          console.error('Erro ao obter funcionários ativos:', error);
          return {
            success: false,
            error: 'Erro interno do servidor'
          };
        }
      };
    } catch (error) {
      console.error('❌ Erro ao inicializar modelo QualidadeFuncionario:', error);
      throw error;
    }
  }
  return QualidadeFuncionarioModel;
};

// Criar função construtora que delega para o modelo real
const QualidadeFuncionarioConstructor = function(...args) {
  const model = getModel();
  if (!model) {
    throw new Error('Modelo QualidadeFuncionario não foi inicializado');
  }
  return new model(...args);
};

// Copiar propriedades estáticas do modelo para o construtor
Object.setPrototypeOf(QualidadeFuncionarioConstructor.prototype, mongoose.Model.prototype);

module.exports = new Proxy(QualidadeFuncionarioConstructor, {
  get: (target, prop) => {
    // Propriedades especiais do Proxy
    if (prop === Symbol.toStringTag) {
      return 'QualidadeFuncionario';
    }
    
    const model = getModel();
    if (!model) {
      throw new Error('Modelo QualidadeFuncionario não foi inicializado');
    }
    
    // Se a propriedade existe no modelo, retornar do modelo
    if (prop in model || typeof model[prop] !== 'undefined') {
      const value = model[prop];
      // Bind métodos para manter contexto correto
      if (typeof value === 'function' && prop !== 'constructor') {
        return value.bind(model);
      }
      return value;
    }
    
    // Caso contrário, retornar do target (função construtora)
    return target[prop];
  },
  construct: (target, args) => {
    const model = getModel();
    return new model(...args);
  }
});
