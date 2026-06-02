// VERSION: v1.0.0 | DATE: 2026-06-01 | AUTHOR: VeloHub Development Team
const express = require('express');
const { connectToDatabase, getDatabase } = require('../config/database');

const router = express.Router();
const HUB_BANNER_COLLECTION = 'hub_banner';

router.get('/banner', async (_req, res) => {
  try {
    await connectToDatabase();
    const db = getDatabase();
    const doc = await db
      .collection(HUB_BANNER_COLLECTION)
      .find({})
      .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
      .limit(1)
      .next();
    res.json({ success: true, data: doc || { bannerImg: [] } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/banner', async (req, res) => {
  try {
    const { bannerImg } = req.body || {};
    if (!Array.isArray(bannerImg)) {
      return res.status(400).json({ success: false, error: 'bannerImg deve ser um array' });
    }

    await connectToDatabase();
    const db = getDatabase();
    const col = db.collection(HUB_BANNER_COLLECTION);
    const now = new Date();
    const normalized = bannerImg.map((item) => ({
      url: item.url || item.name || null,
      name: item.name || item.url || null,
      type: item.type || 'image',
      href: item.href ?? null,
    }));

    const existing = await col.find({}).sort({ updatedAt: -1 }).limit(1).next();
    if (existing) {
      await col.updateOne(
        { _id: existing._id },
        { $set: { bannerImg: normalized, updatedAt: now } }
      );
      const updated = await col.findOne({ _id: existing._id });
      return res.json({ success: true, data: updated });
    }

    const result = await col.insertOne({
      bannerImg: normalized,
      createdAt: now,
      updatedAt: now,
    });
    const inserted = await col.findOne({ _id: result.insertedId });
    res.json({ success: true, data: inserted });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
