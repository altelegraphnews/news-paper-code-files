'use strict';

const mongoose = require('mongoose');
const Article = require('../models/Article');
const Category = require('../models/Category');
const Ticker = require('../models/Ticker');
const { getRedisClient, cacheGet, cacheSet } = require('../config/redis');
const logger = require('../utils/logger');

const CACHE_KEY = 'homepage:data';
const CACHE_TTL = 60; // 60 seconds
const MAX_HERO_SLIDES = 7; // articles the hero carousel rotates through

// Admin homepage overrides live in the `siteconfigs` collection (set via the
// admin PUT /homepage/hero and /homepage/featured routes).
const getSiteConfig = async (key) => {
  try {
    const doc = await mongoose.connection.db.collection('siteconfigs').findOne({ key });
    return doc ? doc.value : null;
  } catch {
    return null;
  }
};

// Shared card projection for homepage article queries.
const withCardFields = (query) =>
  query
    .populate('category', 'name slug color')
    .populate('author', 'name avatar')
    .select('-content -revisions')
    .lean();

/**
 * Build homepage data object
 */
const buildHomepageData = async () => {
  // Admin-configured hero + featured overrides (fall back to auto-selection).
  const [heroSlideIdsCfg, heroIdCfg, featuredIdsCfg] = await Promise.all([
    getSiteConfig('homepage:heroSlides'),
    getSiteConfig('homepage:hero'),
    getSiteConfig('homepage:featured'),
  ]);

  // Hero carousel: the admin's ordered list of up to 7 articles. Anything
  // unpublished or deleted since it was picked drops out silently.
  let heroSlides = [];
  if (Array.isArray(heroSlideIdsCfg) && heroSlideIdsCfg.length) {
    const found = await withCardFields(
      Article.find({
        _id: { $in: heroSlideIdsCfg },
        status: 'published',
        isDeleted: { $ne: true },
      })
    );
    const byId = new Map(found.map((a) => [String(a._id), a]));
    heroSlides = heroSlideIdsCfg.map((id) => byId.get(String(id))).filter(Boolean);
  }

  // Legacy single-hero pick, for configs saved before the carousel existed.
  if (!heroSlides.length && heroIdCfg) {
    const legacyHero = await withCardFields(
      Article.findOne({ _id: heroIdCfg, status: 'published', isDeleted: { $ne: true } })
    );
    if (legacyHero) heroSlides = [legacyHero];
  }

  // Nothing chosen (or nothing survived): fall back to the single most recent
  // featured article, as before. Deliberately not a full carousel — the
  // featured strip beside the hero draws from the same pool and would be left
  // empty if seven articles were pulled into the carousel.
  if (!heroSlides.length) {
    const autoHero = await withCardFields(
      Article.findOne({ status: 'published', isFeatured: true, isDeleted: { $ne: true } }).sort('-publishedAt')
    );
    if (autoHero) heroSlides = [autoHero];
  }
  heroSlides = heroSlides.slice(0, MAX_HERO_SLIDES);

  // `hero` stays the first slide so existing consumers keep working.
  const heroArticle = heroSlides[0] || null;

  // Secondary featured: use the admin's ordered list if set, else auto (most
  // recent isFeatured). Never repeat the hero; cap at 4.
  let featuredArticles = [];
  if (Array.isArray(featuredIdsCfg) && featuredIdsCfg.length) {
    const found = await withCardFields(
      Article.find({ _id: { $in: featuredIdsCfg }, status: 'published', isDeleted: { $ne: true } })
    );
    const byId = new Map(found.map((a) => [String(a._id), a]));
    featuredArticles = featuredIdsCfg.map((id) => byId.get(String(id))).filter(Boolean);
  } else {
    featuredArticles = await withCardFields(
      Article.find({ status: 'published', isFeatured: true, isDeleted: { $ne: true } }).sort('-publishedAt').limit(6)
    );
  }
  // Nothing in the carousel should reappear in the strip beside it.
  const heroSlideIds = new Set(heroSlides.map((a) => String(a._id)));
  featuredArticles = featuredArticles.filter((a) => !heroSlideIds.has(String(a._id)));
  featuredArticles = featuredArticles.slice(0, 4);

  const [latestArticles, breakingArticles, tickers, categories] = await Promise.all([
    // Latest articles
    withCardFields(Article.find({ status: 'published', isDeleted: { $ne: true } }).sort('-publishedAt').limit(12)),

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
    heroSlides,
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
