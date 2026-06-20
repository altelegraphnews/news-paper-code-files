'use strict';

const Article = require('../models/Article');
const Category = require('../models/Category');
const Ticker = require('../models/Ticker');
const { getRedisClient, cacheGet, cacheSet } = require('../config/redis');
const logger = require('../utils/logger');

const CACHE_KEY = 'homepage:data';
const CACHE_TTL = 60; // 60 seconds

/**
 * Build homepage data object
 */
const buildHomepageData = async () => {
  const [
    heroArticle,
    featuredArticles,
    latestArticles,
    breakingArticles,
    tickers,
    categories,
  ] = await Promise.all([
    // Hero: most recent featured
    Article.findOne({ status: 'published', isFeatured: true, isDeleted: { $ne: true } })
      .sort('-publishedAt')
      .populate('category', 'name slug color')
      .populate('author', 'name avatar')
      .select('-content -revisions')
      .lean(),

    // Secondary featured (up to 4, excluding hero)
    Article.find({ status: 'published', isFeatured: true, isDeleted: { $ne: true } })
      .sort('-publishedAt')
      .skip(1)
      .limit(4)
      .populate('category', 'name slug color')
      .populate('author', 'name avatar')
      .select('-content -revisions')
      .lean(),

    // Latest articles
    Article.find({ status: 'published', isDeleted: { $ne: true } })
      .sort('-publishedAt')
      .limit(12)
      .populate('category', 'name slug color')
      .populate('author', 'name avatar')
      .select('-content -revisions')
      .lean(),

    // Breaking news
    Article.find({ status: 'published', isBreaking: true, isDeleted: { $ne: true } })
      .sort('-publishedAt')
      .limit(5)
      .populate('category', 'name slug color')
      .select('title slug category publishedAt')
      .lean(),

    // Active tickers
    Ticker.find({
      isActive: true,
      $or: [
        { startAt: null, endAt: null },
        { startAt: { $lte: new Date() }, endAt: { $gte: new Date() } },
        { startAt: { $lte: new Date() }, endAt: null },
        { startAt: null, endAt: { $gte: new Date() } },
      ],
    })
      .sort({ order: 1, createdAt: -1 })
      .limit(10)
      .lean(),

    // Top-level nav categories
    Category.find({ isActive: true, parent: null })
      .sort({ order: 1 })
      .select('name nameEn slug color icon order')
      .lean(),
  ]);

  // Per-category preview rows (3 articles each, for top 5 homepage categories)
  const homepageCategories = categories.filter((c) => c).slice(0, 6);
  const categoryRows = await Promise.all(
    homepageCategories.map(async (cat) => {
      const articles = await Article.find({
        status: 'published',
        category: cat._id,
        isDeleted: { $ne: true },
      })
        .sort('-publishedAt')
        .limit(4)
        .populate('author', 'name avatar')
        .select('-content -revisions')
        .lean();
      return { category: cat, articles };
    })
  );

  // Most read (from view counts)
  const mostRead = await Article.find({ status: 'published', isDeleted: { $ne: true } })
    .sort('-views.total')
    .limit(8)
    .select('title slug views.total category publishedAt ogImage')
    .populate('category', 'name slug color')
    .lean();

  // Featured thought/opinion articles (fikr or madkhal section)
  const fikrCategory = categories.find((c) => c.slug === 'fikr' || c.slug === 'madkhal');
  let opinionArticles = [];
  if (fikrCategory) {
    opinionArticles = await Article.find({
      status: 'published',
      category: fikrCategory._id,
      isDeleted: { $ne: true },
    })
      .sort('-publishedAt')
      .limit(4)
      .populate('author', 'name avatar bio')
      .select('-content -revisions')
      .lean();
  }

  return {
    hero: heroArticle,
    featured: featuredArticles,
    latest: latestArticles,
    breaking: breakingArticles,
    tickers,
    categories,
    categoryRows,
    mostRead,
    opinion: opinionArticles,
    generatedAt: new Date().toISOString(),
  };
};

/**
 * Get homepage data (cached)
 */
const getHomepage = async () => {
  try {
    const cached = await cacheGet(CACHE_KEY);
    if (cached) return cached;

    const data = await buildHomepageData();
    await cacheSet(CACHE_KEY, data, CACHE_TTL);
    return data;
  } catch (err) {
    logger.error('Homepage data error:', err.message);
    return await buildHomepageData().catch(() => ({}));
  }
};

/**
 * Invalidate homepage cache
 */
const invalidateCache = async () => {
  try {
    let redis;
    try { redis = getRedisClient(); } catch { return; }
    const keys = await redis.keys('homepage:*');
    if (keys.length > 0) await redis.del(...keys);
  } catch (err) {
    logger.error('Homepage cache invalidation error:', err.message);
  }
};

module.exports = { getHomepage, invalidateCache };
