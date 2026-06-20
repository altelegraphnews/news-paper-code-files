'use strict';

const AnalyticsEvent = require('../models/AnalyticsEvent');
const PageView = require('../models/PageView');
const Article = require('../models/Article');
const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Track an analytics event (fire-and-forget).
 * article_view also feeds the Mongo counters directly — the daily PageView
 * aggregation (30-day chart) and the article's own views — so counting works
 * without Redis and reflects real reader views, not seeded numbers.
 */
const trackEvent = async ({ type, articleId, userId, sessionId, source, metadata }) => {
  try {
    // Field names must match the AnalyticsEvent schema (eventType/article/user)
    await AnalyticsEvent.create({
      eventType: type,
      article: articleId || null,
      user: userId || null,
      sessionId,
      referrer: source,
      properties: metadata || {},
    });
  } catch (err) {
    logger.error('Analytics track error:', err.message);
  }

  // The view must count even if event logging fails
  if (type === 'article_view' && articleId) {
    try {
      await Promise.all([
        recordPageView(articleId),
        Article.incrementViews(articleId, 1),
      ]);
    } catch (err) {
      logger.error('View count error:', err.message);
    }
  }
};

/**
 * Record a page view. PageView is a raw per-view log (one doc per view,
 * TTL 30 days, pre-save fills date/hour) — aggregations count documents.
 * The old daily-upsert wrote a `count` field the schema doesn't have,
 * so Mongoose stripped it and every chart summed nothing.
 */
const recordPageView = async (articleId) => {
  try {
    await PageView.create({
      path: `/article/${articleId}`,
      article: articleId,
    });
  } catch (err) {
    logger.error('PageView record error:', err.message);
  }
};

/**
 * Get dashboard analytics
 */
const getDashboardStats = async () => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalArticles,
      publishedArticles,
      viewsToday,
      viewsWeek,
      viewsMonth,
      pendingComments,
    ] = await Promise.all([
      Article.countDocuments({ isDeleted: { $ne: true } }),
      Article.countDocuments({ status: 'published', isDeleted: { $ne: true } }),
      PageView.aggregate([{ $match: { date: today.toISOString().split('T')[0] } }, { $group: { _id: null, total: { $sum: 1 } } }]),
      PageView.aggregate([{ $match: { date: { $gte: weekAgo.toISOString().split('T')[0] } } }, { $group: { _id: null, total: { $sum: 1 } } }]),
      PageView.aggregate([{ $match: { date: { $gte: monthAgo.toISOString().split('T')[0] } } }, { $group: { _id: null, total: { $sum: 1 } } }]),
      require('../models/Comment').countDocuments({ status: 'pending', isDeleted: false }),
    ]);

    return {
      articles: { total: totalArticles, published: publishedArticles },
      views: {
        today: viewsToday[0]?.total || 0,
        week: viewsWeek[0]?.total || 0,
        month: viewsMonth[0]?.total || 0,
      },
      comments: { pending: pendingComments },
    };
  } catch (err) {
    logger.error('Dashboard stats error:', err.message);
    return {};
  }
};

/**
 * Get trending articles from Redis cache
 */
const getTrending = async (limit = 10) => {
  try {
    let redis;
    try { redis = getRedisClient(); } catch { /* no redis */ }
    if (redis) {
      // Cache errors must fall through to the DB query, not abort the request
      try {
        const cached = await redis.get('trending:articles');
        if (cached) return JSON.parse(cached);
      } catch (cacheErr) {
        logger.warn('Trending cache read failed, falling back to DB:', cacheErr.message);
      }
    }

    // Fallback: query DB (secondary sort keeps order stable while counts are low)
    const articles = await Article.find({ status: 'published', isDeleted: { $ne: true } })
      .sort('-views.total -publishedAt')
      .limit(limit)
      .populate('category', 'name slug color')
      .select('title slug ogImage category views publishedAt readingTimeMin')
      .lean();

    return articles;
  } catch (err) {
    logger.error('Get trending error:', err.message);
    return [];
  }
};

/**
 * Get views over time for chart
 */
const getViewsOverTime = async (days = 30) => {
  try {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    const fromStr = fromDate.toISOString().split('T')[0];

    const data = await PageView.aggregate([
      { $match: { date: { $gte: fromStr } } },
      { $group: { _id: '$date', total: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    return data.map((d) => ({ date: d._id, views: d.total }));
  } catch (err) {
    logger.error('Get views over time error:', err.message);
    return [];
  }
};

module.exports = { trackEvent, recordPageView, getDashboardStats, getTrending, getViewsOverTime };
