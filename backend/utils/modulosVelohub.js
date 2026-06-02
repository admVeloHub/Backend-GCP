// VERSION: v1.0.0 | DATE: 2026-05-28 | AUTHOR: VeloHub Development Team
/** Chaves de visibilidade VeloHub (qualidade_funcoes.modulosVelohub / hub_sessions.permissoesVelohub) */

const MODULOS_VELOHUB_KEYS = [
  'corporativo',
  'atendimento',
  'liberacaoPix',
  'acompanhamento',
  'reclamacoes',
  'sociais',
];

const MODULOS_VELOHUB_PADRAO = () =>
  Object.fromEntries(MODULOS_VELOHUB_KEYS.map((k) => [k, false]));

/**
 * Objeto flat zerado para permissoesVelohub (snapshot de sessão).
 */
function permissoesVelohubPadrao() {
  return MODULOS_VELOHUB_PADRAO();
}

/**
 * Normaliza um objeto de flags para as 6 chaves booleanas.
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
  return base;
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
  });
  return [hasAny ? merged : MODULOS_VELOHUB_PADRAO()];
}

/**
 * Merge OR entre documentos qualidade_funcoes → permissoesVelohub flat.
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
  return out;
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
    out.reclamacoes = true;
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
  aplicarFallbackAcessosLegado,
  normalizarAcessosPlataforma,
};
