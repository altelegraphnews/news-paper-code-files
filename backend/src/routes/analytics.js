'use strict';

const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();

const { trackEvent, getDashboardStats, getTrending, getViewsOverTime } = require('../services/analyticsService');
const Article = require('../models/Article');
const PageView = require('../models/PageView');
const Category = require('../models/Category');
const { getRedisClient } = require('../config/redis');
const { success } = require('../utils/responseHelper');
const { verifyToken, requireAtLeast, requirePermission, optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { publicLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');

// POST /analytics/event — fire-and-forget tracking (fixed validate call)
router.post('/event', publicLimiter, optionalAuth, validate([
  body('type')
    .isIn(['article_view', 'article_read_50', 'share', 'search', 'recommendation_click'])
    .withMessage('نوع الحدث غير صالح'),
  body('articleId').optional().isMongoId().withMessage('معرف المقال غير صالح'),
]), async (req, res, next) => {
  try {
    const { type, articleId, sessionId, source, metadata } = req.body;
    const userId = req.user?._id;
    res.status(202).json({ success: true, message: 'تم التسجيل' });
    trackEvent({ type, articleId, userId, sessionId, source, metadata }).catch(() => {});
  } catch (err) { next(err); }
});

// GET /analytics/me — writer-scoped stats over own articles
router.get('/me', verifyToken, async (req, res, next) => {
  try {
    const authorId = req.user._id;
    const match = { author: authorId, isDeleted: { $ne: true } };

    const [byStatus, viewsAgg, topArticles, recent] = await Promise.all([
      Article.aggregate([
        { $match: match },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Article.aggregate([
        { $match: { ...match, status: 'published' } },
        { $group: { _id: null, totalViews: { $sum: '$views.total' }, views7d: { $sum: '$views.last7d' } } },
      ]),
      Article.find({ ...match, status: 'published' })
        .sort('-views.total')
        .limit(5)
        .populate('category', 'name slug')
        .select('title slug ogImage category views publishedAt readingTimeMin')
        .lean(),
      Article.find(match)
        .sort('-updatedAt')
        .limit(8)
        .populate('category', 'name slug')
        .select('title slug status review category updatedAt publishedAt views')
        .lean(),
    ]);

    const statusCounts = {};
    for (const s of byStatus) statusCounts[s._id] = s.count;

    return success(res, {
      statusCounts,
      totalArticles: byStatus.reduce((sum, s) => sum + s.count, 0),
      totalViews: viewsAgg[0]?.totalViews || 0,
      views7d: viewsAgg[0]?.views7d || 0,
      topArticles,
      recent,
    });
  } catch (err) { next(err); }
});

// GET /analytics/dashboard — admin (existing)
router.get('/dashboard', verifyToken, requirePermission('analytics.view'), async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const [stats, viewsOverTime] = await Promise.all([
      getDashboardStats(),
      getViewsOverTime(parseInt(days)),
    ]);
    return success(res, { stats, viewsOverTime });
  } catch (err) { next(err); }
});

// GET /analytics/overview — admin (used by admin dashboard page)
router.get('/overview', verifyToken, requirePermission('analytics.view'), async (req, res, next) => {
  try {
    const stats = await getDashboardStats();
    return success(res, stats);
  } catch (err) { next(err); }
});

// GET /analytics/views?period=7d|30d|90d — admin
router.get('/views', verifyToken, requirePermission('analytics.view'), validate([
  query('period').optional().isIn(['7d', '30d', '90d']),
]), async (req, res, next) => {
  try {
    const periodMap = { '7d': 7, '30d': 30, '90d': 90 };
    const days = periodMap[req.query.period] || 30;
    const data = await getViewsOverTime(days);
    return success(res, data);
  } catch (err) { next(err); }
});

// GET /analytics/top-articles?limit=10 — admin
router.get('/top-articles', verifyToken, requirePermission('analytics.view'), async (req, res, next) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const articles = await Article.find({ status: 'published', isDeleted: { $ne: true } })
      .sort('-views.total')
      .limit(limit)
      .populate('category', 'name slug')
      .select('title slug ogImage category views publishedAt readingTimeMin')
      .lean();
    return success(res, articles);
  } catch (err) { next(err); }
});

// GET /analytics/categories — admin
router.get('/categories', verifyToken, requirePermission('analytics.view'), async (req, res, next) => {
  try {
    const data = await Article.aggregate([
      { $match: { status: 'published', isDeleted: { $ne: true } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'cat' } },
      { $unwind: { path: '$cat', preserveNullAndEmpty: true } },
      { $project: { _id: 1, count: 1, name: '$cat.name', slug: '$cat.slug', color: '$cat.color' } },
    ]);
    return success(res, data);
  } catch (err) { next(err); }
});

// GET /analytics/active-visitors — admin
router.get('/active-visitors', verifyToken, requirePermission('analytics.view'), async (req, res, next) => {
  try {
    let count = 0;
    try {
      const redis = getRedisClient();
      const keys = await redis.keys('session:*');
      count = keys.length;
    } catch { /* Redis unavailable */ }
    return success(res, { activeVisitors: count });
  } catch (err) { next(err); }
});

// GET /analytics/trending — admin
router.get('/trending', verifyToken, requirePermission('analytics.view'), async (req, res, next) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const trending = await getTrending(limit);
    return success(res, trending);
  } catch (err) { next(err); }
});

module.exports = router;
