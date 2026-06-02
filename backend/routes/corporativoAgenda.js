// VERSION: v1.0.0 | DATE: 2026-06-01 | AUTHOR: VeloHub Development Team
const express = require('express');
const router = express.Router();
const { getDatabase, connectToDatabase } = require('../config/database');
const { ObjectId } = require('mongodb');

const COLLECTION = 'hub_agenda';

function getCol() {
  return getDatabase().collection(COLLECTION);
}

router.get('/', async (_req, res) => {
  try {
    await connectToDatabase();
    const rows = await getCol().find({}).sort({ inicio: 1 }).toArray();
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
      return res.status(404).json({ success: false, error: 'Compromisso não encontrado' });
    }
    res.json({ success: true, data: row });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { titulo, inicio, fim, url, ativo } = req.body || {};
    if (!titulo?.trim() || !inicio) {
      return res.status(400).json({ success: false, error: 'titulo e inicio são obrigatórios' });
    }
    await connectToDatabase();
    const now = new Date();
    const doc = {
      titulo: titulo.trim(),
      inicio: new Date(inicio),
      fim: fim ? new Date(fim) : null,
      url: url?.trim() || '',
      ativo: ativo !== false,
      createdAt: now,
      updatedAt: now,
    };
    const result = await getCol().insertOne(doc);
    res.status(201).json({ success: true, data: { ...doc, _id: result.insertedId } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }
    const { titulo, inicio, fim, url, ativo } = req.body || {};
    await connectToDatabase();
    const update = { updatedAt: new Date() };
    if (titulo != null) update.titulo = String(titulo).trim();
    if (inicio != null) update.inicio = new Date(inicio);
    if (fim !== undefined) update.fim = fim ? new Date(fim) : null;
    if (url != null) update.url = String(url).trim();
    if (ativo != null) update.ativo = ativo === true;

    const result = await getCol().updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: update }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, error: 'Compromisso não encontrado' });
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
      return res.status(404).json({ success: false, error: 'Compromisso não encontrado' });
    }
    res.json({ success: true, message: 'Compromisso excluído' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
