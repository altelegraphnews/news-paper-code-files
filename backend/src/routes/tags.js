'use strict';

const express = require('express');
const { query } = require('express-validator');
const router = express.Router();
const Article = require('../models/Article');
const { success } = require('../utils/responseHelper');
const { validate } = require('../middleware/validate');
const { publicLimiter } = require('../middleware/rateLimiter');

// GET /tags?q=keyword — returns distinct tags from published articles
router.get('/', publicLimiter, validate([
  query('q').optional().trim(),
]), async (req, res, next) => {
  try {
    const { q } = req.query;
    const tags = await Article.distinct('tags', {
      status: 'published',
      isDeleted: { $ne: true },
    });
    const filtered = q ? tags.filter(t => t.toLowerCase().includes(q.toLowerCase())) : tags;
    return success(res, filtered.sort().slice(0, 100));
  } catch (error) { next(error); }
});

module.exports = router;
