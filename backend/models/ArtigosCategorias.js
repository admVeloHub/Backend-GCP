// VERSION: v1.1.0 | DATE: 2026-03-26 | AUTHOR: VeloHub Development Team
const { getDatabase } = require('../config/database');
const { ObjectId } = require('mongodb');

/** Um único documento na collection (mesmo _id em seed e em todas as atualizações). */
const SINGLETON_OBJECT_ID = new ObjectId('674e2f0d0001000000000001');

function tituloParaSnakeCase(str) {
  if (!str || typeof str !== 'string') return '';
  const normalized = str.normalize('NFD').replace(/\p{M}/gu, '');
  let s = normalized.toLowerCase().trim();
  s = s.replace(/[^a-z0-9]+/g, '_');
  s = s.replace(/^_+|_+$/g, '');
  s = s.replace(/_+/g, '_');
  return s || '';
}

function uniqueSnakeIdsForTitles(titulos) {
  const used = new Set();
  const result = [];
  for (const t of titulos) {
    let base = tituloParaSnakeCase(t);
    if (!base) base = 'categoria';
    let candidate = base;
    let n = 2;
    while (used.has(candidate)) {
      candidate = `${base}_${n}`;
      n += 1;
    }
    used.add(candidate);
    result.push(candidate);
  }
  return result;
}

class ArtigosCategorias {
  constructor() {
    this.collectionName = 'artigos_categorias';
  }

  getCollection() {
    const db = getDatabase();
    return db.collection(this.collectionName);
  }

  /**
   * Ordena por Ordem do cliente, renumera 1..n, recalcula categoria_id (snake_case + colisões).
   */
  validateCategorias(raw) {
    if (!Array.isArray(raw)) {
      return { valid: false, error: 'Categorias deve ser um array' };
    }
    if (raw.length === 0) {
      return { valid: false, error: 'Informe ao menos uma categoria' };
    }

    const rows = [];
    for (let i = 0; i < raw.length; i++) {
      const item = raw[i];
      const o = item.Ordem !== undefined ? item.Ordem : item.ordem;
      const ordemNum = Number(o);
      if (!Number.isInteger(ordemNum) || ordemNum < 1) {
        return {
          valid: false,
          error: `Item ${i + 1}: Ordem deve ser um inteiro maior ou igual a 1`
        };
      }
      const categoria_titulo =
        typeof item.categoria_titulo === 'string' ? item.categoria_titulo.trim() : '';
      if (!categoria_titulo) {
        return {
          valid: false,
          error: `Item ${i + 1}: categoria_titulo é obrigatório`
        };
      }
      rows.push({ ordem: ordemNum, categoria_titulo, stableIdx: i });
    }

    rows.sort((a, b) => {
      if (a.ordem !== b.ordem) return a.ordem - b.ordem;
      return a.stableIdx - b.stableIdx;
    });

    const titulos = rows.map((r) => r.categoria_titulo);
    const ids = uniqueSnakeIdsForTitles(titulos);
    const normalized = rows.map((r, i) => ({
      Ordem: i + 1,
      categoria_titulo: titulos[i],
      categoria_id: ids[i]
    }));

    return { valid: true, normalized };
  }

  async getSingleton() {
    try {
      const collection = this.getCollection();
      const doc = await collection.findOne({ _id: SINGLETON_OBJECT_ID });
      if (!doc) {
        return {
          success: false,
          error: 'Documento de categorias não encontrado'
        };
      }
      return { success: true, data: doc };
    } catch (error) {
      console.error('Erro ao obter categorias artigos:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  /**
   * Substitui o array Categorias no documento singleton (updateOne + upsert no mesmo _id).
   */
  async replaceCategorias(categoriasInput) {
    try {
      const validation = this.validateCategorias(categoriasInput);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const collection = this.getCollection();
      const now = new Date();
      await collection.updateOne(
        { _id: SINGLETON_OBJECT_ID },
        {
          $set: {
            Categorias: validation.normalized,
            updatedAt: now
          },
          $setOnInsert: {
            createdAt: now
          }
        },
        { upsert: true }
      );

      const doc = await collection.findOne({ _id: SINGLETON_OBJECT_ID });
      return {
        success: true,
        data: doc,
        message: 'Categorias atualizadas com sucesso'
      };
    } catch (error) {
      console.error('Erro ao substituir categorias artigos:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }
}

module.exports = new ArtigosCategorias();
