'use strict';

const Article = require('../models/Article');
const logger = require('../utils/logger');

/**
 * Rule-based recommendation engine
 * Combines: same-category, tag overlap, recency-weighted popularity
 */
const getRecommendations = async ({ articleId, categoryId, tags = [], limit = 6, excludeIds = [] }) => {
  try {
    const exclude = [...excludeIds, articleId].filter(Boolean);

    const baseFilter = {
      status: 'published',
      isDeleted: { $ne: true },
      _id: { $nin: exclude },
    };

    // 1. Tag overlap (highest relevance)
    let tagMatches = [];
    if (tags.length > 0) {
      tagMatches = await Article.find({ ...baseFilter, tags: { $in: tags } })
        .sort('-publishedAt')
        .limit(limit)
        .populate('category', 'name slug color')
        .select('title slug ogImage category publishedAt readingTimeMin views excerpt')
        .lean();
    }

    // 2. Same category
    let categoryMatches = [];
    if (categoryId && tagMatches.length < limit) {
      const alreadyIds = tagMatches.map((a) => a._id);
      categoryMatches = await Article.find({
        ...baseFilter,
        category: categoryId,
        _id: { $nin: [...exclude, ...alreadyIds] },
      })
        .sort('-publishedAt')
        .limit(limit - tagMatches.length)
        .populate('category', 'name slug color')
        .select('title slug ogImage category publishedAt readingTimeMin views excerpt')
        .lean();
    }

    let combined = [...tagMatches, ...categoryMatches];

    // 3. Popularity fallback if still not enough
    if (combined.length < limit) {
      const alreadyIds = combined.map((a) => a._id);
      const popular = await Article.find({
        ...baseFilter,
        _id: { $nin: [...exclude, ...alreadyIds] },
      })
        .sort({ 'views.total': -1, publishedAt: -1 })
        .limit(limit - combined.length)
        .populate('category', 'name slug color')
        .select('title slug ogImage category publishedAt readingTimeMin views excerpt')
        .lean();

      combined = [...combined, ...popular];
    }

    // Apply recency decay scoring and sort
    const now = Date.now();
    const HALF_LIFE_MS = 48 * 60 * 60 * 1000; // 48 hours

    combined = combined
      .map((article) => {
        const ageMs = now - new Date(article.publishedAt).getTime();
        const decayFactor = Math.exp(-ageMs / HALF_LIFE_MS);
        const score = (article.views?.total || 0) * decayFactor;
        return { ...article, _score: score };
      })
      .sort((a, b) => b._score - a._score)
      .slice(0, limit)
      .map(({ _score, ...article }) => article);

    return combined;
  } catch (err) {
    logger.error('Recommendation error:', err.message);
    return [];
  }
};

module.exports = { getRecommendations };
