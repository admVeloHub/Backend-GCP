// VERSION: v1.21.0 | DATE: 2026-07-22 | AUTHOR: VeloHub Development Team
// CHANGELOG: v1.21.0 - Campo aliasColaborador; ordem dos campos alinhada a LISTA_SCHEMAS funcionarios_cadastroColaboradores
// CHANGELOG: v1.20.1 - Índice atuacao.funcao (consulta DELETE /funcoes e listagens)
// CHANGELOG: v1.20.0 - atuacao [{ funcao: String }] nomes por extenso; aceita legado ObjectId/string na validação
// CHANGELOG: v1.17.0 - Campo departamento (String, acima de atuacao; alinhado a LISTA_SCHEMAS qualidade_funcionarios)
// CHANGELOG: v1.16.0 - Adicionado campo ChavePix ao objeto acessos (credencial Chave Pix); validador e normalizações array/objeto atualizadas
// CHANGELOG: v1.15.0 - Adicionado campo apoioN1 ao objeto acessos (credencial Apoio N1); validador e normalizações array/objeto atualizados
// CHANGELOG: v1.14.0 - Adicionado campo Sociais ao objeto acessos {Velohub: Boolean, Console: Boolean, Academy: Boolean, Desk: Boolean, Ouvidoria: Boolean, Sociais: Boolean, realTime: Boolean}
// CHANGELOG: v1.13.0 - Adicionado campo realTime ao objeto acessos {Velohub: Boolean, Console: Boolean, Academy: Boolean, Desk: Boolean, Ouvidoria: Boolean, realTime: Boolean}
// CHANGELOG: v1.12.0 - Adicionado campo Ouvidoria ao objeto acessos {Velohub: Boolean, Console: Boolean, Academy: Boolean, Desk: Boolean, Ouvidoria: Boolean}
// CHANGELOG: v1.11.0 - Adicionado campo Desk ao objeto acessos {Velohub: Boolean, Console: Boolean, Academy: Boolean, Desk: Boolean}
const mongoose = require('mongoose');
const { normalizarAcessosPlataforma } = require('../utils/modulosVelohub');
// ✅ USAR CONEXÃO COMPARTILHADA para garantir que populate funcione corretamente
const { getFuncionariosConnection } = require('../config/funcionariosConnection');
const { FUNCIONARIOS_COLLECTIONS } = require('../config/funcionariosCollections');

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

const atuacaoItemSchema = new mongoose.Schema(
  {
    funcao: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

// Schema principal — console_funcionarios.funcionarios_cadastroColaboradores (LISTA_SCHEMAS)
const qualidadeFuncionarioSchema = new mongoose.Schema({
  colaboradorNome: {
    type: String,
    required: true,
    trim: true
  },
  aliasColaborador: {
    type: String,
    default: null,
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
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Email inválido'
    }
  },
  telefone: {
    type: String,
    default: '',
    trim: true
  },
  CPF: {
    type: String,
    default: null,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Opcional
        return /^\d{11}$/.test(v);
      },
      message: 'CPF deve conter exatamente 11 dígitos numéricos'
    }
  },
  atuacao: {
    type: [atuacaoItemSchema],
    default: [],
    validate: {
      validator: function(v) {
        if (typeof v === 'string') return String(v).trim().length > 0;
        if (!Array.isArray(v)) return false;
        return v.every((item) => {
          if (item == null) return false;
          if (typeof item === 'string') return item.trim().length > 0;
          if (typeof item === 'object' && item.funcao != null) {
            return String(item.funcao).trim().length > 0;
          }
          return mongoose.Types.ObjectId.isValid(item);
        });
      },
      message: 'Atuação deve ser array de objetos { funcao: "nome por extenso" }',
    },
  },
  // Formato antigo: Array [{sistema, perfil, ...}]; formato novo: objeto booleano de plataformas
  acessos: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
    validate: {
      validator: function(v) {
        if (!v) return true; // Opcional

        if (typeof v === 'object' && !Array.isArray(v)) {
          const keys = Object.keys(v);
          const validKeys = ['Velohub', 'Console', 'Academy', 'Desk', 'realTime', 'Ouvidoria', 'Sociais', 'apoioN1', 'ChavePix'];
          return keys.every(key => validKeys.includes(key) && typeof v[key] === 'boolean');
        }

        if (Array.isArray(v)) {
          return v.every(item =>
            typeof item === 'object' &&
            item.sistema &&
            item.perfil
          );
        }

        return false;
      },
      message: 'Acessos deve ser um objeto de plataformas (booleanos) ou array legado [{sistema, perfil, ...}]'
    }
  },
  afastado: {
    type: Boolean,
    default: false
  },
  dataAfastamento: {
    type: Date,
    default: null
  },
  dataAniversario: {
    type: Date,
    default: null
  },
  dataContratado: {
    type: Date,
    required: true
  },
  dataDesligamento: {
    type: Date,
    default: null
  },
  departamento: {
    type: String,
    default: '',
    trim: true
  },
  desligado: {
    type: Boolean,
    default: false
  },
  empresa: {
    type: String,
    required: true,
    trim: true
  },
  escala: {
    type: String,
    default: '',
    trim: true
  },
  password: {
    type: String,
    default: null
  },
  profile_pic: {
    type: String,
    default: null,
    trim: true
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
  if (this.acessos && typeof this.acessos === 'object' && !Array.isArray(this.acessos)) {
    this.acessos = normalizarAcessosPlataforma(this.acessos);
  }
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
      if (acesso.sistema === 'Ouvidoria' || acesso.sistema === 'ouvidoria') {
        novoAcessos.Ouvidoria = true;
      }
      if (acesso.sistema === 'Sociais' || acesso.sistema === 'sociais') {
        novoAcessos.Sociais = true;
      }
      if (acesso.sistema === 'realTime' || acesso.sistema === 'tempo-real' || acesso.sistema === 'tempo_real') {
        novoAcessos.realTime = true;
      }
      const sisSlug = String(acesso.sistema || '').toLowerCase().replace(/[\s_-]/g, '');
      if (acesso.sistema === 'apoioN1' || sisSlug === 'apoion1') {
        novoAcessos.apoioN1 = true;
      }
      if (acesso.sistema === 'ChavePix' || sisSlug === 'chavepix') {
        novoAcessos.ChavePix = true;
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
      if (acesso.sistema === 'Ouvidoria' || acesso.sistema === 'ouvidoria') {
        novoAcessos.Ouvidoria = true;
      }
      if (acesso.sistema === 'Sociais' || acesso.sistema === 'sociais') {
        novoAcessos.Sociais = true;
      }
      if (acesso.sistema === 'realTime' || acesso.sistema === 'tempo-real' || acesso.sistema === 'tempo_real') {
        novoAcessos.realTime = true;
      }
      const sisSlug = String(acesso.sistema || '').toLowerCase().replace(/[\s_-]/g, '');
      if (acesso.sistema === 'apoioN1' || sisSlug === 'apoion1') {
        novoAcessos.apoioN1 = true;
      }
      if (acesso.sistema === 'ChavePix' || sisSlug === 'chavepix') {
        novoAcessos.ChavePix = true;
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
qualidadeFuncionarioSchema.index({ 'atuacao.funcao': 1 });

// Modelo - criado com lazy loading
let QualidadeFuncionarioModel = null;

const getModel = () => {
  if (!QualidadeFuncionarioModel) {
    try {
      const connection = getFuncionariosConnection();
      
      // Validar que conexão existe e está válida
      if (!connection) {
        throw new Error('Conexão MongoDB não foi criada');
      }
      
      QualidadeFuncionarioModel = connection.model(
        'QualidadeFuncionario',
        qualidadeFuncionarioSchema,
        FUNCIONARIOS_COLLECTIONS.CADASTRO
      );

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
