// VERSION: v1.0.1 | DATE: 2026-06-01 | AUTHOR: VeloHub Development Team
const express = require('express');
const multer = require('multer');
const { ObjectId } = require('mongodb');
const { connectToDatabase, getMongoClient } = require('../config/database');
const {
  LEGAL_DOCUMENT_REGISTRY,
  getDocumentDef,
} = require('../config/corporativoLegalRegistry');
const { parseDocxBuffer } = require('../utils/parseDocxSections');
const router = express.Router();

const docxUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.originalname.toLowerCase().endsWith('.docx');
    cb(ok ? null : new Error('Envie um arquivo .docx'), ok);
  },
});

async function ensureDb() {
  await connectToDatabase();
  return getMongoClient();
}

function buildVersionPayload(def, secoes) {
  if (def.documentId === 'lgpd') {
    return { publica: secoes, corporativo: [] };
  }
  return { corpo: secoes };
}

function getBodyArrayFromDoc(def, doc, fieldName) {
  if (!doc) return [];
  const arr = doc[fieldName];
  return Array.isArray(arr) ? arr : [];
}

router.get('/documentos/registry', async (_req, res) => {
  try {
    const registry = LEGAL_DOCUMENT_REGISTRY.map((d) => ({
      documentId: d.documentId,
      titulo: d.titulo,
      kind: d.kind,
      bodyFields: d.bodyFields,
      ackType: d.ackType || null,
      parserType: d.parserType,
    }));
    res.json({ success: true, data: registry });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/documentos/:documentId/versoes', async (req, res) => {
  try {
    const def = getDocumentDef(req.params.documentId);
    if (!def) {
      return res.status(404).json({ success: false, error: 'Documento não encontrado' });
    }
    const client = await ensureDb();
    const col = def.getCorpoCol(client);
    const rows = await col.find({}).sort({ updatedAt: -1, createdAt: -1 }).toArray();
    res.json({
      success: true,
      data: rows.map((r) => ({
        _id: r._id,
        versao: r.versao,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      count: rows.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/documentos/:documentId/:versaoId', async (req, res) => {
  try {
    const def = getDocumentDef(req.params.documentId);
    if (!def || !ObjectId.isValid(req.params.versaoId)) {
      return res.status(404).json({ success: false, error: 'Documento ou versão inválidos' });
    }
    const client = await ensureDb();
    const doc = await def.getCorpoCol(client).findOne({ _id: new ObjectId(req.params.versaoId) });
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Versão não encontrada' });
    }
    res.json({ success: true, data: doc });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/documentos/:documentId/preview-docx', docxUpload.single('docx'), async (req, res) => {
  try {
    const def = getDocumentDef(req.params.documentId);
    if (!def) {
      return res.status(404).json({ success: false, error: 'Documento não encontrado' });
    }
    if (!req.file?.buffer) {
      return res.status(400).json({ success: false, error: 'Arquivo .docx é obrigatório' });
    }
    const secoes = parseDocxBuffer(req.file.buffer, def.parserType);
    if (!secoes.length) {
      return res.status(400).json({ success: false, error: 'Nenhuma seção reconhecida no documento' });
    }
    res.json({ success: true, secoes, count: secoes.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/documentos/:documentId/versoes', async (req, res) => {
  try {
    const def = getDocumentDef(req.params.documentId);
    if (!def) {
      return res.status(404).json({ success: false, error: 'Documento não encontrado' });
    }
    const { versao, secoes } = req.body || {};
    if (!versao || !String(versao).trim()) {
      return res.status(400).json({ success: false, error: 'versao é obrigatória' });
    }
    if (!Array.isArray(secoes) || secoes.length === 0) {
      return res.status(400).json({ success: false, error: 'secoes é obrigatório' });
    }

    const client = await ensureDb();
    const col = def.getCorpoCol(client);
    const versaoStr = String(versao).trim();
    const existing = await col.findOne({ versao: versaoStr });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Versão já existe para este documento' });
    }

    const now = new Date();
    const payload = {
      versao: versaoStr,
      ...buildVersionPayload(def, secoes),
      createdAt: now,
      updatedAt: now,
    };
    const result = await col.insertOne(payload);
    res.status(201).json({
      success: true,
      data: { ...payload, _id: result.insertedId },
      message: 'Nova versão publicada',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/documentos/:documentId/:versaoId/secoes/:field/:index', async (req, res) => {
  try {
    const def = getDocumentDef(req.params.documentId);
    const index = parseInt(req.params.index, 10);
    const field = req.params.field;
    if (!def || !ObjectId.isValid(req.params.versaoId) || Number.isNaN(index)) {
      return res.status(400).json({ success: false, error: 'Parâmetros inválidos' });
    }
    if (!def.bodyFields.includes(field)) {
      return res.status(400).json({ success: false, error: 'Campo inválido' });
    }
    const { titulo, corpo } = req.body || {};
    if (!titulo || corpo == null) {
      return res.status(400).json({ success: false, error: 'titulo e corpo são obrigatórios' });
    }

    const client = await ensureDb();
    const col = def.getCorpoCol(client);
    const doc = await col.findOne({ _id: new ObjectId(req.params.versaoId) });
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Versão não encontrada' });
    }
    const arr = [...getBodyArrayFromDoc(def, doc, field)];
    if (index < 0 || index >= arr.length) {
      return res.status(404).json({ success: false, error: 'Seção não encontrada' });
    }
    arr[index] = { titulo: String(titulo).trim(), corpo: String(corpo) };
    await col.updateOne(
      { _id: doc._id },
      { $set: { [field]: arr, updatedAt: new Date() } }
    );
    const updated = await col.findOne({ _id: doc._id });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/documentos/:documentId/:versaoId/secoes/:field', async (req, res) => {
  try {
    const def = getDocumentDef(req.params.documentId);
    const field = req.params.field;
    if (!def || !ObjectId.isValid(req.params.versaoId)) {
      return res.status(400).json({ success: false, error: 'Parâmetros inválidos' });
    }
    if (!def.bodyFields.includes(field)) {
      return res.status(400).json({ success: false, error: 'Campo inválido' });
    }
    const { titulo, corpo } = req.body || {};
    if (!titulo || corpo == null) {
      return res.status(400).json({ success: false, error: 'titulo e corpo são obrigatórios' });
    }

    const client = await ensureDb();
    const col = def.getCorpoCol(client);
    const doc = await col.findOne({ _id: new ObjectId(req.params.versaoId) });
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Versão não encontrada' });
    }
    const entry = { titulo: String(titulo).trim(), corpo: String(corpo) };
    await col.updateOne(
      { _id: doc._id },
      { $push: { [field]: entry }, $set: { updatedAt: new Date() } }
    );
    const updated = await col.findOne({ _id: doc._id });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/documentos/:documentId/:versaoId/secoes/:field/:index', async (req, res) => {
  try {
    const def = getDocumentDef(req.params.documentId);
    const index = parseInt(req.params.index, 10);
    const field = req.params.field;
    if (!def || !ObjectId.isValid(req.params.versaoId) || Number.isNaN(index)) {
      return res.status(400).json({ success: false, error: 'Parâmetros inválidos' });
    }
    if (!def.bodyFields.includes(field)) {
      return res.status(400).json({ success: false, error: 'Campo inválido' });
    }

    const client = await ensureDb();
    const col = def.getCorpoCol(client);
    const doc = await col.findOne({ _id: new ObjectId(req.params.versaoId) });
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Versão não encontrada' });
    }
    const arr = [...getBodyArrayFromDoc(def, doc, field)];
    if (index < 0 || index >= arr.length) {
      return res.status(404).json({ success: false, error: 'Seção não encontrada' });
    }
    arr.splice(index, 1);
    await col.updateOne(
      { _id: doc._id },
      { $set: { [field]: arr, updatedAt: new Date() } }
    );
    res.json({ success: true, message: 'Seção removida' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/documentos/:documentId/:versaoId', async (req, res) => {
  try {
    const def = getDocumentDef(req.params.documentId);
    if (!def || !ObjectId.isValid(req.params.versaoId)) {
      return res.status(400).json({ success: false, error: 'Parâmetros inválidos' });
    }
    const client = await ensureDb();
    const col = def.getCorpoCol(client);
    const count = await col.countDocuments({});
    if (count <= 1) {
      return res.status(400).json({ success: false, error: 'Não é possível excluir a única versão' });
    }
    const result = await col.deleteOne({ _id: new ObjectId(req.params.versaoId) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, error: 'Versão não encontrada' });
    }
    res.json({ success: true, message: 'Versão excluída' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/ciencia-por-documento', async (_req, res) => {
  try {
    const client = await ensureDb();
    const grouped = [];

    for (const def of LEGAL_DOCUMENT_REGISTRY) {
      const corpoCol = def.getCorpoCol(client);
      const ackCol = def.getAckCol(client);
      const versions = await corpoCol.find({}).sort({ updatedAt: -1 }).toArray();
      const allAcks = await ackCol.find({}).toArray();

      for (const versionDoc of versions) {
        const versaoId = versionDoc._id.toString();
        const agentes = allAcks
          .filter((a) => String(a.versao) === versaoId)
          .map((a) => ({
            colaboradorNome: a.colaboradorNome,
            userEmail: a.userEmail,
            acknowledgedAt: a.acknowledgedAt,
          }));

        grouped.push({
          documentId: def.documentId,
          titulo: def.titulo,
          versao: versionDoc.versao,
          versaoId: versionDoc._id,
          createdAt: versionDoc.createdAt,
          updatedAt: versionDoc.updatedAt,
          agentes,
          totalAgentes: agentes.length,
        });
      }
    }

    grouped.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

    res.json({ success: true, data: grouped, count: grouped.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
