'use strict';

const { getEsClient } = require('../config/elasticsearch');
const config = require('../config/env');
const logger = require('../utils/logger');

const INDEX = config.elasticsearch.indexArticles;

/**
 * No-op: index creation is handled by connectElasticsearch in config/elasticsearch.js
 */
const initIndex = async () => {};

/**
 * Index a single article
 */
const indexArticle = async (article) => {
  try {
    const client = getEsClient();
    if (!client) return;

    await client.index({
      index: INDEX,
      id: article._id.toString(),
      document: {
        title: article.title,
        excerpt: article.excerpt || '',
        content: article.content || '',
        tags: article.tags || [],
        category: article.category?._id?.toString() || article.category?.toString(),
        categorySlug: article.category?.slug || '',
        author: article.author?._id?.toString() || article.author?.toString(),
        slug: article.slug,
        status: article.status,
        publishedAt: article.publishedAt,
        isFeatured: article.isFeatured || false,
        isBreaking: article.isBreaking || false,
        views: article.views?.total || 0,
        ogImageUrl: article.ogImage?.url || '',
      },
    });
  } catch (err) {
    logger.error('Elasticsearch index article error:', err.message);
    throw err;
  }
};

/**
 * Delete article from index
 */
const deleteArticle = async (articleId) => {
  try {
    const client = getEsClient();
    if (!client) return;

    await client.delete({ index: INDEX, id: articleId.toString() });
  } catch (err) {
    if (err.meta?.statusCode !== 404) {
      logger.error('Elasticsearch delete article error:', err.message);
    }
  }
};

/**
 * Search articles
 */
const searchArticles = async ({ q, category, author, from, to, page = 1, limit = 20 }) => {
  try {
    const client = getEsClient();
    if (!client) return { hits: [], total: 0 };

    const must = [{ match: { status: 'published' } }];
    const filter = [];

    if (q) {
      must.push({
        multi_match: {
          query: q,
          fields: ['title^3', 'excerpt^2', 'content', 'tags'],
          analyzer: 'arabic_analyzer',
          fuzziness: 'AUTO',
        },
      });
    }

    if (category) filter.push({ term: { categorySlug: category } });
    if (author) filter.push({ term: { author } });
    if (from || to) {
      filter.push({ range: { publishedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } });
    }

    const result = await client.search({
      index: INDEX,
      from: (page - 1) * limit,
      size: limit,
      query: { bool: { must, filter } },
      sort: q ? ['_score', { publishedAt: 'desc' }] : [{ publishedAt: 'desc' }],
      highlight: {
        fields: { title: {}, excerpt: {} },
        pre_tags: ['<mark>'],
        post_tags: ['</mark>'],
      },
    });

    const hits = result.hits.hits.map((hit) => ({
      _id: hit._id,
      ...hit._source,
      highlight: hit.highlight,
      score: hit._score,
    }));

    return { hits, total: result.hits.total.value };
  } catch (err) {
    logger.error('Elasticsearch search error:', err.message);
    return { hits: [], total: 0 };
  }
};

module.exports = { initIndex, indexArticle, deleteArticle, searchArticles };
