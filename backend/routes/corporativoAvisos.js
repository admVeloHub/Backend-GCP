// VERSION: v1.2.0 | DATE: 2026-06-01 | AUTHOR: VeloHub Development Team
// CHANGELOG: v1.2.0 - CRUD em console_conteudo.hub_avisos (feed avisos Home)
// CHANGELOG: v1.1.0 - CRUD em console_conteudo.hub_destaques (legado)
const express = require('express');
const router = express.Router();
const { getDatabase, connectToDatabase } = require('../config/database');
const { ObjectId } = require('mongodb');
const { processContentImages } = require('../utils/contentProcessor');

const COLLECTION = 'hub_avisos';

function getCol() {
  return getDatabase().collection(COLLECTION);
}

/** hub_avisos.media — array [{ url, type, name }] (LISTA_SCHEMAS) */
function normalizeMediaForHubAvisos(media) {
  if (Array.isArray(media)) return media;
  if (media && typeof media === 'object') {
    const items = [];
    for (const img of media.images || []) {
      if (typeof img === 'string') {
        items.push({ url: img, type: 'image', name: img });
      } else if (img && typeof img === 'object') {
        items.push({
          url: img.url || img.name || null,
          type: img.type || 'image',
          name: img.name || img.url || null,
        });
      }
    }
    for (const vid of media.videos || []) {
      if (vid && typeof vid === 'object') {
        items.push({
          url: vid.url || vid.name || null,
          type: vid.type || 'video',
          name: vid.name || vid.url || null,
        });
      }
    }
    return items;
  }
  return [];
}

router.get('/', async (_req, res) => {
  try {
    await connectToDatabase();
    const rows = await getCol().find({}).sort({ createdAt: -1, _id: -1 }).toArray();
    res.json({ success: true, data: rows, count: rows.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }
    await connectToDatabase();
    const row = await getCol().findOne({ _id: new ObjectId(req.params.id) });
    if (!row) {
      return res.status(404).json({ success: false, error: 'Aviso não encontrado' });
    }
    res.json({ success: true, data: row });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { titulo, conteudo, media } = req.body || {};
    if (!titulo?.trim()) {
      return res.status(400).json({ success: false, error: 'titulo é obrigatório' });
    }
    await connectToDatabase();
    let processedContent = conteudo || '';
    const imagePaths = Array.isArray(media?.images) ? media.images : [];
    if (processedContent && imagePaths.length > 0) {
      processedContent = processContentImages(processedContent, imagePaths);
    }
    const now = new Date();
    const doc = {
      titulo: titulo.trim(),
      conteudo: processedContent,
      media: normalizeMediaForHubAvisos(media),
      createdAt: now,
    };
    const result = await getCol().insertOne(doc);
    res.status(201).json({
      success: true,
      data: { ...doc, _id: result.insertedId },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }
    const { titulo, conteudo, media } = req.body || {};
    await connectToDatabase();
    let processedContent = conteudo;
    const imagePaths = Array.isArray(media?.images) ? media.images : [];
    if (processedContent != null && imagePaths.length > 0) {
      processedContent = processContentImages(processedContent, imagePaths);
    }
    const update = {};
    if (titulo != null) update.titulo = String(titulo).trim();
    if (processedContent != null) update.conteudo = processedContent;
    if (media != null) update.media = normalizeMediaForHubAvisos(media);

    const result = await getCol().updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: update }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, error: 'Aviso não encontrado' });
    }
    const updated = await getCol().findOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }
    await connectToDatabase();
    const result = await getCol().deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, error: 'Aviso não encontrado' });
    }
    res.json({ success: true, message: 'Aviso excluído' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
