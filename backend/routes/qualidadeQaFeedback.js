// VERSION: v1.5.0 | DATE: 2026-04-30 | AUTHOR: VeloHub Development Team
// CHANGELOG: v1.5.0 - GET /atendimento-trophy/xp-total (matriz Baixo/Normal/Alto/Especial → 50/100/150/250; join qa_trophies)
// CHANGELOG: v1.4.0 - POST /atendimento-trophy → academy_registros.atendimento_trophies (LISTA_SCHEMAS; id UUID + qaTrophyId + colaborador; legado opcional)
// CHANGELOG: v1.3.1 - qa_trophies_catalog vazio: limpa espelho qa_trophy_config
// CHANGELOG: v1.3.0 - valores_campos qa_trophies_catalog (array trophies); espelho do 1º item em qa_trophy_config
// CHANGELOG: v1.2.0 - qa_trophy_config.xpClass: string Baixo|Normal|Alto|Especial (legado numérico mapeado)
// CHANGELOG: v1.1.0 - valores_campos: GET listagem + PUT upsert por id fixo (cadastro_campos, catálogos feedback, qa_trophy_config)
// CHANGELOG: v1.0.3 - GET valores-campos: connectToDatabase + getConfigDatabase (mongo driver nativo); evita 500 (conn.db mongoose / pedido antes do connect no server.listen)
// CHANGELOG: v1.0.2 - buildGenerationPrompt: destaques e apontamentos aceitam string ou array (join "; ")
// CHANGELOG: v1.0.1 - JSDoc do POST /qa-feedback/gerar (body + env de prompts)
// Rotas aditivas: … POST atendimento-trophy, GET atendimento-trophy/xp-total
const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { connectToDatabase, getConfigDatabase, getAcademyDatabase, getAnalisesDatabase, getFuncionariosDatabase } = require('../config/database');
const { FUNCIONARIOS_COLLECTIONS } = require('../config/funcionariosCollections');
const { resolveQaTrophyXp } = require('../lib/conquistaXpMatrix');
const QaFeedback = require('../models/QaFeedback');
const { generateQaFeedbackEmail } = require('../services/geminiService');
const defaults = require('../lib/qaFeedbackPromptDefaults');

function escapeMongoRegexLiteral(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function primeiroNome(nome) {
  const s = String(nome || '').trim();
  return s ? s.split(/\s+/)[0] : '';
}

/** Aceita string (legado) ou array de strings (multi-seleção no Console); texto único no prompt. */
function asTextoCampoQa(v) {
  if (v == null) return '';
  if (Array.isArray(v)) {
    return v
      .map((x) => (x != null ? String(x).trim() : ''))
      .filter(Boolean)
      .join('; ');
  }
  return String(v).trim();
}

function normalizeValoresCampoDoc(doc) {
  if (!doc || typeof doc !== 'object') {
    return [];
  }
  const out = [];
  const pushLabelValue = (label, value) => {
    const v = value != null ? String(value).trim() : '';
    const l = label != null ? String(label).trim() : v;
    if (!v && !l) return;
    out.push({ value: v || l, label: l || v });
  };

  if (Array.isArray(doc.itens)) {
    doc.itens.forEach((item) => {
      if (typeof item === 'string') {
        pushLabelValue(item, item);
      } else if (item && typeof item === 'object') {
        pushLabelValue(item.label || item.nome || item.texto, item.value || item.valor || item.label);
      }
    });
  }
  if (Array.isArray(doc.opcoes)) {
    doc.opcoes.forEach((o) => {
      if (typeof o === 'string') pushLabelValue(o, o);
      else if (o && typeof o === 'object') pushLabelValue(o.label, o.value);
    });
  }
  if (Array.isArray(doc.valores)) {
    doc.valores.forEach((v) => {
      if (typeof v === 'string') pushLabelValue(v, v);
    });
  }
  if (Array.isArray(doc.destaques)) {
    doc.destaques.forEach((v) => {
      if (typeof v === 'string') pushLabelValue(v, v);
    });
  }
  if (Array.isArray(doc.oportunidades)) {
    doc.oportunidades.forEach((v) => {
      if (typeof v === 'string') pushLabelValue(v, v);
    });
  }
  if (Array.isArray(doc.apontamentos)) {
    doc.apontamentos.forEach((v) => {
      if (typeof v === 'string') pushLabelValue(v, v);
    });
  }
  if (Array.isArray(doc.escalas)) {
    doc.escalas.forEach((v) => {
      if (typeof v === 'string') pushLabelValue(v, v);
    });
  }
  if (Array.isArray(doc.empresas)) {
    doc.empresas.forEach((v) => {
      if (typeof v === 'string') pushLabelValue(v, v);
    });
  }
  if (typeof doc.conteudo === 'string' && doc.conteudo.trim()) {
    doc.conteudo.split(/\r?\n/).forEach((line) => {
      const t = line.trim();
      if (t) pushLabelValue(t, t);
    });
  }
  if (typeof doc.texto === 'string' && doc.texto.trim()) {
    doc.texto.split(/\r?\n/).forEach((line) => {
      const t = line.trim();
      if (t) pushLabelValue(t, t);
    });
  }

  const seen = new Set();
  return out.filter((o) => {
    const k = `${o.label}::${o.value}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const QA_TROPHY_XP_CLASS_LABELS = ['Baixo', 'Normal', 'Alto', 'Especial'];

/** xpClass no doc: rótulo fixo ou número legado (0–3) → um dos quatro rótulos. */
function normalizeQaTrophyXpClass(raw) {
  if (raw == null || raw === '') return 'Normal';
  const s = String(raw).trim();
  if (QA_TROPHY_XP_CLASS_LABELS.includes(s)) return s;
  const n = Number(raw);
  if (Number.isFinite(n)) {
    const idx = Math.max(0, Math.min(QA_TROPHY_XP_CLASS_LABELS.length - 1, Math.round(n)));
    return QA_TROPHY_XP_CLASS_LABELS[idx];
  }
  return 'Normal';
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  return values
    .map((item) => (item != null ? String(item).trim() : ''))
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

async function getOpcoesCadastroDoc() {
  await connectToDatabase();
  const col = getFuncionariosDatabase().collection(FUNCIONARIOS_COLLECTIONS.OPCOES_CADASTRO);
  return col.findOne({ id: 'cadastro_campos' });
}

function docOpcoesCadastroParaValoresCampos(doc) {
  const base = doc || {};
  return {
    id: 'cadastro_campos',
    escalas: Array.isArray(base.escalas) ? base.escalas : [],
    empresas: Array.isArray(base.empresas) ? base.empresas : [],
    departamentos: Array.isArray(base.departamentos) ? base.departamentos : [],
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
  };
}

/** Itens do catálogo QA Troféus (console_config.valores_campos id qa_trophies_catalog). */
function normalizeQaTrophiesCatalogItems(items) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    let tid = String(raw.id || '').trim();
    if (!tid) {
      tid = `qa-tr-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    }
    if (seen.has(tid)) continue;
    seen.add(tid);
    out.push({
      id: tid,
      conquista_titulo: raw.conquista_titulo != null ? String(raw.conquista_titulo).trim() : '',
      conquista_legenda: raw.conquista_legenda != null ? String(raw.conquista_legenda).trim() : '',
      trophy_url: raw.trophy_url != null ? String(raw.trophy_url).trim() : '',
      xpClass: normalizeQaTrophyXpClass(raw.xpClass)
    });
  }
  return out;
}

function buildGenerationPrompt(feedbackType, b) {
  let base = '';
  if (feedbackType === 'Elogio') {
    base = process.env.QA_FEEDBACK_PROMPT_ELOGIO || defaults.ELOGIO;
  } else if (feedbackType === 'Oportunidade') {
    base = process.env.QA_FEEDBACK_PROMPT_OPORTUNIDADE || defaults.OPORTUNIDADE;
  } else if (feedbackType === 'Apontamento') {
    base = process.env.QA_FEEDBACK_PROMPT_APONTAMENTO || defaults.APONTAMENTO;
  } else {
    throw new Error('feedbackType deve ser Elogio, Oportunidade ou Apontamento');
  }

  const colab = String(b.colaboradorNome || '').trim();
  const aval = String(b.avaliador || '').trim();
  const dest = asTextoCampoQa(b.destaques);
  const obsElogio = String(b.observacoesIndividuais || '').trim();
  const obsGeral = String(b.observacao || '').trim();
  const oport = String(b.oportunidade || '').trim();
  const apon = asTextoCampoQa(b.apontamentos);

  let t = base
    .replace(/\[\[COLABORADOR_NOME_COMPLETO\]\]/g, colab)
    .replace(/\[\[DESTAQUES\]\]/g, dest)
    .replace(/\[\[OBS_INDIVIDUAL\]\]/g, feedbackType === 'Elogio' ? obsElogio : obsGeral)
    .replace(/\[\[AVALIADOR\]\]/g, aval)
    .replace(/\[\[OPORTUNIDADE\]\]/g, oport)
    .replace(/\[\[APONTAMENTOS\]\]/g, apon);

  t = t.replace(/\[NOME\]/g, primeiroNome(colab) || colab);
  t = t.replace(/\[colaboradorNome\]/g, colab);
  t = t.replace(/\{destaques\}/g, dest);
  t = t.replace(/\{obs individual\}/gi, feedbackType === 'Elogio' ? obsElogio : obsGeral);
  t = t.replace(/\{obs Individual\}/g, obsGeral || obsElogio);
  t = t.replace(/\{oportunidade\}/g, oport);
  t = t.replace(/\{Apontamentos\}/g, apon);
  t = t.replace(/\{Avaliador\}/g, aval);
  t = t.replace(/\{avaliador\}/g, aval);

  const rec = String(b.recomendacoesTexto || '').trim();
  if (rec) {
    t += `\n\n---\nRecomendações (treinamentos / módulos e temas):\n${rec}`;
  }
  return t;
}

/**
 * GET /valores-campos/:key — key ex.: qa_destaques, qa_apontamentos
 */
router.get('/valores-campos/:key', async (req, res) => {
  const key = (req.params.key || '').trim();
  if (!key) {
    return res.status(400).json({ success: false, error: 'key é obrigatório' });
  }
  try {
    if (key === 'cadastro_campos') {
      const doc = await getOpcoesCadastroDoc();
      const opcoes = normalizeValoresCampoDoc(docOpcoesCadastroParaValoresCampos(doc));
      return res.json({ success: true, opcoes, key });
    }
    await connectToDatabase();
    const configDb = getConfigDatabase();
    const col = configDb.collection('valores_campos');
    const or = [{ id: key }, { chave: key }, { codigo: key }];
    if (mongoose.Types.ObjectId.isValid(key) && String(new mongoose.Types.ObjectId(key)) === key) {
      or.push({ _id: new mongoose.Types.ObjectId(key) });
    } else {
      or.push({ _id: key });
    }
    const doc = await col.findOne({ $or: or });
    const opcoes = normalizeValoresCampoDoc(doc);
    return res.json({ success: true, opcoes, key });
  } catch (error) {
    console.error('GET /valores-campos/:key', error?.message || error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao ler valores_campos',
      message: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
  }
});

/**
 * GET /valores-campos
 * Lista catálogos por ids conhecidos (ou todos, quando includeAll=true).
 */
router.get('/valores-campos', async (req, res) => {
  try {
    await connectToDatabase();
    const configDb = getConfigDatabase();
    const col = configDb.collection('valores_campos');
    const includeAll = String(req.query.includeAll || '').toLowerCase() === 'true';
    const idsPadrao = [
      'cadastro_campos',
      'destaques_itens',
      'oportunidades_itens',
      'apontamentos_itens',
      'qa_trophy_config',
      'qa_trophies_catalog'
    ];
    const query = includeAll ? {} : { id: { $in: idsPadrao.filter((id) => id !== 'cadastro_campos') } };
    const docs = await col.find(query).toArray();
    const cadastroDoc = docOpcoesCadastroParaValoresCampos(await getOpcoesCadastroDoc());
    if (includeAll || idsPadrao.includes('cadastro_campos')) {
      docs.push(cadastroDoc);
    }
    return res.json({ success: true, data: docs });
  } catch (error) {
    console.error('GET /valores-campos', error?.message || error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao listar valores_campos',
      message: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
  }
});

/**
 * PUT /valores-campos/:id
 * Upsert de catálogos/configuração por id fixo.
 */
router.put('/valores-campos/:id', async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) {
    return res.status(400).json({ success: false, error: 'id é obrigatório' });
  }
  try {
    await connectToDatabase();
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const now = new Date();

    if (id === 'cadastro_campos') {
      const col = getFuncionariosDatabase().collection(FUNCIONARIOS_COLLECTIONS.OPCOES_CADASTRO);
      const setDoc = {
        id: 'cadastro_campos',
        escalas: normalizeStringArray(body.escalas),
        empresas: normalizeStringArray(body.empresas),
        departamentos: normalizeStringArray(body.departamentos),
        updatedAt: now,
      };
      const result = await col.findOneAndUpdate(
        { id: 'cadastro_campos' },
        { $set: setDoc, $setOnInsert: { createdAt: now } },
        { upsert: true, returnDocument: 'after' }
      );
      return res.json({
        success: true,
        data: docOpcoesCadastroParaValoresCampos(result),
        message: 'Opções de cadastro atualizadas',
      });
    }

    const configDb = getConfigDatabase();
    const col = configDb.collection('valores_campos');
    const baseSet = {
      id,
      updatedAt: now
    };
    let setDoc = { ...baseSet };
    if (id === 'destaques_itens') {
      setDoc.destaques = normalizeStringArray(body.destaques);
    } else if (id === 'oportunidades_itens') {
      setDoc.oportunidades = normalizeStringArray(body.oportunidades);
    } else if (id === 'apontamentos_itens') {
      setDoc.apontamentos = normalizeStringArray(body.apontamentos);
    } else if (id === 'qa_trophies_catalog') {
      setDoc.trophies = normalizeQaTrophiesCatalogItems(body.trophies);
    } else if (id === 'qa_trophy_config') {
      setDoc.trophy_url = body.trophy_url ? String(body.trophy_url).trim() : '';
      setDoc.conquista_titulo = body.conquista_titulo ? String(body.conquista_titulo).trim() : '';
      setDoc.conquista_legenda = body.conquista_legenda ? String(body.conquista_legenda).trim() : '';
      setDoc.xpClass = normalizeQaTrophyXpClass(body.xpClass);
    } else {
      return res.status(400).json({
        success: false,
        error: 'id inválido para manutenção de valores_campos'
      });
    }

    const result = await col.findOneAndUpdate(
      { id },
      { $set: setDoc, $setOnInsert: { createdAt: now } },
      { upsert: true, returnDocument: 'after' }
    );

    if (id === 'qa_trophies_catalog' && Array.isArray(setDoc.trophies)) {
      if (setDoc.trophies.length > 0) {
        const t0 = setDoc.trophies[0];
        await col.updateOne(
          { id: 'qa_trophy_config' },
          {
            $set: {
              id: 'qa_trophy_config',
              trophy_url: t0.trophy_url,
              conquista_titulo: t0.conquista_titulo,
              conquista_legenda: t0.conquista_legenda,
              xpClass: t0.xpClass,
              updatedAt: now
            },
            $setOnInsert: { createdAt: now }
          },
          { upsert: true }
        );
      } else {
        await col.updateOne(
          { id: 'qa_trophy_config' },
          {
            $set: {
              id: 'qa_trophy_config',
              trophy_url: '',
              conquista_titulo: '',
              conquista_legenda: '',
              xpClass: 'Normal',
              updatedAt: now
            },
            $setOnInsert: { createdAt: now }
          },
          { upsert: true }
        );
      }
    }

    return res.json({ success: true, data: result.value || setDoc });
  } catch (error) {
    console.error('PUT /valores-campos/:id', error?.message || error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao atualizar valores_campos',
      message: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
  }
});

/**
 * POST /qa-feedback/gerar
 * Body: { feedbackType, colaboradorNome, avaliador,
 *   destaques? (string | string[]), observacoesIndividuais?, oportunidade?, observacao?, apontamentos? (string | string[]), recomendacoesTexto? }
 * Prompts: env QA_FEEDBACK_PROMPT_ELOGIO | OPORTUNIDADE | APONTAMENTO; fallback em lib/qaFeedbackPromptDefaults.js
 */
router.post('/qa-feedback/gerar', async (req, res) => {
  try {
    const b = req.body || {};
    const feedbackType = String(b.feedbackType || '').trim();
    if (!feedbackType) {
      return res.status(400).json({ success: false, error: 'feedbackType é obrigatório' });
    }
    if (!b.colaboradorNome || !String(b.colaboradorNome).trim()) {
      return res.status(400).json({ success: false, error: 'colaboradorNome é obrigatório' });
    }
    if (!b.avaliador || !String(b.avaliador).trim()) {
      return res.status(400).json({ success: false, error: 'avaliador é obrigatório' });
    }
    const fullPrompt = buildGenerationPrompt(feedbackType, b);
    const out = await generateQaFeedbackEmail(fullPrompt);
    if (!out.success) {
      return res.status(502).json({ success: false, error: out.error || 'Falha na geração' });
    }
    return res.json({ success: true, feedbackGerado: out.feedbackGerado });
  } catch (error) {
    console.error('POST /qa-feedback/gerar', error);
    return res.status(400).json({ success: false, error: error.message || 'Erro na requisição' });
  }
});

/**
 * POST /qa-feedback — persistir
 */
router.post('/qa-feedback', async (req, res) => {
  try {
    const b = req.body || {};
    const colaboradorNome = String(b.colaboradorNome || '').trim();
    const avaliador = String(b.avaliador || '').trim();
    const mes = String(b.mes || '').trim();
    const ano = Number(b.ano);
    const feedbackType = String(b.feedbackType || '').trim();
    const feedbackBody = String(b.feedbackBody != null ? b.feedbackBody : '');
    const feedbackRecomendacoes = String(b.feedbackRecomendacoes != null ? b.feedbackRecomendacoes : '');

    if (!colaboradorNome || !avaliador || !mes || Number.isNaN(ano) || !feedbackType) {
      return res.status(400).json({
        success: false,
        error: 'colaboradorNome, avaliador, mes, ano e feedbackType são obrigatórios'
      });
    }

    const created = await QaFeedback.create({
      colaboradorNome,
      avaliador,
      mes,
      ano,
      feedbackType,
      feedbackBody,
      feedbackRecomendacoes
    });
    return res.status(201).json({
      success: true,
      data: {
        _id: created._id,
        colaboradorNome: created.colaboradorNome,
        avaliador: created.avaliador,
        mes: created.mes,
        ano: created.ano,
        feedbackType: created.feedbackType,
        feedbackBody: created.feedbackBody,
        feedbackRecomendacoes: created.feedbackRecomendacoes,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt
      }
    });
  } catch (error) {
    console.error('POST /qa-feedback', error);
    return res.status(500).json({ success: false, error: 'Erro ao gravar feedback' });
  }
});

/**
 * POST /atendimento-trophy — academy_registros.atendimento_trophies (Excelência do Atendimento na Academy).
 * Body: { colaboradorNome, qaTrophyId, colaboradorEmail?, conquista_titulo?, conquista_legenda?, trophy_url?, xpClass? }
 */
router.post('/atendimento-trophy', async (req, res) => {
  try {
    await connectToDatabase();
    const b = req.body || {};
    const colaboradorNome = String(b.colaboradorNome || '').trim();
    const qaTrophyId = String(b.qaTrophyId || '').trim();
    const colaboradorEmail = String(b.colaboradorEmail || '')
      .trim()
      .toLowerCase();

    if (!colaboradorNome) {
      return res.status(400).json({ success: false, error: 'colaboradorNome é obrigatório' });
    }
    if (!qaTrophyId) {
      return res.status(400).json({ success: false, error: 'qaTrophyId é obrigatório' });
    }

    const doc = {
      id: crypto.randomUUID(),
      colaboradorNome,
      qaTrophyId,
      createdAt: new Date()
    };
    if (colaboradorEmail) {
      doc.colaboradorEmail = colaboradorEmail;
    }

    const titulo = String(b.conquista_titulo || '').trim();
    const legenda = String(b.conquista_legenda || '').trim();
    const trophy_url = String(b.trophy_url || '').trim();
    const xpClassRaw = b.xpClass != null ? String(b.xpClass).trim() : '';
    if (titulo) doc.conquista_titulo = titulo;
    if (legenda) doc.conquista_legenda = legenda;
    if (trophy_url) doc.trophy_url = trophy_url;
    if (xpClassRaw) doc.xpClass = xpClassRaw;

    const adb = getAcademyDatabase();
    const result = await adb.collection('atendimento_trophies').insertOne(doc);

    return res.status(201).json({
      success: true,
      data: {
        _id: result.insertedId,
        id: doc.id,
        colaboradorNome: doc.colaboradorNome,
        colaboradorEmail: doc.colaboradorEmail,
        qaTrophyId: doc.qaTrophyId,
        createdAt: doc.createdAt,
        conquista_titulo: doc.conquista_titulo,
        conquista_legenda: doc.conquista_legenda,
        trophy_url: doc.trophy_url,
        xpClass: doc.xpClass
      }
    });
  } catch (error) {
    console.error('POST /atendimento-trophy', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao gravar troféu de excelência do atendimento'
    });
  }
});

/**
 * GET /atendimento-trophy/xp-total?email=… | colaboradorNome=…
 * Soma XP dos prémios em academy_registros.atendimento_trophies (matriz em lib/conquistaXpMatrix.js; join console_analises.qa_trophies por qaTrophyId).
 */
router.get('/atendimento-trophy/xp-total', async (req, res) => {
  try {
    await connectToDatabase();
    const email = String(req.query.email || '').trim().toLowerCase();
    const colaboradorNome = String(req.query.colaboradorNome || '').trim();

    if (!email && !colaboradorNome) {
      return res.status(400).json({
        success: false,
        error: 'Informe colaboradorEmail (ou email) ou colaboradorNome'
      });
    }

    const adb = getAcademyDatabase();
    const filter = email
      ? { $or: [{ colaboradorEmail: email }, { email: email }] }
      : { colaboradorNome: new RegExp(`^${escapeMongoRegexLiteral(colaboradorNome)}$`, 'i') };

    const docs = await adb
      .collection('atendimento_trophies')
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    const ids = [];
    for (const d of docs) {
      const v = d && d.qaTrophyId;
      if (v != null && String(v).trim()) ids.push(String(v).trim());
    }
    const unique = [...new Set(ids)].filter(Boolean);

    const catalog = new Map();
    try {
      const qualDb = getAnalisesDatabase();
      if (qualDb && unique.length) {
        const list = await qualDb
          .collection('qa_trophies')
          .find({ id: { $in: unique } })
          .toArray();
        for (const t of list) {
          const id = t.id != null ? String(t.id).trim() : '';
          if (id && !catalog.has(id)) catalog.set(id, t);
        }
      }
    } catch (e) {
      console.warn('[GET atendimento-trophy/xp-total] join qa_trophies:', e?.message || e);
    }

    let totalXp = 0;
    let countedWithXp = 0;
    for (const d of docs) {
      const tid = d && d.qaTrophyId != null ? String(d.qaTrophyId).trim() : '';
      let rawXp = d.xpClass;
      if (tid && catalog.has(tid)) {
        const c = catalog.get(tid);
        if (c.xpClass != null && String(c.xpClass).trim() !== '') rawXp = c.xpClass;
      }
      const r = resolveQaTrophyXp(rawXp);
      if (r.points != null && !Number.isNaN(Number(r.points))) {
        totalXp += Number(r.points);
        countedWithXp += 1;
      }
    }

    return res.json({
      success: true,
      totalXp,
      trophyCount: docs.length,
      countedWithXp
    });
  } catch (error) {
    console.error('GET /atendimento-trophy/xp-total', error);
    return res.status(500).json({ success: false, error: 'Erro ao calcular XP de excelência' });
  }
});

module.exports = router;
