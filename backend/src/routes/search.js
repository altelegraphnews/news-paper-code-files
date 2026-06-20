'use strict';

const express = require('express');
const router = express.Router();

const searchService = require('../services/searchService');
const { getRecommendations } = require('../services/recommendationService');
const Article = require('../models/Article');
const { success, paginated } = require('../utils/responseHelper');
const { publicLimiter } = require('../middleware/rateLimiter');
const { trackEvent } = require('../services/analyticsService');

// GET /search?q=&category=&from=&to=&page=&limit=
router.get('/', publicLimiter, async (req, res, next) => {
  try {
    const { q, category, author, from, to, page = 1, limit = 20 } = req.query;

    const { hits, total } = await searchService.searchArticles({
      q, category, author, from, to,
      page: parseInt(page),
      limit: Math.min(50, parseInt(limit)),
    });

    // Track search event
    if (q) {
      trackEvent({ type: 'search', metadata: { query: q, results: total } }).catch(() => {});
    }

    // If no ES results, fallback to MongoDB
    if (hits.length === 0 && q) {
      const mongoFilter = {
        status: 'published',
        isDeleted: { $ne: true },
        $or: [
          { title: { $regex: q, $options: 'i' } },
          { excerpt: { $regex: q, $options: 'i' } },
          { tags: { $in: [new RegExp(q, 'i')] } },
        ],
      };
      const pageNum = parseInt(page);
      const limitNum = Math.min(50, parseInt(limit));
      const skip = (pageNum - 1) * limitNum;

      const [articles, mongoTotal] = await Promise.all([
        Article.find(mongoFilter)
          .sort('-publishedAt')
          .skip(skip)
          .limit(limitNum)
          .populate('category', 'name slug color')
          .populate('author', 'name avatar')
          .select('-content -revisions')
          .lean(),
        Article.countDocuments(mongoFilter),
      ]);

      return paginated(res, articles, { page: pageNum, limit: limitNum, total: mongoTotal });
    }

    return paginated(res, hits, { page: parseInt(page), limit: parseInt(limit), total });
  } catch (err) {
    next(err);
  }
});

// GET /recommendations?articleId=&limit=
router.get('/recommendations', publicLimiter, async (req, res, next) => {
  try {
    const { articleId, limit = 6 } = req.query;

    let categoryId, tags;
    if (articleId) {
      const article = await Article.findById(articleId).select('category tags').lean();
      if (article) {
        categoryId = article.category;
        tags = article.tags;
      }
    }

    const recommendations = await getRecommendations({
      articleId,
      categoryId,
      tags,
      limit: Math.min(12, parseInt(limit)),
    });

    return success(res, recommendations);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
