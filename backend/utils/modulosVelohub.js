// VERSION: v1.2.0 | DATE: 2026-06-01 | AUTHOR: VeloHub Development Team
// CHANGELOG: v1.2.0 - Reclamações N1/N2; retrocompat reclamacoes → N2; fallback Ouvidoria → reclamacoesN2
// CHANGELOG: v1.1.0 - Chave velobot em modulosVelohub / permissoesVelohub (retrocompat atendimento)
/** Chaves de visibilidade VeloHub (gerenciamento_atuacoes.modulosVelohub / hub_sessions.permissoesVelohub) */

const MODULOS_VELOHUB_KEYS = [
  'corporativo',
  'atendimento',
  'velobot',
  'liberacaoPix',
  'acompanhamento',
  'reclamacoesN1',
  'reclamacoesN2',
  'sociais',
];

const MODULOS_VELOHUB_PADRAO = () =>
  Object.fromEntries(MODULOS_VELOHUB_KEYS.map((k) => [k, false]));

function temChaveExplicita(obj, key) {
  return obj && Object.prototype.hasOwnProperty.call(obj, key);
}

function reclamacoesAcessoTodasAbas(perm) {
  if (!perm || typeof perm !== 'object') return false;
  if (perm.reclamacoesN2 === true) return true;
  const hasN1 = temChaveExplicita(perm, 'reclamacoesN1');
  const hasN2 = temChaveExplicita(perm, 'reclamacoesN2');
  if (perm.reclamacoes === true && !hasN1 && !hasN2) return true;
  return false;
}

function reclamacoesModuloPermitido(perm) {
  if (!perm || typeof perm !== 'object') return false;
  if (reclamacoesAcessoTodasAbas(perm)) return true;
  return perm.reclamacoesN1 === true;
}

/**
 * Objeto flat zerado para permissoesVelohub (snapshot de sessão).
 */
function permissoesVelohubPadrao() {
  return MODULOS_VELOHUB_PADRAO();
}

/**
 * Normaliza um objeto de flags para as chaves booleanas.
 * @param {unknown} obj
 * @returns {Record<string, boolean>}
 */
function normalizarObjetoModulos(obj) {
  const base = MODULOS_VELOHUB_PADRAO();
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return base;
  }
  MODULOS_VELOHUB_KEYS.forEach((k) => {
    base[k] = obj[k] === true;
  });
  aplicarRetrocompatReclamacoesNoItem(obj, base);
  return base;
}

function aplicarRetrocompatVelobotNoItem(item, merged) {
  if (!item || typeof item !== 'object') return;
  const hasVelobotKey =
    Object.prototype.hasOwnProperty.call(item, 'velobot') ||
    Object.prototype.hasOwnProperty.call(item, 'VeloBot');
  if (!hasVelobotKey && item.atendimento === true) {
    merged.velobot = true;
  }
}

function aplicarRetrocompatReclamacoesNoItem(item, merged) {
  if (!item || typeof item !== 'object') return;
  const hasN1 = Object.prototype.hasOwnProperty.call(item, 'reclamacoesN1');
  const hasN2 = Object.prototype.hasOwnProperty.call(item, 'reclamacoesN2');
  if (!hasN1 && !hasN2 && item.reclamacoes === true) {
    merged.reclamacoesN2 = true;
  }
}

/**
 * Normaliza modulosVelohub para array com um objeto completo (OR se múltiplos).
 * @param {unknown} input
 * @returns {Array<Record<string, boolean>>}
 */
function normalizarModulosVelohub(input) {
  if (input == null) {
    return [MODULOS_VELOHUB_PADRAO()];
  }
  const items = Array.isArray(input) ? input : [input];
  const merged = MODULOS_VELOHUB_PADRAO();
  let hasAny = false;
  items.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    hasAny = true;
    MODULOS_VELOHUB_KEYS.forEach((k) => {
      if (item[k] === true) merged[k] = true;
    });
    aplicarRetrocompatVelobotNoItem(item, merged);
    aplicarRetrocompatReclamacoesNoItem(item, merged);
  });
  return [hasAny ? merged : MODULOS_VELOHUB_PADRAO()];
}

/**
 * Merge OR entre documentos gerenciamento_atuacoes → permissoesVelohub flat.
 * @param {Array<{ modulosVelohub?: unknown }>} funcoesDocs
 * @returns {Record<string, boolean>}
 */
function agregarPermissoesVelohub(funcoesDocs) {
  const out = MODULOS_VELOHUB_PADRAO();
  if (!Array.isArray(funcoesDocs)) return out;
  funcoesDocs.forEach((doc) => {
    const arr = normalizarModulosVelohub(doc?.modulosVelohub);
    const flat = arr[0] || MODULOS_VELOHUB_PADRAO();
    MODULOS_VELOHUB_KEYS.forEach((k) => {
      if (flat[k] === true) out[k] = true;
    });
  });
  aplicarRetrocompatReclamacoesNoItem(out, out);
  return out;
}

/**
 * Permissão efetiva para leitura (retrocompat velobot ← atendimento; reclamacoes ← N2).
 * @param {Record<string, boolean>|null} permissoes
 * @param {string} chave
 */
function permissaoModuloAtiva(permissoes, chave) {
  if (!permissoes || typeof permissoes !== 'object') return false;
  if (chave === 'velobot') {
    if (permissoes.velobot === true) return true;
    if (permissoes.velobot === false) return false;
    return permissoes.atendimento === true;
  }
  if (chave === 'reclamacoes') {
    return reclamacoesModuloPermitido(permissoes);
  }
  return permissoes[chave] === true;
}

/**
 * Aplica fallback de acessos legados do funcionário (leitura dupla).
 * @param {Record<string, boolean>} permissoes
 * @param {object} acessosLegado
 */
function aplicarFallbackAcessosLegado(permissoes, acessosLegado) {
  if (!acessosLegado || typeof acessosLegado !== 'object') return permissoes;
  const temAlgum = MODULOS_VELOHUB_KEYS.some((k) => permissoes[k] === true);
  if (temAlgum) return permissoes;
  const out = { ...permissoes };
  if (acessosLegado.Ouvidoria === true || acessosLegado.ouvidoria === true) {
    out.reclamacoesN2 = true;
  }
  if (acessosLegado.Sociais === true || acessosLegado.sociais === true) {
    out.sociais = true;
  }
  if (acessosLegado.apoioN1 === true || acessosLegado.apoion1 === true) {
    out.acompanhamento = true;
  }
  if (acessosLegado.ChavePix === true || acessosLegado.chavepix === true) {
    out.liberacaoPix = true;
  }
  return out;
}

/**
 * Remove chaves de módulo interno VeloHub do objeto acessos (só plataformas em writes).
 * @param {unknown} acessos
 * @returns {object|null}
 */
function normalizarAcessosPlataforma(acessos) {
  const plataformaKeys = ['Velohub', 'Console', 'Academy', 'Desk', 'realTime'];
  if (!acessos || typeof acessos !== 'object' || Array.isArray(acessos)) {
    return {
      Velohub: false,
      Console: false,
      Academy: false,
      Desk: false,
      realTime: false,
    };
  }
  return {
    Velohub: acessos.Velohub === true,
    Console: acessos.Console === true,
    Academy: acessos.Academy === true,
    Desk: acessos.Desk === true,
    realTime: acessos.realTime === true,
  };
}

module.exports = {
  MODULOS_VELOHUB_KEYS,
  MODULOS_VELOHUB_PADRAO,
  permissoesVelohubPadrao,
  normalizarObjetoModulos,
  normalizarModulosVelohub,
  agregarPermissoesVelohub,
  permissaoModuloAtiva,
  reclamacoesModuloPermitido,
  aplicarFallbackAcessosLegado,
  normalizarAcessosPlataforma,
};
