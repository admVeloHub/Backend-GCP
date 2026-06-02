// VERSION: v1.0.0 | DATE: 2026-05-28 | AUTHOR: VeloHub Development Team
/** Nomes de database/collections — console_funcionarios (FONTE DA VERDADE/LISTA_SCHEMAS.rb) */

const FUNCIONARIOS_DB_NAME = process.env.CONSOLE_FUNCIONARIOS_DB || 'console_funcionarios';

const FUNCIONARIOS_COLLECTIONS = {
  CADASTRO: 'funcionarios_cadastroColaboradores',
  ATUACOES: 'gerenciamento_atuacoes',
  HUB_SESSIONS: 'hub_sessions',
  OPCOES_CADASTRO: 'gerenciamento_opcoesCadastro',
};

module.exports = {
  FUNCIONARIOS_DB_NAME,
  FUNCIONARIOS_COLLECTIONS,
};
