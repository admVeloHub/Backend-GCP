// VERSION: v5.8.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
// CHANGELOG: 
// v5.8.0 - Implementada sincronização automática entre qualidade_funcionarios.acessos.Console e console_config.users. Quando Console=true, cria usuário no config. Quando Console=false, remove usuário do config.
// v5.7.0 - Adicionados novos campos ao schema qualidade_funcionarios: CPF, profile_pic, userMail, password. Campo acessos alterado de array para objeto booleano {Velohub: Boolean, Console: Boolean} sem valores padrão true.
// v5.6.0 - Deprecados endpoints POST/PUT/DELETE de qualidade_avaliacoes_gpt. Retornam erro 410 com mensagem de migração para audio_analise_results.
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const QualidadeFuncionario = require('../models/QualidadeFuncionario');
const QualidadeAvaliacao = require('../models/QualidadeAvaliacao');
const QualidadeAvaliacaoGPT = require('../models/QualidadeAvaliacaoGPT');
const QualidadeAtuacoes = require('../models/QualidadeAtuacoes');
const QualidadeFuncoes = require('../models/QualidadeFuncoes');
const Users = require('../models/Users');

// Função helper para gerar _userId a partir de primeiro e último nome
const gerarUserId = (colaboradorNome) => {
  if (!colaboradorNome || typeof colaboradorNome !== 'string') {
    return null;
  }
  const nomeParts = colaboradorNome.trim().split(' ').filter(n => n.length > 0);
  if (nomeParts.length === 0) {
    return null;
  }
  const primeiroNome = nomeParts[0];
  const ultimoNome = nomeParts.length > 1 ? nomeParts[nomeParts.length - 1] : primeiroNome;
  return `${primeiroNome} ${ultimoNome}`;
};

// Função helper para sincronizar usuário no config
// Retorna { success: boolean, message: string, action: 'created' | 'deleted' | 'skipped' | 'error' }
const syncUserToConfig = async (funcionario, consoleAcesso) => {
  try {
    // Se Console = false, deletar usuário do config se existir
    if (consoleAcesso === false || !consoleAcesso) {
      if (!funcionario.userMail) {
        return { success: true, message: 'Sem email, não há usuário para deletar', action: 'skipped' };
      }
      
      const deletedUser = await Users.findOneAndDelete({ _userMail: funcionario.userMail });
      if (deletedUser) {
        console.log(`✅ [SYNC] Usuário deletado do config: ${funcionario.userMail}`);
        return { success: true, message: 'Usuário deletado do config', action: 'deleted' };
      }
      return { success: true, message: 'Usuário não encontrado no config', action: 'skipped' };
    }
    
    // Se Console = true, criar ou verificar existência no config
    if (consoleAcesso === true) {
      if (!funcionario.userMail) {
        console.warn(`⚠️ [SYNC] Funcionário ${funcionario.colaboradorNome} tem Console=true mas não tem userMail`);
        return { success: false, message: 'userMail não definido', action: 'error' };
      }
      
      const userId = gerarUserId(funcionario.colaboradorNome);
      if (!userId) {
        console.warn(`⚠️ [SYNC] Não foi possível gerar userId para ${funcionario.colaboradorNome}`);
        return { success: false, message: 'Não foi possível gerar userId', action: 'error' };
      }
      
      // Verificar se usuário já existe
      const existingUser = await Users.findOne({ _userMail: funcionario.userMail });
      if (existingUser) {
        console.log(`✅ [SYNC] Usuário já existe no config: ${funcionario.userMail}`);
        return { success: true, message: 'Usuário já existe no config', action: 'skipped' };
      }
      
      // Criar novo usuário no config
      const newUser = new Users({
        _userMail: funcionario.userMail,
        _userId: userId,
        _userRole: 'Editor',
        _userClearance: {
          artigos: false,
          velonews: false,
          botPerguntas: false,
          botAnalises: false,
          hubAnalises: false,
          chamadosInternos: false,
          igp: false,
          qualidade: false,
          capacity: false,
          config: false,
          servicos: false,
          academy: false,
          whatsapp: false
        },
        _userTickets: {
          artigos: false,
          processos: false,
          roteiros: false,
          treinamentos: false,
          funcionalidades: false,
          recursos: false,
          gestao: false,
          rhFin: false,
          facilities: false
        },
        _funcoesAdministrativas: {
          avaliador: false,
          auditoria: false,
          relatoriosGestao: false
        }
      });
      
      const savedUser = await newUser.save();
      console.log(`✅ [SYNC] Usuário criado no config: ${funcionario.userMail} (userId: ${userId})`);
      return { success: true, message: 'Usuário criado no config', action: 'created', data: savedUser };
    }
    
    return { success: true, message: 'Nenhuma ação necessária', action: 'skipped' };
  } catch (error) {
    console.error(`❌ [SYNC] Erro ao sincronizar usuário ${funcionario.userMail || funcionario.colaboradorNome}:`, error.message);
    return { success: false, message: error.message, action: 'error', error: error };
  }
};

// Função para calcular pontuação com novos critérios
const calcularPontuacao = (avaliacaoData) => {
  let pontuacaoTotal = 0;
  
  // Critérios positivos
  if (avaliacaoData.saudacaoAdequada) pontuacaoTotal += 10;
  if (avaliacaoData.escutaAtiva) pontuacaoTotal += 15; // Reduzido de 25 para 15
  if (avaliacaoData.clarezaObjetividade) pontuacaoTotal += 10; // NOVO
  if (avaliacaoData.resolucaoQuestao) pontuacaoTotal += 25; // Reduzido de 40 para 25
  if (avaliacaoData.dominioAssunto) pontuacaoTotal += 15; // NOVO
  if (avaliacaoData.empatiaCordialidade) pontuacaoTotal += 15;
  if (avaliacaoData.direcionouPesquisa) pontuacaoTotal += 10;
  
  // Critérios negativos
  if (avaliacaoData.procedimentoIncorreto) pontuacaoTotal -= 60;
  if (avaliacaoData.encerramentoBrusco) pontuacaoTotal -= 100;
  
  // Garantir que a pontuação não seja negativa
  pontuacaoTotal = Math.max(0, pontuacaoTotal);
  
  return pontuacaoTotal;
};

// Função para calcular pontuação GPT com novos critérios (para compatibilidade)
const calcularPontuacaoGPT = (criteriosGPT) => {
  let pontuacaoTotal = 0;
  
  // Critérios positivos
  if (criteriosGPT.saudacaoAdequada) pontuacaoTotal += 10;
  if (criteriosGPT.escutaAtiva) pontuacaoTotal += 15; // Reduzido de 25 para 15
  if (criteriosGPT.clarezaObjetividade) pontuacaoTotal += 10; // NOVO
  if (criteriosGPT.resolucaoQuestao) pontuacaoTotal += 25; // Reduzido de 40 para 25
  if (criteriosGPT.dominioAssunto) pontuacaoTotal += 15; // NOVO
  if (criteriosGPT.empatiaCordialidade) pontuacaoTotal += 15;
  if (criteriosGPT.direcionouPesquisa) pontuacaoTotal += 10;
  
  // Critérios negativos
  if (criteriosGPT.procedimentoIncorreto) pontuacaoTotal -= 60;
  if (criteriosGPT.encerramentoBrusco) pontuacaoTotal -= 100;
  
  // Garantir que a pontuação não seja negativa
  pontuacaoTotal = Math.max(0, pontuacaoTotal);
  
  return pontuacaoTotal;
};

/*
 * PROMPT ATUALIZADO PARA ANÁLISE GPT DE QUALIDADE:
 * 
 * Analise a ligação considerando os seguintes critérios de avaliação:
 * 
 * CRITÉRIOS POSITIVOS:
 * 1. Saudação Adequada - O colaborador cumprimentou adequadamente o cliente? (+10 pontos)
 * 2. Escuta Ativa / Sondagem - O colaborador demonstrou escuta ativa e fez perguntas relevantes? (+15 pontos)
 * 3. Clareza e Objetividade - O colaborador foi claro e objetivo na comunicação? (+10 pontos) [NOVO]
 * 4. Resolução Questão / Seguiu o procedimento - A questão foi resolvida seguindo os procedimentos corretos? (+25 pontos)
 * 5. Domínio no assunto abordado - O colaborador demonstrou conhecimento sobre o assunto? (+15 pontos) [NOVO]
 * 6. Empatia / Cordialidade - O colaborador demonstrou empatia e cordialidade? (+15 pontos)
 * 7. Direcionou para pesquisa de satisfação - O colaborador direcionou o cliente para pesquisa de satisfação? (+10 pontos)
 * 
 * CRITÉRIOS NEGATIVOS:
 * 8. Colaborador repassou um procedimento incorreto - Houve repasse de informação incorreta? (-60 pontos)
 * 9. Colaborador encerrou o contato de forma brusca - O contato foi encerrado abruptamente? (-100 pontos)
 * 
 * PONTUAÇÃO:
 * - Máxima: 100 pontos (todos os critérios positivos atendidos)
 * - Mínima: 0 pontos (critérios negativos aplicados)
 * 
 * RETORNE:
 * - Análise detalhada da ligação
 * - Pontuação de 0 a 100
 * - Critérios atendidos (true/false para cada um)
 * - Nível de confiança (0-100%)
 * - Palavras-chave críticas identificadas
 * - Cálculo detalhado da pontuação
 */

// Middleware de monitoramento
const logRequest = (req, res, next) => {
  console.log(`[QUALIDADE-FUNCIONARIOS] ${new Date().toISOString()} - ${req.method} ${req.path} - RECEIVED`);
  next();
};

const logResponse = (req, res, next) => {
  const originalSend = res.send;
  res.send = function(data) {
    console.log(`[QUALIDADE-FUNCIONARIOS] ${new Date().toISOString()} - ${req.method} ${req.path} - COMPLETED`);
    console.log(`[QUALIDADE-FUNCIONARIOS] Response:`, JSON.stringify(data, null, 2));
    originalSend.call(this, data);
  };
  next();
};

router.use(logRequest);
router.use(logResponse);

// Validação de dados obrigatórios para funcionários
const validateFuncionario = (req, res, next) => {
  const { colaboradorNome, empresa, dataContratado, CPF, userMail, profile_pic, acessos } = req.body;
  
  if (!colaboradorNome || colaboradorNome.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Nome do colaborador é obrigatório'
    });
  }
  
  if (!empresa || empresa.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Empresa é obrigatória'
    });
  }
  
  if (!dataContratado) {
    return res.status(400).json({
      success: false,
      message: 'Data de contratação é obrigatória'
    });
  }
  
  // Validar se dataContratado é uma data válida
  const dataContratadoDate = new Date(dataContratado);
  if (isNaN(dataContratadoDate.getTime())) {
    return res.status(400).json({
      success: false,
      message: 'Data de contratação deve ser uma data válida'
    });
  }
  
  // Validação opcional de CPF (11 dígitos, sem pontos ou traços)
  if (CPF !== undefined && CPF !== null && CPF !== '') {
    if (typeof CPF !== 'string' || !/^\d{11}$/.test(CPF)) {
      return res.status(400).json({
        success: false,
        message: 'CPF deve conter exatamente 11 dígitos numéricos'
      });
    }
  }
  
  // Validação opcional de email
  if (userMail !== undefined && userMail !== null && userMail !== '') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof userMail !== 'string' || !emailRegex.test(userMail)) {
      return res.status(400).json({
        success: false,
        message: 'Email inválido'
      });
    }
  }
  
  // Validação opcional de profile_pic (deve ser string se fornecido)
  if (profile_pic !== undefined && profile_pic !== null && profile_pic !== '') {
    if (typeof profile_pic !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Foto de perfil deve ser uma string (URL)'
      });
    }
  }
  
  // Validação de acessos - garantir que não receba valores padrão true
  if (acessos !== undefined && acessos !== null) {
    // Formato novo: objeto booleano {Velohub: Boolean, Console: Boolean, Academy: Boolean}
    if (typeof acessos === 'object' && !Array.isArray(acessos)) {
      const validKeys = ['Velohub', 'Console', 'Academy'];
      const keys = Object.keys(acessos);
      
      // Verificar se todas as chaves são válidas
      if (!keys.every(key => validKeys.includes(key))) {
        return res.status(400).json({
          success: false,
          message: 'Acessos deve conter apenas as chaves Velohub, Console e/ou Academy'
        });
      }
      
      // Verificar se os valores são booleanos
      if (!keys.every(key => typeof acessos[key] === 'boolean')) {
        return res.status(400).json({
          success: false,
          message: 'Valores de acessos devem ser booleanos (true ou false)'
        });
      }
      
      // Garantir que não sejam definidos como true por padrão se não foram explicitamente fornecidos
      // Isso é tratado no processamento dos dados, não na validação
    }
    // Formato antigo: array de objetos (mantido para compatibilidade)
    else if (Array.isArray(acessos)) {
      // Validação básica do formato antigo
      if (!acessos.every(item => typeof item === 'object' && item.sistema && item.perfil)) {
        return res.status(400).json({
          success: false,
          message: 'Formato de acessos inválido (array)'
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Acessos deve ser um objeto {Velohub: Boolean, Console: Boolean, Academy: Boolean} ou array de objetos'
      });
    }
  }
  
  next();
};

// Validação de dados obrigatórios para avaliações
const validateAvaliacao = (req, res, next) => {
  const { colaboradorNome, avaliador, mes, ano, dataLigacao, saudacaoAdequada, escutaAtiva, clarezaObjetividade, resolucaoQuestao, dominioAssunto, empatiaCordialidade, direcionouPesquisa, procedimentoIncorreto, encerramentoBrusco } = req.body;
  
  if (!colaboradorNome || colaboradorNome.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Nome do colaborador é obrigatório'
    });
  }
  
  if (!avaliador || avaliador.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Avaliador é obrigatório'
    });
  }
  
  if (!mes || mes.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Mês é obrigatório'
    });
  }
  
  if (!ano) {
    return res.status(400).json({
      success: false,
      message: 'Ano é obrigatório'
    });
  }
  
  // Converter ano para número se for string
  const anoNumber = typeof ano === 'string' ? parseInt(ano, 10) : ano;
  if (isNaN(anoNumber)) {
    return res.status(400).json({
      success: false,
      message: 'Ano deve ser um número válido'
    });
  }
  
  
  // Validar dataLigacao (obrigatório)
  if (!dataLigacao) {
    return res.status(400).json({
      success: false,
      message: 'Data da ligação é obrigatória'
    });
  }
  
  // Validar se dataLigacao é uma data válida
  const dataLigacaoDate = new Date(dataLigacao);
  if (isNaN(dataLigacaoDate.getTime())) {
    return res.status(400).json({
      success: false,
      message: 'Data da ligação deve ser uma data válida'
    });
  }
  
  // Validar todos os campos Boolean obrigatórios
  const booleanFields = {
    saudacaoAdequada: 'Saudação Adequada',
    escutaAtiva: 'Escuta Ativa',
    clarezaObjetividade: 'Clareza e Objetividade',
    resolucaoQuestao: 'Resolução Questão',
    dominioAssunto: 'Domínio no Assunto',
    empatiaCordialidade: 'Empatia/Cordialidade',
    direcionouPesquisa: 'Direcionou Pesquisa',
    procedimentoIncorreto: 'Procedimento Incorreto',
    encerramentoBrusco: 'Encerramento Brusco'
  };
  
  for (const [field, name] of Object.entries(booleanFields)) {
    if (req.body[field] === undefined || req.body[field] === null || typeof req.body[field] !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: `${name} é obrigatório e deve ser um valor booleano`
      });
    }
  }
  
  next();
};

// Validação de dados obrigatórios para atuações
const validateAtuacao = (req, res, next) => {
  const { funcao } = req.body;
  
  if (!funcao || funcao.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Nome da atuação é obrigatório'
    });
  }
  
  next();
};

// Validação de dados obrigatórios para funções
const validateFuncao = (req, res, next) => {
  const { funcao } = req.body;
  
  if (!funcao || funcao.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Nome da função é obrigatório'
    });
  }
  
  next();
};

// Validação de dados obrigatórios para avaliações GPT
const validateAvaliacaoGPT = (req, res, next) => {
  const { avaliacao_id, analiseGPT, pontuacaoGPT, criteriosGPT, confianca } = req.body;
  
  if (!avaliacao_id || avaliacao_id.toString().trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'ID da avaliação é obrigatório'
    });
  }
  
  if (!analiseGPT || analiseGPT.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Análise GPT é obrigatória'
    });
  }
  
  if (pontuacaoGPT === undefined || pontuacaoGPT === null || typeof pontuacaoGPT !== 'number') {
    return res.status(400).json({
      success: false,
      message: 'Pontuação GPT é obrigatória e deve ser um número'
    });
  }
  
  if (pontuacaoGPT < 0 || pontuacaoGPT > 100) {
    return res.status(400).json({
      success: false,
      message: 'Pontuação GPT deve estar entre 0 e 100'
    });
  }
  
  if (!criteriosGPT || typeof criteriosGPT !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'Critérios GPT são obrigatórios e devem ser um objeto'
    });
  }
  
  if (confianca === undefined || confianca === null || typeof confianca !== 'number') {
    return res.status(400).json({
      success: false,
      message: 'Confiança é obrigatória e deve ser um número'
    });
  }
  
  if (confianca < 0 || confianca > 100) {
    return res.status(400).json({
      success: false,
      message: 'Confiança deve estar entre 0 e 100'
    });
  }
  
  next();
};

// Função helper para normalizar formato de acessos ao retornar dados
const normalizarAcessosParaResposta = (acessos) => {
  // Se for null ou undefined, retornar objeto vazio
  if (!acessos) {
    return { Velohub: false, Console: false, Academy: false };
  }
  
  // Se já for objeto booleano, garantir que tenha todas as chaves
  if (typeof acessos === 'object' && !Array.isArray(acessos)) {
    return {
      Velohub: acessos.Velohub === true,
      Console: acessos.Console === true,
      Academy: acessos.Academy === true
    };
  }
  
  // Se for array (formato antigo), converter para objeto booleano
  if (Array.isArray(acessos)) {
    const novoAcessos = { Velohub: false, Console: false, Academy: false };
    acessos.forEach(acesso => {
      if (acesso && acesso.sistema) {
        const sistema = acesso.sistema.toLowerCase();
        if (sistema === 'velohub') {
          novoAcessos.Velohub = true;
        } else if (sistema === 'console') {
          novoAcessos.Console = true;
        } else if (sistema === 'academy') {
          novoAcessos.Academy = true;
        }
      }
    });
    return novoAcessos;
  }
  
  // Fallback: objeto vazio
  return { Velohub: false, Console: false, Academy: false };
};

// GET /api/qualidade/funcionarios - Listar todos os funcionários
router.get('/funcionarios', async (req, res) => {
  try {
    console.log(`[QUALIDADE-FUNCIONARIOS] ${new Date().toISOString()} - GET /funcionarios - PROCESSING`);
    
    const funcionarios = await QualidadeFuncionario.find({})
      .sort({ createdAt: -1 });
    
    // Normalizar formato de acessos para cada funcionário
    const funcionariosNormalizados = funcionarios.map(func => {
      const funcionarioObj = func.toObject ? func.toObject() : func;
      return {
        ...funcionarioObj,
        acessos: normalizarAcessosParaResposta(funcionarioObj.acessos)
      };
    });
    
    res.json({
      success: true,
      data: funcionariosNormalizados,
      count: funcionariosNormalizados.length
    });
  } catch (error) {
    console.error('[QUALIDADE-FUNCIONARIOS] Erro ao buscar funcionários:', error);
    console.error('[QUALIDADE-FUNCIONARIOS] Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao buscar funcionários',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/qualidade/funcionarios/ativos - Listar apenas funcionários ativos
router.get('/funcionarios/ativos', async (req, res) => {
  try {
    console.log(`[QUALIDADE-FUNCIONARIOS] ${new Date().toISOString()} - GET /funcionarios/ativos - PROCESSING`);
    
    const funcionariosAtivos = await QualidadeFuncionario.find({
      desligado: false,
      afastado: false
    }).sort({ createdAt: -1 });
    
    // Normalizar formato de acessos para cada funcionário
    const funcionariosNormalizados = funcionariosAtivos.map(func => {
      const funcionarioObj = func.toObject ? func.toObject() : func;
      return {
        ...funcionarioObj,
        acessos: normalizarAcessosParaResposta(funcionarioObj.acessos)
      };
    });
    
    res.json({
      success: true,
      data: funcionariosNormalizados,
      count: funcionariosNormalizados.length
    });
  } catch (error) {
    console.error('[QUALIDADE-FUNCIONARIOS] Erro ao buscar funcionários ativos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao buscar funcionários ativos'
    });
  }
});

// GET /api/qualidade/funcionarios/:id - Obter funcionário específico por _id
router.get('/funcionarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[QUALIDADE-FUNCIONARIOS] ${new Date().toISOString()} - GET /funcionarios/${id} - PROCESSING`);
    
    const funcionario = await QualidadeFuncionario.findById(id);
    
    if (!funcionario) {
      return res.status(404).json({
        success: false,
        message: 'Funcionário não encontrado'
      });
    }
    
    // Normalizar formato de acessos
    const funcionarioObj = funcionario.toObject ? funcionario.toObject() : funcionario;
    const funcionarioNormalizado = {
      ...funcionarioObj,
      acessos: normalizarAcessosParaResposta(funcionarioObj.acessos)
    };
    
    res.json({
      success: true,
      data: funcionarioNormalizado
    });
  } catch (error) {
    console.error('[QUALIDADE-FUNCIONARIOS] Erro ao buscar funcionário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao buscar funcionário'
    });
  }
});

// POST /api/qualidade/funcionarios - Criar novo funcionário
router.post('/funcionarios', validateFuncionario, async (req, res) => {
  try {
    global.emitTraffic('Qualidade Funcionários', 'received', 'Entrada recebida - POST /api/qualidade/funcionarios');
    global.emitLog('info', 'POST /api/qualidade/funcionarios - Criando novo funcionário');
    global.emitJson(req.body);
    
    const funcionarioData = { ...req.body };
    
    // Converter datas se fornecidas como strings
    if (funcionarioData.dataAniversario) {
      funcionarioData.dataAniversario = new Date(funcionarioData.dataAniversario);
    }
    if (funcionarioData.dataContratado) {
      funcionarioData.dataContratado = new Date(funcionarioData.dataContratado);
    }
    if (funcionarioData.dataDesligamento) {
      funcionarioData.dataDesligamento = new Date(funcionarioData.dataDesligamento);
    }
    if (funcionarioData.dataAfastamento) {
      funcionarioData.dataAfastamento = new Date(funcionarioData.dataAfastamento);
    }
    
    // Processar novos campos opcionais
    // CPF: já validado, apenas garantir trim
    if (funcionarioData.CPF) {
      funcionarioData.CPF = funcionarioData.CPF.trim();
    }
    
    // userMail: já validado, garantir lowercase e trim
    if (funcionarioData.userMail) {
      funcionarioData.userMail = funcionarioData.userMail.toLowerCase().trim();
    }
    
    // profile_pic: já validado, apenas garantir trim
    if (funcionarioData.profile_pic) {
      funcionarioData.profile_pic = funcionarioData.profile_pic.trim();
    }
    
    // Normalizar formato de acessos (converter array para objeto se necessário)
    if (funcionarioData.acessos) {
      // Se está no formato antigo (array), converter para objeto booleano
      if (Array.isArray(funcionarioData.acessos)) {
        const novoAcessos = {};
        funcionarioData.acessos.forEach(acesso => {
          if (acesso.sistema === 'Velohub' || acesso.sistema === 'velohub') {
            novoAcessos.Velohub = true;
          }
          if (acesso.sistema === 'Console' || acesso.sistema === 'console') {
            novoAcessos.Console = true;
          }
          if (acesso.sistema === 'Academy' || acesso.sistema === 'academy') {
            novoAcessos.Academy = true;
          }
        });
        // Apenas definir acessos se houver pelo menos um valor true
        funcionarioData.acessos = Object.keys(novoAcessos).length > 0 ? novoAcessos : null;
      }
      // Se está no formato novo (objeto), garantir que apenas Velohub, Console e Academy existam
      else if (typeof funcionarioData.acessos === 'object') {
        const novoAcessos = {};
        if (funcionarioData.acessos.Velohub === true) {
          novoAcessos.Velohub = true;
        }
        if (funcionarioData.acessos.Console === true) {
          novoAcessos.Console = true;
        }
        if (funcionarioData.acessos.Academy === true) {
          novoAcessos.Academy = true;
        }
        // Apenas definir acessos se houver pelo menos um valor true
        funcionarioData.acessos = Object.keys(novoAcessos).length > 0 ? novoAcessos : null;
      }
    }
    // Se acessos não foi fornecido, não definir (null/undefined) - NÃO definir valores padrão true
    
    // Gerar hash de senha padrão se não fornecido (primeiroNome.ultimoNomeCPF)
    if (!funcionarioData.password && funcionarioData.colaboradorNome && funcionarioData.CPF) {
      // Formato: primeiroNome.ultimoNomeCPF (ex: joao.santos12345678901)
      // Usa o primeiro e último nome da string, mesmo que tenha nomes intermediários
      const nomeParts = funcionarioData.colaboradorNome.toLowerCase().trim().split(' ').filter(n => n.length > 0);
      const primeiroNome = nomeParts[0];
      const ultimoNome = nomeParts.length > 1 ? nomeParts[nomeParts.length - 1] : primeiroNome;
      funcionarioData.password = `${primeiroNome}.${ultimoNome}${funcionarioData.CPF}`;
      // Nota: Em produção, isso deve ser hasheado antes de salvar
    }
    
    global.emitTraffic('Qualidade Funcionários', 'processing', 'Transmitindo para DB');
    const novoFuncionario = new QualidadeFuncionario(funcionarioData);
    const funcionarioSalvo = await novoFuncionario.save();
    
    global.emitTraffic('Qualidade Funcionários', 'completed', 'Concluído - Funcionário criado com sucesso');
    global.emitLog('success', `POST /api/qualidade/funcionarios - Funcionário "${funcionarioSalvo.colaboradorNome}" criado com sucesso`);
    global.emitJson(funcionarioSalvo);
    
    // Sincronizar com config se Console = true
    if (funcionarioSalvo.acessos && funcionarioSalvo.acessos.Console === true) {
      try {
        const syncResult = await syncUserToConfig(funcionarioSalvo, true);
        if (!syncResult.success) {
          console.warn(`⚠️ [QUALIDADE-FUNCIONARIOS] Falha na sincronização com config (não impede salvamento): ${syncResult.message}`);
        }
      } catch (syncError) {
        console.error(`❌ [QUALIDADE-FUNCIONARIOS] Erro na sincronização com config (não impede salvamento):`, syncError);
      }
    }
    
    res.status(201).json({
      success: true,
      data: funcionarioSalvo,
      message: 'Funcionário criado com sucesso'
    });
  } catch (error) {
    global.emitTraffic('Qualidade Funcionários', 'error', 'Erro ao criar funcionário');
    global.emitLog('error', `POST /api/qualidade/funcionarios - Erro: ${error.message}`);
    console.error('[QUALIDADE-FUNCIONARIOS] Erro ao criar funcionário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao criar funcionário'
    });
  }
});

// PUT /api/qualidade/funcionarios/:id - Atualizar funcionário existente
router.put('/funcionarios/:id', validateFuncionario, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[QUALIDADE-FUNCIONARIOS] ${new Date().toISOString()} - PUT /funcionarios/${id} - PROCESSING`);
    console.log(`[QUALIDADE-FUNCIONARIOS] Request body:`, JSON.stringify(req.body, null, 2));
    
    // Verificar se funcionário existe e capturar estado anterior de acessos.Console
    const funcionarioExistente = await QualidadeFuncionario.findById(id);
    if (!funcionarioExistente) {
      return res.status(404).json({
        success: false,
        message: 'Funcionário não encontrado'
      });
    }
    
    // Capturar estado anterior de acessos.Console para comparação
    const consoleAcessoAnterior = funcionarioExistente.acessos && funcionarioExistente.acessos.Console === true;
    
    // Converter datas se fornecidas como strings
    const updateData = { ...req.body };
    if (updateData.dataAniversario) {
      updateData.dataAniversario = new Date(updateData.dataAniversario);
    }
    if (updateData.dataContratado) {
      updateData.dataContratado = new Date(updateData.dataContratado);
    }
    if (updateData.dataDesligamento) {
      updateData.dataDesligamento = new Date(updateData.dataDesligamento);
    }
    if (updateData.dataAfastamento) {
      updateData.dataAfastamento = new Date(updateData.dataAfastamento);
    }
    
    // Processar novos campos opcionais
    // CPF: já validado, apenas garantir trim
    if (updateData.CPF !== undefined) {
      if (updateData.CPF === null || updateData.CPF === '') {
        updateData.CPF = null;
      } else {
        updateData.CPF = updateData.CPF.trim();
      }
    }
    
    // userMail: já validado, garantir lowercase e trim
    if (updateData.userMail !== undefined) {
      if (updateData.userMail === null || updateData.userMail === '') {
        updateData.userMail = null;
      } else {
        updateData.userMail = updateData.userMail.toLowerCase().trim();
      }
    }
    
    // profile_pic: já validado, apenas garantir trim
    if (updateData.profile_pic !== undefined) {
      if (updateData.profile_pic === null || updateData.profile_pic === '') {
        updateData.profile_pic = null;
      } else {
        updateData.profile_pic = updateData.profile_pic.trim();
      }
    }
    
    // Normalizar formato de acessos (converter array para objeto se necessário)
    if (updateData.acessos !== undefined) {
      if (updateData.acessos === null || updateData.acessos === '') {
        updateData.acessos = null;
      }
      // Se está no formato antigo (array), converter para objeto booleano
      else if (Array.isArray(updateData.acessos)) {
        const novoAcessos = {};
        updateData.acessos.forEach(acesso => {
          if (acesso.sistema === 'Velohub' || acesso.sistema === 'velohub') {
            novoAcessos.Velohub = true;
          }
          if (acesso.sistema === 'Console' || acesso.sistema === 'console') {
            novoAcessos.Console = true;
          }
          if (acesso.sistema === 'Academy' || acesso.sistema === 'academy') {
            novoAcessos.Academy = true;
          }
        });
        // Apenas definir acessos se houver pelo menos um valor true
        updateData.acessos = Object.keys(novoAcessos).length > 0 ? novoAcessos : null;
      }
      // Se está no formato novo (objeto), garantir que apenas Velohub, Console e Academy existam
      else if (typeof updateData.acessos === 'object') {
        const novoAcessos = {};
        if (updateData.acessos.Velohub === true) {
          novoAcessos.Velohub = true;
        }
        if (updateData.acessos.Console === true) {
          novoAcessos.Console = true;
        }
        if (updateData.acessos.Academy === true) {
          novoAcessos.Academy = true;
        }
        // Apenas definir acessos se houver pelo menos um valor true
        updateData.acessos = Object.keys(novoAcessos).length > 0 ? novoAcessos : null;
      }
    }
    // Se acessos não foi fornecido no update, não alterar o valor existente
    
    const funcionarioAtualizado = await QualidadeFuncionario.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    // Sincronizar com config baseado na mudança de acessos.Console
    const consoleAcessoNovo = funcionarioAtualizado.acessos && funcionarioAtualizado.acessos.Console === true;
    
    // Se mudou de false para true: criar usuário no config
    // Se mudou de true para false: deletar usuário do config
    // Se já era true e continua true: verificar se existe, criar se não existir
    if (consoleAcessoNovo !== consoleAcessoAnterior || (consoleAcessoNovo === true && consoleAcessoAnterior === true)) {
      try {
        const syncResult = await syncUserToConfig(funcionarioAtualizado, consoleAcessoNovo);
        if (!syncResult.success && syncResult.action !== 'skipped') {
          console.warn(`⚠️ [QUALIDADE-FUNCIONARIOS] Falha na sincronização com config (não impede atualização): ${syncResult.message}`);
        }
      } catch (syncError) {
        console.error(`❌ [QUALIDADE-FUNCIONARIOS] Erro na sincronização com config (não impede atualização):`, syncError);
      }
    }
    
    res.json({
      success: true,
      data: funcionarioAtualizado,
      message: 'Funcionário atualizado com sucesso'
    });
  } catch (error) {
    console.error('[QUALIDADE-FUNCIONARIOS] Erro ao atualizar funcionário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao atualizar funcionário'
    });
  }
});

// DELETE /api/qualidade/funcionarios/:id - Deletar funcionário
router.delete('/funcionarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[QUALIDADE-FUNCIONARIOS] ${new Date().toISOString()} - DELETE /funcionarios/${id} - PROCESSING`);
    
    const funcionarioDeletado = await QualidadeFuncionario.findByIdAndDelete(id);
    
    if (!funcionarioDeletado) {
      return res.status(404).json({
        success: false,
        message: 'Funcionário não encontrado'
      });
    }
    
    res.json({
      success: true,
      data: funcionarioDeletado,
      message: 'Funcionário deletado com sucesso'
    });
  } catch (error) {
    console.error('[QUALIDADE-FUNCIONARIOS] Erro ao deletar funcionário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao deletar funcionário'
    });
  }
});

// ==================== ENDPOINTS DE AVALIAÇÕES ====================

// GET /api/qualidade/avaliacoes - Listar todas as avaliações
router.get('/avaliacoes', async (req, res) => {
  try {
    console.log(`[QUALIDADE-AVALIACOES] ${new Date().toISOString()} - GET /avaliacoes - PROCESSING`);
    
    const avaliacoes = await QualidadeAvaliacao.find({})
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: avaliacoes,
      count: avaliacoes.length
    });
  } catch (error) {
    console.error('[QUALIDADE-AVALIACOES] Erro ao buscar avaliações:', error);
    console.error('[QUALIDADE-AVALIACOES] Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao buscar avaliações',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/qualidade/avaliacoes/:id - Obter avaliação específica por _id
router.get('/avaliacoes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[QUALIDADE-AVALIACOES] ${new Date().toISOString()} - GET /avaliacoes/${id} - PROCESSING`);
    
    const avaliacao = await QualidadeAvaliacao.findById(id);
    
    if (!avaliacao) {
      return res.status(404).json({
        success: false,
        message: 'Avaliação não encontrada'
      });
    }
    
    res.json({
      success: true,
      data: avaliacao
    });
  } catch (error) {
    console.error('[QUALIDADE-AVALIACOES] Erro ao buscar avaliação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao buscar avaliação'
    });
  }
});

// POST /api/qualidade/avaliacoes - Criar nova avaliação
router.post('/avaliacoes', validateAvaliacao, async (req, res) => {
  try {
    global.emitTraffic('Qualidade Avaliações', 'received', 'Entrada recebida - POST /api/qualidade/avaliacoes');
    global.emitLog('info', 'POST /api/qualidade/avaliacoes - Criando nova avaliação');
    global.emitJson(req.body);
    
    const avaliacaoData = { ...req.body };
    
    
    // Converter ano para número se for string
    if (avaliacaoData.ano && typeof avaliacaoData.ano === 'string') {
      avaliacaoData.ano = parseInt(avaliacaoData.ano, 10);
    }
    
    // Calcular pontuação total usando nova função
    avaliacaoData.pontuacaoTotal = calcularPontuacao(avaliacaoData);
    
    global.emitTraffic('Qualidade Avaliações', 'processing', 'Transmitindo para DB');
    const novaAvaliacao = new QualidadeAvaliacao(avaliacaoData);
    const avaliacaoSalva = await novaAvaliacao.save();
    
    global.emitTraffic('Qualidade Avaliações', 'completed', 'Concluído - Avaliação criada com sucesso');
    global.emitLog('success', `POST /api/qualidade/avaliacoes - Avaliação do colaborador "${avaliacaoSalva.colaboradorNome}" criada com sucesso`);
    global.emitJson(avaliacaoSalva);
    
    res.status(201).json({
      success: true,
      data: avaliacaoSalva,
      message: 'Avaliação criada com sucesso'
    });
  } catch (error) {
    global.emitTraffic('Qualidade Avaliações', 'error', 'Erro ao criar avaliação');
    global.emitLog('error', `POST /api/qualidade/avaliacoes - Erro: ${error.message}`);
    console.error('[QUALIDADE-AVALIACOES] Erro ao criar avaliação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao criar avaliação'
    });
  }
});

// PUT /api/qualidade/avaliacoes/:id - Atualizar avaliação existente
router.put('/avaliacoes/:id', validateAvaliacao, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[QUALIDADE-AVALIACOES] ${new Date().toISOString()} - PUT /avaliacoes/${id} - PROCESSING`);
    console.log(`[QUALIDADE-AVALIACOES] Request body:`, JSON.stringify(req.body, null, 2));
    
    // Verificar se avaliação existe
    const avaliacaoExistente = await QualidadeAvaliacao.findById(id);
    if (!avaliacaoExistente) {
      return res.status(404).json({
        success: false,
        message: 'Avaliação não encontrada'
      });
    }
    
    const updateData = { ...req.body };
    
    // Converter ano para número se for string
    if (updateData.ano && typeof updateData.ano === 'string') {
      updateData.ano = parseInt(updateData.ano, 10);
    }
    
    // Calcular pontuação total usando nova função
    updateData.pontuacaoTotal = calcularPontuacao(updateData);
    
    const avaliacaoAtualizada = await QualidadeAvaliacao.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    res.json({
      success: true,
      data: avaliacaoAtualizada,
      message: 'Avaliação atualizada com sucesso'
    });
  } catch (error) {
    console.error('[QUALIDADE-AVALIACOES] Erro ao atualizar avaliação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao atualizar avaliação'
    });
  }
});

// DELETE /api/qualidade/avaliacoes/:id - Deletar avaliação
router.delete('/avaliacoes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[QUALIDADE-AVALIACOES] ${new Date().toISOString()} - DELETE /avaliacoes/${id} - PROCESSING`);
    
    const avaliacaoDeletada = await QualidadeAvaliacao.findByIdAndDelete(id);
    
    if (!avaliacaoDeletada) {
      return res.status(404).json({
        success: false,
        message: 'Avaliação não encontrada'
      });
    }
    
    res.json({
      success: true,
      data: avaliacaoDeletada,
      message: 'Avaliação deletada com sucesso'
    });
  } catch (error) {
    console.error('[QUALIDADE-AVALIACOES] Erro ao deletar avaliação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao deletar avaliação'
    });
  }
});

// GET /api/qualidade/avaliacoes/colaborador/:nome - Buscar avaliações por colaborador
router.get('/avaliacoes/colaborador/:nome', async (req, res) => {
  try {
    const { nome } = req.params;
    console.log(`[QUALIDADE-AVALIACOES] ${new Date().toISOString()} - GET /avaliacoes/colaborador/${nome} - PROCESSING`);
    
    const avaliacoes = await QualidadeAvaliacao.find({ colaboradorNome: nome })
      .sort({ dataAvaliacao: -1 });
    
    res.json({
      success: true,
      data: avaliacoes,
      message: `Avaliações encontradas para ${nome}`
    });
  } catch (error) {
    console.error('[QUALIDADE-AVALIACOES] Erro ao buscar avaliações por colaborador:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao buscar avaliações por colaborador'
    });
  }
});

// GET /api/qualidade/avaliacoes/mes/:mes/ano/:ano - Buscar avaliações por período
router.get('/avaliacoes/mes/:mes/ano/:ano', async (req, res) => {
  try {
    const { mes, ano } = req.params;
    const anoNumber = parseInt(ano, 10);
    
    console.log(`[QUALIDADE-AVALIACOES] ${new Date().toISOString()} - GET /avaliacoes/mes/${mes}/ano/${ano} - PROCESSING`);
    
    const avaliacoes = await QualidadeAvaliacao.find({ 
      mes: mes, 
      ano: anoNumber 
    }).sort({ dataAvaliacao: -1 });
    
    res.json({
      success: true,
      data: avaliacoes,
      message: `Avaliações encontradas para ${mes}/${ano}`
    });
  } catch (error) {
    console.error('[QUALIDADE-AVALIACOES] Erro ao buscar avaliações por período:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao buscar avaliações por período'
    });
  }
});

// ==================== ENDPOINTS DE RELATÓRIOS ====================

// GET /api/qualidade/relatorios/agente/:nome - Relatório individual do agente
router.get('/relatorios/agente/:nome', async (req, res) => {
  try {
    const { nome } = req.params;
    console.log(`[QUALIDADE-RELATORIOS] ${new Date().toISOString()} - GET /relatorios/agente/${nome} - PROCESSING`);
    
    // Buscar todas as avaliações do colaborador
    const avaliacoes = await QualidadeAvaliacao.find({ colaboradorNome: nome })
      .sort({ dataAvaliacao: -1 });
    
    if (avaliacoes.length === 0) {
      return res.json({
        success: true,
        data: {
          colaboradorNome: nome,
          avaliacoes: [],
          mediaAvaliador: 0,
          mediaGPT: 0,
          totalAvaliacoes: 0,
          melhorNota: 0,
          piorNota: 0,
          tendencia: 'estavel'
        },
        message: `Nenhuma avaliação encontrada para ${nome}`
      });
    }
    
    // Calcular métricas
    const pontuacoes = avaliacoes.map(a => a.pontuacaoTotal);
    const mediaAvaliador = pontuacoes.reduce((sum, p) => sum + p, 0) / pontuacoes.length;
    const melhorNota = Math.max(...pontuacoes);
    const piorNota = Math.min(...pontuacoes);
    
    // Calcular tendência (comparar últimas 3 avaliações com as 3 anteriores)
    let tendencia = 'estavel';
    if (avaliacoes.length >= 6) {
      const ultimas3 = avaliacoes.slice(0, 3).map(a => a.pontuacaoTotal);
      const anteriores3 = avaliacoes.slice(3, 6).map(a => a.pontuacaoTotal);
      
      const mediaUltimas = ultimas3.reduce((sum, p) => sum + p, 0) / ultimas3.length;
      const mediaAnteriores = anteriores3.reduce((sum, p) => sum + p, 0) / anteriores3.length;
      
      if (mediaUltimas > mediaAnteriores + 5) {
        tendencia = 'melhorando';
      } else if (mediaUltimas < mediaAnteriores - 5) {
        tendencia = 'piorando';
      }
    }
    
    const relatorio = {
      colaboradorNome: nome,
      avaliacoes: avaliacoes,
      mediaAvaliador: Math.round(mediaAvaliador * 100) / 100,
      mediaGPT: 0, // Será implementado quando houver avaliações GPT
      totalAvaliacoes: avaliacoes.length,
      melhorNota: melhorNota,
      piorNota: piorNota,
      tendencia: tendencia
    };
    
    res.json({
      success: true,
      data: relatorio,
      message: `Relatório gerado para ${nome}`
    });
  } catch (error) {
    console.error('[QUALIDADE-RELATORIOS] Erro ao gerar relatório do agente:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao gerar relatório do agente'
    });
  }
});

// GET /api/qualidade/relatorios/gestao/:mes/:ano - Relatório da gestão
router.get('/relatorios/gestao/:mes/:ano', async (req, res) => {
  try {
    const { mes, ano } = req.params;
    const anoNumber = parseInt(ano, 10);
    
    console.log(`[QUALIDADE-RELATORIOS] ${new Date().toISOString()} - GET /relatorios/gestao/${mes}/${ano} - PROCESSING`);
    
    // Buscar todas as avaliações do período
    const avaliacoes = await QualidadeAvaliacao.find({ 
      mes: mes, 
      ano: anoNumber 
    }).sort({ dataAvaliacao: -1 });
    
    if (avaliacoes.length === 0) {
      return res.json({
        success: true,
        data: {
          mes: mes,
          ano: anoNumber,
          totalAvaliacoes: 0,
          mediaGeral: 0,
          top3Melhores: [],
          top3Piores: [],
          colaboradores: []
        },
        message: `Nenhuma avaliação encontrada para ${mes}/${ano}`
      });
    }
    
    // Agrupar por colaborador
    const colaboradoresMap = new Map();
    
    avaliacoes.forEach(avaliacao => {
      const nome = avaliacao.colaboradorNome;
      if (!colaboradoresMap.has(nome)) {
        colaboradoresMap.set(nome, {
          colaboradorNome: nome,
          avaliacoes: [],
          media: 0,
          totalAvaliacoes: 0
        });
      }
      
      const colaborador = colaboradoresMap.get(nome);
      colaborador.avaliacoes.push(avaliacao);
      colaborador.totalAvaliacoes++;
    });
    
    // Calcular médias por colaborador
    colaboradoresMap.forEach(colaborador => {
      const pontuacoes = colaborador.avaliacoes.map(a => a.pontuacaoTotal);
      colaborador.media = Math.round((pontuacoes.reduce((sum, p) => sum + p, 0) / pontuacoes.length) * 100) / 100;
    });
    
    // Converter para array e ordenar
    const colaboradores = Array.from(colaboradoresMap.values())
      .sort((a, b) => b.media - a.media);
    
    // Calcular média geral
    const mediaGeral = colaboradores.length > 0 
      ? Math.round((colaboradores.reduce((sum, c) => sum + c.media, 0) / colaboradores.length) * 100) / 100
      : 0;
    
    // Top 3 melhores e piores
    const top3Melhores = colaboradores.slice(0, 3).map((colaborador, index) => ({
      colaboradorNome: colaborador.colaboradorNome,
      nota: colaborador.media,
      posicao: index + 1
    }));
    
    const top3Piores = colaboradores.slice(-3).reverse().map((colaborador, index) => ({
      colaboradorNome: colaborador.colaboradorNome,
      nota: colaborador.media,
      posicao: colaboradores.length - 2 + index
    }));
    
    const relatorio = {
      mes: mes,
      ano: anoNumber,
      totalAvaliacoes: avaliacoes.length,
      mediaGeral: mediaGeral,
      top3Melhores: top3Melhores,
      top3Piores: top3Piores,
      colaboradores: colaboradores.map((colaborador, index) => ({
        colaboradorNome: colaborador.colaboradorNome,
        nota: colaborador.media,
        posicao: index + 1
      }))
    };
    
    res.json({
      success: true,
      data: relatorio,
      message: `Relatório gerencial gerado para ${mes}/${ano}`
    });
  } catch (error) {
    console.error('[QUALIDADE-RELATORIOS] Erro ao gerar relatório da gestão:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao gerar relatório da gestão'
    });
  }
});

// ==================== ENDPOINTS DE ARQUIVOS ====================

// POST /api/qualidade/arquivos/upload - Upload de arquivo de áudio
router.post('/arquivos/upload', async (req, res) => {
  try {
    console.log(`[QUALIDADE-ARQUIVOS] ${new Date().toISOString()} - POST /arquivos/upload - PROCESSING`);
    
    // Verificar se há arquivo no corpo da requisição
    if (!req.body.arquivoLigacao) {
      return res.status(400).json({
        success: false,
        message: 'Arquivo de áudio é obrigatório'
      });
    }
    
    const { arquivoLigacao, nomeArquivo } = req.body;
    
    // Validar se é Base64 válido
    if (!arquivoLigacao.startsWith('data:audio/')) {
      return res.status(400).json({
        success: false,
        message: 'Formato de arquivo inválido. Deve ser um arquivo de áudio em Base64'
      });
    }
    
    // Validar tamanho (aproximadamente 50MB em Base64)
    const base64Size = arquivoLigacao.length;
    const maxSize = 50 * 1024 * 1024 * 1.37; // 50MB * 1.37 (fator de conversão Base64)
    
    if (base64Size > maxSize) {
      return res.status(400).json({
        success: false,
        message: 'Arquivo muito grande. Tamanho máximo permitido: 50MB'
      });
    }
    
    // Validar tipo de arquivo
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/mpeg3', 'audio/x-mpeg-3'];
    const mimeType = arquivoLigacao.split(';')[0].split(':')[1];
    
    if (!allowedTypes.includes(mimeType)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de arquivo não permitido. Tipos aceitos: MP3, WAV'
      });
    }
    
    // Gerar ID único para o arquivo
    const arquivoId = `arquivo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Aqui você pode implementar lógica para salvar o arquivo
    // Por enquanto, vamos apenas retornar sucesso
    const arquivoInfo = {
      id: arquivoId,
      nomeArquivo: nomeArquivo || `audio_${Date.now()}.${mimeType.split('/')[1]}`,
      tamanho: base64Size,
      tipo: mimeType,
      url: `data:${mimeType};base64,${arquivoLigacao.split(',')[1]}`,
      uploadedAt: new Date()
    };
    
    res.json({
      success: true,
      data: arquivoInfo,
      message: 'Arquivo enviado com sucesso'
    });
  } catch (error) {
    console.error('[QUALIDADE-ARQUIVOS] Erro ao fazer upload do arquivo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao fazer upload do arquivo'
    });
  }
});

// GET /api/qualidade/arquivos/:id - Download de arquivo
router.get('/arquivos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[QUALIDADE-ARQUIVOS] ${new Date().toISOString()} - GET /arquivos/${id} - PROCESSING`);
    
    // Aqui você implementaria a lógica para buscar o arquivo
    // Por enquanto, vamos retornar um erro 404
    res.status(404).json({
      success: false,
      message: 'Arquivo não encontrado'
    });
  } catch (error) {
    console.error('[QUALIDADE-ARQUIVOS] Erro ao buscar arquivo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao buscar arquivo'
    });
  }
});

// DELETE /api/qualidade/arquivos/:id - Excluir arquivo
router.delete('/arquivos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[QUALIDADE-ARQUIVOS] ${new Date().toISOString()} - DELETE /arquivos/${id} - PROCESSING`);
    
    // Aqui você implementaria a lógica para excluir o arquivo
    // Por enquanto, vamos retornar sucesso
    res.json({
      success: true,
      message: 'Arquivo excluído com sucesso'
    });
  } catch (error) {
    console.error('[QUALIDADE-ARQUIVOS] Erro ao excluir arquivo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao excluir arquivo'
    });
  }
});

// ==================== ENDPOINTS DE AVALIAÇÕES GPT ====================

// GET /api/qualidade/avaliacoes-gpt - Listar todas as avaliações GPT
router.get('/avaliacoes-gpt', async (req, res) => {
  try {
    console.log(`[QUALIDADE-AVALIACOES-GPT] ${new Date().toISOString()} - GET /avaliacoes-gpt - PROCESSING`);
    
    const { avaliacao_id } = req.query;
    let query = {};
    
    if (avaliacao_id) {
      query.avaliacao_id = avaliacao_id;
    }
    
    const avaliacoesGPT = await QualidadeAvaliacaoGPT.find(query)
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: avaliacoesGPT,
      count: avaliacoesGPT.length
    });
  } catch (error) {
    console.error('[QUALIDADE-AVALIACOES-GPT] Erro ao buscar avaliações GPT:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao buscar avaliações GPT'
    });
  }
});

// GET /api/qualidade/avaliacoes-gpt/:id - Obter avaliação GPT específica por _id
router.get('/avaliacoes-gpt/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[QUALIDADE-AVALIACOES-GPT] ${new Date().toISOString()} - GET /avaliacoes-gpt/${id} - PROCESSING`);
    
    const avaliacaoGPT = await QualidadeAvaliacaoGPT.findById(id);
    
    if (!avaliacaoGPT) {
      return res.status(404).json({
        success: false,
        message: 'Avaliação GPT não encontrada'
      });
    }
    
    res.json({
      success: true,
      data: avaliacaoGPT
    });
  } catch (error) {
    console.error('[QUALIDADE-AVALIACOES-GPT] Erro ao buscar avaliação GPT:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao buscar avaliação GPT'
    });
  }
});

// GET /api/qualidade/avaliacoes-gpt/avaliacao/:avaliacao_id - Obter avaliação GPT por ID da avaliação original
router.get('/avaliacoes-gpt/avaliacao/:avaliacao_id', async (req, res) => {
  try {
    const { avaliacao_id } = req.params;
    console.log(`[QUALIDADE-AVALIACOES-GPT] ${new Date().toISOString()} - GET /avaliacoes-gpt/avaliacao/${avaliacao_id} - PROCESSING`);
    
    const avaliacaoGPT = await QualidadeAvaliacaoGPT.findOne({ avaliacao_id });
    
    if (!avaliacaoGPT) {
      return res.status(404).json({
        success: false,
        message: 'Avaliação GPT não encontrada para esta avaliação'
      });
    }
    
    res.json({
      success: true,
      data: avaliacaoGPT
    });
  } catch (error) {
    console.error('[QUALIDADE-AVALIACOES-GPT] Erro ao buscar avaliação GPT por avaliacao_id:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao buscar avaliação GPT'
    });
  }
});

// POST /api/qualidade/avaliacoes-gpt - Criar nova avaliação GPT
// DEPRECATED: Este endpoint está deprecado. Análises GPT são criadas automaticamente via Worker em audio_analise_results
router.post('/avaliacoes-gpt', validateAvaliacaoGPT, async (req, res) => {
  global.emitTraffic('Qualidade Avaliações GPT', 'deprecated', 'Endpoint deprecado - POST /api/qualidade/avaliacoes-gpt');
  global.emitLog('warn', 'POST /api/qualidade/avaliacoes-gpt - Endpoint deprecado. Use audio_analise_results.');
  
  return res.status(410).json({
    success: false,
    message: 'Este endpoint foi deprecado. Os dados de análise GPT agora estão em audio_analise_results.',
    deprecated: true,
    alternative: '/api/audio-analise/result/:id',
    migration: 'Análises GPT são criadas automaticamente via Worker quando um áudio é processado. Use GET /api/audio-analise/result/:avaliacaoId para buscar análises GPT.'
  });
});

// PUT /api/qualidade/avaliacoes-gpt/:id - Atualizar avaliação GPT existente
// DEPRECATED: Este endpoint está deprecado. Atualizações devem ser feitas em audio_analise_results.gptAnalysis
router.put('/avaliacoes-gpt/:id', validateAvaliacaoGPT, async (req, res) => {
  global.emitTraffic('Qualidade Avaliações GPT', 'deprecated', 'Endpoint deprecado - PUT /api/qualidade/avaliacoes-gpt/:id');
  global.emitLog('warn', `PUT /api/qualidade/avaliacoes-gpt/${req.params.id} - Endpoint deprecado. Use PUT /api/audio-analise/:id/editar-analise.`);
  
  return res.status(410).json({
    success: false,
    message: 'Este endpoint foi deprecado. Atualizações de análise GPT devem ser feitas em audio_analise_results.',
    deprecated: true,
    alternative: '/api/audio-analise/:id/editar-analise',
    migration: 'Use PUT /api/audio-analise/:analiseId/editar-analise para atualizar o campo analysis em audio_analise_results.gptAnalysis ou audio_analise_results.qualityAnalysis'
  });
});

// DELETE /api/qualidade/avaliacoes-gpt/:id - Deletar avaliação GPT
// DEPRECATED: Este endpoint está deprecado. Dados estão em audio_analise_results
router.delete('/avaliacoes-gpt/:id', async (req, res) => {
  global.emitTraffic('Qualidade Avaliações GPT', 'deprecated', 'Endpoint deprecado - DELETE /api/qualidade/avaliacoes-gpt/:id');
  global.emitLog('warn', `DELETE /api/qualidade/avaliacoes-gpt/${req.params.id} - Endpoint deprecado. Dados estão em audio_analise_results.`);
  
  return res.status(410).json({
    success: false,
    message: 'Este endpoint foi deprecado. Dados de análise GPT estão em audio_analise_results.',
    deprecated: true,
    alternative: 'Dados não devem ser deletados. Se necessário, atualize o campo analysis em audio_analise_results.',
    migration: 'Dados de análise GPT estão em audio_analise_results e não devem ser deletados diretamente.'
  });
});

// ========================================
// ENDPOINTS PARA ATUAÇÕES
// ========================================

// POST /api/qualidade/atuacoes - Criar nova atuação
router.post('/atuacoes', validateAtuacao, async (req, res) => {
  try {
    global.emitTraffic('Qualidade Atuações', 'received', 'Entrada recebida - POST /api/qualidade/atuacoes');
    global.emitLog('info', 'POST /api/qualidade/atuacoes - Criando nova atuação');
    global.emitJson(req.body);
    
    const atuacaoData = { ...req.body };
    
    global.emitTraffic('Qualidade Atuações', 'processing', 'Transmitindo para DB');
    const novaAtuacao = new QualidadeAtuacoes(atuacaoData);
    const atuacaoSalva = await novaAtuacao.save();
    
    global.emitTraffic('Qualidade Atuações', 'completed', 'Concluído - Atuação criada com sucesso');
    global.emitLog('success', `POST /api/qualidade/atuacoes - Atuação "${atuacaoSalva.funcao}" criada com sucesso`);
    global.emitJson(atuacaoSalva);
    
    res.status(201).json({
      success: true,
      data: atuacaoSalva,
      message: 'Atuação criada com sucesso'
    });
  } catch (error) {
    global.emitTraffic('Qualidade Atuações', 'error', `Erro: ${error.message}`);
    global.emitLog('error', `POST /api/qualidade/atuacoes - Erro: ${error.message}`);
    console.error('[QUALIDADE-ATUACOES] Erro ao criar atuação:', error);
    
    // Verificar se é erro de duplicação
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Atuação com este nome já existe'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao criar atuação'
    });
  }
});

// GET /api/qualidade/atuacoes - Listar todas as atuações
router.get('/atuacoes', async (req, res) => {
  try {
    global.emitTraffic('Qualidade Atuações', 'received', 'Entrada recebida - GET /api/qualidade/atuacoes');
    global.emitLog('info', 'GET /api/qualidade/atuacoes - Listando atuações');
    
    global.emitTraffic('Qualidade Atuações', 'processing', 'Consultando DB');
    const atuacoes = await QualidadeAtuacoes.find({}).sort({ funcao: 1 });
    
    global.emitTraffic('Qualidade Atuações', 'completed', `Concluído - ${atuacoes.length} atuações encontradas`);
    global.emitLog('success', `GET /api/qualidade/atuacoes - ${atuacoes.length} atuações retornadas`);
    global.emitJson(atuacoes);
    
    res.json({
      success: true,
      data: atuacoes,
      message: `${atuacoes.length} atuações encontradas`
    });
  } catch (error) {
    global.emitTraffic('Qualidade Atuações', 'error', `Erro: ${error.message}`);
    global.emitLog('error', `GET /api/qualidade/atuacoes - Erro: ${error.message}`);
    console.error('[QUALIDADE-ATUACOES] Erro ao listar atuações:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao listar atuações'
    });
  }
});

// PUT /api/qualidade/atuacoes/:id - Atualizar atuação existente
router.put('/atuacoes/:id', validateAtuacao, async (req, res) => {
  try {
    const { id } = req.params;
    global.emitTraffic('Qualidade Atuações', 'received', `Entrada recebida - PUT /api/qualidade/atuacoes/${id}`);
    global.emitLog('info', `PUT /api/qualidade/atuacoes/${id} - Atualizando atuação`);
    global.emitJson(req.body);
    
    // Verificar se atuação existe
    const atuacaoExistente = await QualidadeAtuacoes.findById(id);
    if (!atuacaoExistente) {
      return res.status(404).json({
        success: false,
        message: 'Atuação não encontrada'
      });
    }
    
    const updateData = { ...req.body };
    
    global.emitTraffic('Qualidade Atuações', 'processing', 'Atualizando no DB');
    const atuacaoAtualizada = await QualidadeAtuacoes.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    global.emitTraffic('Qualidade Atuações', 'completed', 'Concluído - Atuação atualizada com sucesso');
    global.emitLog('success', `PUT /api/qualidade/atuacoes/${id} - Atuação "${atuacaoAtualizada.funcao}" atualizada com sucesso`);
    global.emitJson(atuacaoAtualizada);
    
    res.json({
      success: true,
      data: atuacaoAtualizada,
      message: 'Atuação atualizada com sucesso'
    });
  } catch (error) {
    global.emitTraffic('Qualidade Atuações', 'error', `Erro: ${error.message}`);
    global.emitLog('error', `PUT /api/qualidade/atuacoes/${id} - Erro: ${error.message}`);
    console.error('[QUALIDADE-ATUACOES] Erro ao atualizar atuação:', error);
    
    // Verificar se é erro de duplicação
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Atuação com este nome já existe'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao atualizar atuação'
    });
  }
});

// DELETE /api/qualidade/atuacoes/:id - Deletar atuação
router.delete('/atuacoes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    global.emitTraffic('Qualidade Atuações', 'received', `Entrada recebida - DELETE /api/qualidade/atuacoes/${id}`);
    global.emitLog('info', `DELETE /api/qualidade/atuacoes/${id} - Deletando atuação`);
    
    // Verificar se atuação existe
    const atuacaoExistente = await QualidadeAtuacoes.findById(id);
    if (!atuacaoExistente) {
      return res.status(404).json({
        success: false,
        message: 'Atuação não encontrada'
      });
    }
    
    global.emitTraffic('Qualidade Atuações', 'processing', 'Deletando do DB');
    await QualidadeAtuacoes.findByIdAndDelete(id);
    
    global.emitTraffic('Qualidade Atuações', 'completed', 'Concluído - Atuação deletada com sucesso');
    global.emitLog('success', `DELETE /api/qualidade/atuacoes/${id} - Atuação "${atuacaoExistente.funcao}" deletada com sucesso`);
    
    res.json({
      success: true,
      message: 'Atuação deletada com sucesso'
    });
  } catch (error) {
    global.emitTraffic('Qualidade Atuações', 'error', `Erro: ${error.message}`);
    global.emitLog('error', `DELETE /api/qualidade/atuacoes/${id} - Erro: ${error.message}`);
    console.error('[QUALIDADE-ATUACOES] Erro ao deletar atuação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao deletar atuação'
    });
  }
});

// ========================================
// ENDPOINTS PARA FUNÇÕES - COMPLIANCE OBRIGATÓRIO
// ========================================

// GET /api/qualidade/funcoes - Listar todas as funções cadastradas
router.get('/funcoes', async (req, res) => {
  try {
    global.emitTraffic('Qualidade Funções', 'received', 'Entrada recebida - GET /api/qualidade/funcoes');
    global.emitLog('info', 'GET /api/qualidade/funcoes - Listando funções');
    console.log('🔍 [COMPLIANCE] GET /api/qualidade/funcoes - Iniciando listagem');
    
    global.emitTraffic('Qualidade Funções', 'processing', 'Consultando DB');
    // Buscar todas as funções ordenadas por createdAt DESC
    const funcoes = await QualidadeFuncoes.find({}).sort({ createdAt: -1 });
    
    const response = {
      success: true,
      data: funcoes,
      count: funcoes.length
    };
    
    global.emitTraffic('Qualidade Funções', 'completed', `Concluído - ${funcoes.length} funções encontradas`);
    global.emitLog('success', `GET /api/qualidade/funcoes - ${funcoes.length} funções retornadas`);
    global.emitJsonInput(response);
    console.log('🔍 [COMPLIANCE] GET /api/qualidade/funcoes - Response:', response);
    
    res.json(response);
  } catch (error) {
    global.emitTraffic('Qualidade Funções', 'error', `Erro: ${error.message}`);
    global.emitLog('error', `GET /api/qualidade/funcoes - Erro: ${error.message}`);
    console.error('[QUALIDADE-FUNCOES] Erro ao listar funções:', error);
    const response = {
      success: false,
      error: 'Erro interno do servidor ao listar funções'
    };
    console.log('🔍 [COMPLIANCE] GET /api/qualidade/funcoes - Error Response:', response);
    res.status(500).json(response);
  }
});

// POST /api/qualidade/funcoes - Criar nova função
router.post('/funcoes', async (req, res) => {
  try {
    global.emitTraffic('Qualidade Funções', 'received', 'Entrada recebida - POST /api/qualidade/funcoes');
    global.emitLog('info', 'POST /api/qualidade/funcoes - Criando nova função');
    global.emitJson(req.body);
    console.log('🔍 [COMPLIANCE] POST /api/qualidade/funcoes - Body:', req.body);
    
    const { funcao, descricao } = req.body;
    
    // Validação obrigatória: funcao não vazio
    if (!funcao || funcao.trim() === '') {
      const response = {
        success: false,
        error: 'Nome da função é obrigatório'
      };
      global.emitTraffic('Qualidade Funções', 'error', 'Validação falhou - Nome da função é obrigatório');
      global.emitLog('error', 'POST /api/qualidade/funcoes - Validação falhou');
      console.log('🔍 [COMPLIANCE] POST /api/qualidade/funcoes - Validation Error Response:', response);
      return res.status(400).json(response);
    }
    
    global.emitTraffic('Qualidade Funções', 'processing', 'Transmitindo para DB');
    // Criar nova função
    const novaFuncao = new QualidadeFuncoes({
      funcao: funcao.trim(),
      descricao: descricao ? descricao.trim() : ''
    });
    
    const funcaoSalva = await novaFuncao.save();
    
    const response = {
      success: true,
      data: funcaoSalva
    };
    
    global.emitTraffic('Qualidade Funções', 'completed', 'Concluído - Função criada com sucesso');
    global.emitLog('success', `POST /api/qualidade/funcoes - Função "${funcaoSalva.funcao}" criada com sucesso`);
    global.emitJsonInput(response);
    console.log('🔍 [COMPLIANCE] POST /api/qualidade/funcoes - Body:', req.body, 'Response:', response);
    
    res.status(201).json(response);
  } catch (error) {
    global.emitTraffic('Qualidade Funções', 'error', `Erro: ${error.message}`);
    global.emitLog('error', `POST /api/qualidade/funcoes - Erro: ${error.message}`);
    console.error('[QUALIDADE-FUNCOES] Erro ao criar função:', error);
    
    // Verificar se é erro de duplicação
    if (error.code === 11000) {
      const response = {
        success: false,
        error: 'Função já existe'
      };
      console.log('🔍 [COMPLIANCE] POST /api/qualidade/funcoes - Duplication Error Response:', response);
      return res.status(409).json(response);
    }
    
    const response = {
      success: false,
      error: 'Erro interno do servidor ao criar função'
    };
    console.log('🔍 [COMPLIANCE] POST /api/qualidade/funcoes - Error Response:', response);
    res.status(500).json(response);
  }
});

// PUT /api/qualidade/funcoes/:id - Atualizar função existente
router.put('/funcoes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { funcao, descricao } = req.body;
    
    global.emitTraffic('Qualidade Funções', 'received', `Entrada recebida - PUT /api/qualidade/funcoes/${id}`);
    global.emitLog('info', `PUT /api/qualidade/funcoes/${id} - Atualizando função`);
    global.emitJson(req.body);
    console.log('🔍 [COMPLIANCE] PUT /api/qualidade/funcoes/:id - Body:', req.body);
    
    // Validar ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const response = {
        success: false,
        error: 'ID inválido'
      };
      global.emitTraffic('Qualidade Funções', 'error', 'ID inválido');
      global.emitLog('error', `PUT /api/qualidade/funcoes/${id} - ID inválido`);
      console.log('🔍 [COMPLIANCE] PUT /api/qualidade/funcoes/:id - Invalid ID Response:', response);
      return res.status(400).json(response);
    }
    
    // Validação obrigatória: funcao não vazio
    if (!funcao || funcao.trim() === '') {
      const response = {
        success: false,
        error: 'Nome da função é obrigatório'
      };
      global.emitTraffic('Qualidade Funções', 'error', 'Validação falhou - Nome da função é obrigatório');
      global.emitLog('error', `PUT /api/qualidade/funcoes/${id} - Validação falhou`);
      console.log('🔍 [COMPLIANCE] PUT /api/qualidade/funcoes/:id - Validation Error Response:', response);
      return res.status(400).json(response);
    }
    
    // Verificar se função existe
    const funcaoExistente = await QualidadeFuncoes.findById(id);
    if (!funcaoExistente) {
      const response = {
        success: false,
        error: 'Função não encontrada'
      };
      global.emitTraffic('Qualidade Funções', 'error', 'Função não encontrada');
      global.emitLog('error', `PUT /api/qualidade/funcoes/${id} - Função não encontrada`);
      console.log('🔍 [COMPLIANCE] PUT /api/qualidade/funcoes/:id - Not Found Response:', response);
      return res.status(404).json(response);
    }
    
    global.emitTraffic('Qualidade Funções', 'processing', 'Atualizando no DB');
    // Atualizar função
    const updateData = {
      funcao: funcao.trim(),
      descricao: descricao ? descricao.trim() : '',
      updatedAt: new Date()
    };
    
    const funcaoAtualizada = await QualidadeFuncoes.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    const response = {
      success: true,
      data: funcaoAtualizada
    };
    
    global.emitTraffic('Qualidade Funções', 'completed', 'Concluído - Função atualizada com sucesso');
    global.emitLog('success', `PUT /api/qualidade/funcoes/${id} - Função "${funcaoAtualizada.funcao}" atualizada com sucesso`);
    global.emitJsonInput(response);
    console.log('🔍 [COMPLIANCE] PUT /api/qualidade/funcoes/:id - Body:', req.body, 'Response:', response);
    
    res.json(response);
  } catch (error) {
    global.emitTraffic('Qualidade Funções', 'error', `Erro: ${error.message}`);
    global.emitLog('error', `PUT /api/qualidade/funcoes/${id} - Erro: ${error.message}`);
    console.error('[QUALIDADE-FUNCOES] Erro ao atualizar função:', error);
    
    // Verificar se é erro de duplicação
    if (error.code === 11000) {
      const response = {
        success: false,
        error: 'Função já existe'
      };
      console.log('🔍 [COMPLIANCE] PUT /api/qualidade/funcoes/:id - Duplication Error Response:', response);
      return res.status(409).json(response);
    }
    
    const response = {
      success: false,
      error: 'Erro interno do servidor ao atualizar função'
    };
    console.log('🔍 [COMPLIANCE] PUT /api/qualidade/funcoes/:id - Error Response:', response);
    res.status(500).json(response);
  }
});

// DELETE /api/qualidade/funcoes/:id - Deletar função
router.delete('/funcoes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    global.emitTraffic('Qualidade Funções', 'received', `Entrada recebida - DELETE /api/qualidade/funcoes/${id}`);
    global.emitLog('info', `DELETE /api/qualidade/funcoes/${id} - Deletando função`);
    console.log('🔍 [COMPLIANCE] DELETE /api/qualidade/funcoes/:id - Iniciando deleção');
    
    // Validar ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const response = {
        success: false,
        error: 'ID inválido'
      };
      global.emitTraffic('Qualidade Funções', 'error', 'ID inválido');
      global.emitLog('error', `DELETE /api/qualidade/funcoes/${id} - ID inválido`);
      console.log('🔍 [COMPLIANCE] DELETE /api/qualidade/funcoes/:id - Invalid ID Response:', response);
      return res.status(400).json(response);
    }
    
    // Verificar se função existe
    const funcaoExistente = await QualidadeFuncoes.findById(id);
    if (!funcaoExistente) {
      const response = {
        success: false,
        error: 'Função não encontrada'
      };
      global.emitTraffic('Qualidade Funções', 'error', 'Função não encontrada');
      global.emitLog('error', `DELETE /api/qualidade/funcoes/${id} - Função não encontrada`);
      console.log('🔍 [COMPLIANCE] DELETE /api/qualidade/funcoes/:id - Not Found Response:', response);
      return res.status(404).json(response);
    }
    
    global.emitTraffic('Qualidade Funções', 'processing', 'Verificando uso por funcionários');
    // Verificar se há funcionários usando esta função
    const funcionariosUsandoFuncao = await QualidadeFuncionario.find({
      $or: [
        { atuacao: funcaoExistente.funcao }, // Dados antigos (string)
        { atuacao: { $in: [id] } } // Dados novos (array de ObjectIds)
      ]
    });
    
    if (funcionariosUsandoFuncao.length > 0) {
      const response = {
        success: false,
        error: 'Função está em uso por funcionários. Não é possível deletar.'
      };
      global.emitTraffic('Qualidade Funções', 'error', 'Função em uso por funcionários');
      global.emitLog('error', `DELETE /api/qualidade/funcoes/${id} - Função em uso`);
      console.log('🔍 [COMPLIANCE] DELETE /api/qualidade/funcoes/:id - In Use Error Response:', response);
      return res.status(409).json(response);
    }
    
    global.emitTraffic('Qualidade Funções', 'processing', 'Deletando do DB');
    // Deletar função
    await QualidadeFuncoes.findByIdAndDelete(id);
    
    const response = {
      success: true,
      message: 'Função deletada com sucesso'
    };
    
    global.emitTraffic('Qualidade Funções', 'completed', 'Concluído - Função deletada com sucesso');
    global.emitLog('success', `DELETE /api/qualidade/funcoes/${id} - Função "${funcaoExistente.funcao}" deletada com sucesso`);
    global.emitJsonInput(response);
    console.log('🔍 [COMPLIANCE] DELETE /api/qualidade/funcoes/:id - Response:', response);
    
    res.json(response);
  } catch (error) {
    global.emitTraffic('Qualidade Funções', 'error', `Erro: ${error.message}`);
    global.emitLog('error', `DELETE /api/qualidade/funcoes/${id} - Erro: ${error.message}`);
    console.error('[QUALIDADE-FUNCOES] Erro ao deletar função:', error);
    const response = {
      success: false,
      error: 'Erro interno do servidor ao deletar função'
    };
    console.log('🔍 [COMPLIANCE] DELETE /api/qualidade/funcoes/:id - Error Response:', response);
    res.status(500).json(response);
  }
});

module.exports = router;

// VERSION: v5.2.0 | DATE: 2024-12-19 | AUTHOR: Lucas Gravina - VeloHub Development Team
