'use strict';

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const { getHomepage, invalidateCache } = require('../services/homepageService');
const { success } = require('../utils/responseHelper');
const { verifyToken, requireAtLeast, requirePermission } = require('../middleware/auth');
const { publicLimiter } = require('../middleware/rateLimiter');
const Article = require('../models/Article');

// Helper: get/set a config key in siteconfigs collection
const getConfig = async (key) => {
  const doc = await mongoose.connection.db.collection('siteconfigs').findOne({ key });
  return doc ? doc.value : null;
};
const setConfig = async (key, value) => {
  await mongoose.connection.db.collection('siteconfigs').updateOne(
    { key },
    { $set: { key, value, updatedAt: new Date() } },
    { upsert: true }
  );
};

// GET /homepage — public, cached
router.get('/', publicLimiter, async (req, res, next) => {
  try {
    const data = await getHomepage();
    // Set cache-control headers for CDN
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');
    return success(res, data);
  } catch (err) {
    next(err);
  }
});

// GET /homepage/hero — return current hero article
router.get('/hero', verifyToken, requirePermission('homepage.manage'), async (req, res, next) => {
  try {
    const heroId = await getConfig('homepage:hero');
    if (!heroId) return success(res, null);
    const article = await Article.findById(heroId)
      .populate('category', 'name slug')
      .select('title slug category ogImage publishedAt status')
      .lean();
    return success(res, article || null);
  } catch (err) { next(err); }
});

// PUT /homepage/hero — set hero article
router.put('/hero', verifyToken, requirePermission('homepage.manage'), async (req, res, next) => {
  try {
    const { articleId } = req.body;
    await setConfig('homepage:hero', articleId || null);
    await invalidateCache();
    return success(res, null, 'تم تعيين الخبر الرئيسي');
  } catch (err) { next(err); }
});

// GET /homepage/featured — return current featured articles
router.get('/featured', verifyToken, requirePermission('homepage.manage'), async (req, res, next) => {
  try {
    const ids = (await getConfig('homepage:featured')) || [];
    if (!ids.length) return success(res, []);
    const articles = await Article.find({ _id: { $in: ids } })
      .populate('category', 'name slug')
      .select('title slug category ogImage publishedAt status')
      .lean();
    // Return in the stored order
    const ordered = ids.map((id) => articles.find((a) => String(a._id) === String(id))).filter(Boolean);
    return success(res, ordered);
  } catch (err) { next(err); }
});

// PUT /homepage/featured — set featured articles list
router.put('/featured', verifyToken, requirePermission('homepage.manage'), async (req, res, next) => {
  try {
    const { articleIds } = req.body;
    await setConfig('homepage:featured', Array.isArray(articleIds) ? articleIds.slice(0, 6) : []);
    await invalidateCache();
    return success(res, null, 'تم حفظ المقالات المميزة');
  } catch (err) { next(err); }
});

// POST /homepage/invalidate — admin: force cache bust
router.post('/invalidate', verifyToken, requirePermission('homepage.manage'), async (req, res, next) => {
  try {
    await invalidateCache();
    return success(res, null, 'تم تحديث الصفحة الرئيسية');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
