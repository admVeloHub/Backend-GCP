// VERSION: v1.1.0 | DATE: 2026-05-28 | AUTHOR: VeloHub Development Team
const mongoose = require('mongoose');
const { getFuncionariosDatabase } = require('../config/database');
const { FUNCIONARIOS_COLLECTIONS } = require('../config/funcionariosCollections');

function isObjectIdString(value) {
  if (value == null) return false;
  const str = String(value).trim();
  return mongoose.Types.ObjectId.isValid(str) && String(new mongoose.Types.ObjectId(str)) === str;
}

/** Extrai nome por extenso de item legado (ObjectId, string ou { funcao }). */
function extrairNomeAtuacao(item) {
  if (item == null) return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item === 'object' && item.funcao != null) return String(item.funcao).trim();
  const str = String(item).trim();
  return isObjectIdString(str) ? '' : str;
}

/**
 * Normaliza atuacao para [{ funcao: "Nome por extenso" }, ...]
 * Aceita legado: string, ObjectId, { funcao }, array misto.
 */
async function normalizarAtuacaoParaObjetos(atuacaoRaw) {
  if (atuacaoRaw == null) return [];

  let items = [];
  if (typeof atuacaoRaw === 'string') {
    const t = atuacaoRaw.trim();
    items = t ? [t] : [];
  } else if (Array.isArray(atuacaoRaw)) {
    items = atuacaoRaw.filter((x) => x != null);
  } else if (typeof atuacaoRaw === 'object' && atuacaoRaw.funcao != null) {
    items = [atuacaoRaw];
  } else {
    return [];
  }

  const objectIds = [];
  const nomesDiretos = [];

  items.forEach((item) => {
    if (item && typeof item === 'object' && item._bsontype === 'ObjectId') {
      objectIds.push(item);
      return;
    }
    const str = typeof item === 'object' ? '' : String(item).trim();
    if (isObjectIdString(str)) {
      objectIds.push(new mongoose.Types.ObjectId(str));
      return;
    }
    const nome = extrairNomeAtuacao(item);
    if (nome) nomesDiretos.push(nome);
  });

  const nomesResolvidos = [...nomesDiretos];

  if (objectIds.length > 0) {
    const col = getFuncionariosDatabase().collection(FUNCIONARIOS_COLLECTIONS.ATUACOES);
    const docs = await col.find({ _id: { $in: objectIds } }).toArray();
    docs.forEach((doc) => {
      const nome = doc?.funcao != null ? String(doc.funcao).trim() : '';
      if (nome) nomesResolvidos.push(nome);
    });
    // Fallback: ids podem ser legado qualidade_funcoes
    if (docs.length < objectIds.length) {
      const analisesDb = require('../config/database').getAnalisesDatabase?.();
      if (analisesDb) {
        const legado = await analisesDb.collection('qualidade_funcoes').find({ _id: { $in: objectIds } }).toArray();
        legado.forEach((doc) => {
          const nome = doc?.funcao != null ? String(doc.funcao).trim() : '';
          if (nome) nomesResolvidos.push(nome);
        });
      }
    }
  }

  if (nomesResolvidos.length === 0 && items.length > 0) {
    throw new Error('Não foi possível resolver atuacao para nomes por extenso');
  }

  const seen = new Set();
  const out = [];
  nomesResolvidos.forEach((nome) => {
    const key = nome.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ funcao: nome });
  });
  return out;
}

/** Lista de nomes para exibição/filtro no Console */
function atuacaoParaNomes(atuacaoRaw, funcoesLista = []) {
  if (atuacaoRaw == null) return [];
  if (typeof atuacaoRaw === 'string') {
    const t = atuacaoRaw.trim();
    return t ? [t] : [];
  }
  if (!Array.isArray(atuacaoRaw)) return [];

  const byId = new Map(
    (funcoesLista || []).map((f) => [String(f._id), String(f.funcao || '').trim()])
  );

  const out = [];
  const seen = new Set();
  atuacaoRaw.forEach((item) => {
    let nome = extrairNomeAtuacao(item);
    if (!nome) {
      const str = String(item).trim();
      if (isObjectIdString(str)) nome = byId.get(str) || '';
    }
    if (!nome) return;
    const key = nome.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(nome);
  });
  return out;
}

module.exports = {
  normalizarAtuacaoParaObjetos,
  normalizarAtuacaoParaStrings: normalizarAtuacaoParaObjetos, // alias legado
  atuacaoParaNomes,
  atuacaoParaExibicao: atuacaoParaNomes,
  extrairNomeAtuacao,
  isObjectIdString,
};
