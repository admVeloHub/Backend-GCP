/**
 * qualidadeAudioAnaliseNormalize.js
 * Normaliza documentos audio_analise_results (novo LISTA + legado) para view model unificado.
 *
 * VERSION: v1.0.0
 * DATE: 2026-06-05
 * AUTHOR: VeloHub Development Team
 */

const mongoose = require('mongoose');

const asNum = (x) => {
  if (typeof x === 'number' && !Number.isNaN(x)) return x;
  if (typeof x === 'string' && x.trim() !== '') {
    const n = Number(x);
    return Number.isNaN(n) ? null : n;
  }
  return null;
};

const idToString = (v) => {
  if (v == null) return null;
  if (typeof v === 'object' && v._id != null) return String(v._id);
  return String(v);
};

/**
 * Resolve transcricao: novo array estruturado; legado string vazia (sem role/fala).
 */
function resolveTranscricao(doc) {
  if (Array.isArray(doc.transcricao) && doc.transcricao.length > 0) {
    return doc.transcricao
      .filter((t) => t && (t.role != null || t.fala != null))
      .map((t) => ({
        role: t.role != null ? String(t.role) : '',
        fala: t.fala != null ? String(t.fala) : ''
      }));
  }
  return [];
}

function resolveAnaliseDialogo(doc) {
  if (doc.analiseDialogo && typeof doc.analiseDialogo === 'object') {
    return doc.analiseDialogo;
  }
  return null;
}

function resolveCriteriosDetalhados(doc) {
  if (doc.criteriosDetalhados && typeof doc.criteriosDetalhados === 'object') {
    return { ...doc.criteriosDetalhados };
  }
  const g = doc.gptAnalysis;
  const q = doc.qualityAnalysis;
  if (g && g.criterios && typeof g.criterios === 'object') return { ...g.criterios };
  if (q && q.criterios && typeof q.criterios === 'object') return { ...q.criterios };
  return {};
}

function resolvePontuacaoCalculada(doc) {
  let p = asNum(doc.pontuacaoCalculada);
  if (p != null) return p;
  p = asNum(doc.pontuacaoConsensual);
  if (p != null) return p;
  if (doc.gptAnalysis) {
    p = asNum(doc.gptAnalysis.pontuacao);
    if (p != null) return p;
  }
  if (doc.qualityAnalysis) {
    p = asNum(doc.qualityAnalysis.pontuacao);
    if (p != null) return p;
  }
  return null;
}

function resolveObservacaoGPT(doc) {
  if (doc.observacaoGPT != null && String(doc.observacaoGPT).trim()) {
    return String(doc.observacaoGPT).trim();
  }
  const candidates = [
    doc.gptAnalysis?.analysis,
    doc.qualityAnalysis?.analysis,
    doc.analysis,
    doc.resumoAnalise,
    doc.resumo
  ];
  for (let i = 0; i < candidates.length; i += 1) {
    const c = candidates[i];
    if (c != null && String(c).trim()) return String(c).trim();
  }
  return '';
}

function resolvePalavrasCriticas(doc) {
  if (Array.isArray(doc.palavrasCriticas) && doc.palavrasCriticas.length > 0) {
    return doc.palavrasCriticas;
  }
  if (Array.isArray(doc.gptAnalysis?.palavrasCriticas) && doc.gptAnalysis.palavrasCriticas.length > 0) {
    return doc.gptAnalysis.palavrasCriticas;
  }
  if (Array.isArray(doc.qualityAnalysis?.palavrasCriticas) && doc.qualityAnalysis.palavrasCriticas.length > 0) {
    return doc.qualityAnalysis.palavrasCriticas;
  }
  return [];
}

/**
 * ID da avaliação monitor (qualidade_avaliacoes).
 */
function resolveAvaliacaoId(doc) {
  if (doc.avaliacao_id != null) return idToString(doc.avaliacao_id);
  if (doc.avaliacaoMonitorId != null) return idToString(doc.avaliacaoMonitorId);
  return null;
}

/**
 * Objeto populado da avaliação monitor (se houver).
 */
function resolveAvaliacaoPopulada(doc) {
  const pop = doc.avaliacaoMonitorId;
  if (pop && typeof pop === 'object' && pop.colaboradorNome != null) return pop;
  const popId = doc.avaliacao_id;
  if (popId && typeof popId === 'object' && popId.colaboradorNome != null) return popId;
  return null;
}

/**
 * Monta filtro $or para buscar por id de avaliação (novo + legado).
 */
function buildAvaliacaoIdOrFilter(rawId) {
  const or = [];
  const s = String(rawId || '').trim();
  if (!s) return or;
  or.push({ avaliacao_id: s }, { avaliacaoMonitorId: s });
  if (mongoose.Types.ObjectId.isValid(s)) {
    try {
      const oid = new mongoose.Types.ObjectId(s);
      or.push({ avaliacao_id: oid }, { avaliacaoMonitorId: oid });
    } catch (_) {
      /* ignore */
    }
  }
  return or;
}

/**
 * Normaliza documento Mongo (plain object) para resposta unificada ao Console.
 * Preserva campos originais e adiciona/sobrescreve campos normalizados.
 */
function normalizeAudioAnaliseResultForClient(doc, extras = {}) {
  if (!doc || typeof doc !== 'object') return null;

  const avaliacaoPop = resolveAvaliacaoPopulada(doc);
  const avaliacaoId = resolveAvaliacaoId(doc);
  const pontuacaoCalculada = resolvePontuacaoCalculada(doc);
  const observacaoGPT = resolveObservacaoGPT(doc);
  const criteriosDetalhados = resolveCriteriosDetalhados(doc);
  const transcricao = resolveTranscricao(doc);
  const analiseDialogo = resolveAnaliseDialogo(doc);
  const palavrasCriticas = resolvePalavrasCriticas(doc);

  const colaboradorNome =
    extras.colaboradorNome ??
    doc.colaboradorNome ??
    avaliacaoPop?.colaboradorNome ??
    null;

  const nomeArquivoAudio =
    doc.nomeArquivoAudio ?? doc.nomeArquivo ?? null;

  return {
    ...doc,
    avaliacaoId,
    avaliacao_id: avaliacaoId,
    colaboradorNome,
    nomeArquivoAudio,
    transcricao,
    analiseDialogo,
    criteriosDetalhados,
    pontuacaoCalculada,
    pontuacaoGPT: pontuacaoCalculada,
    observacaoGPT,
    palavrasCriticas,
    dataLigacao: extras.dataLigacao ?? doc.dataLigacao ?? avaliacaoPop?.dataLigacao ?? null,
    horaLigacao: extras.horaLigacao ?? doc.horaLigacao ?? avaliacaoPop?.horaLigacao ?? null
  };
}

module.exports = {
  normalizeAudioAnaliseResultForClient,
  buildAvaliacaoIdOrFilter,
  resolveAvaliacaoId,
  resolveTranscricao,
  resolveCriteriosDetalhados,
  resolvePontuacaoCalculada,
  resolveObservacaoGPT
};
