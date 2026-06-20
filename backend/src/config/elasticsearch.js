'use strict';

const { Client } = require('@elastic/elasticsearch');
const config = require('./env');
const logger = require('../utils/logger');

let esClient = null;

const connectElasticsearch = async () => {
  if (esClient) return esClient;

  const clientConfig = {
    node: config.elasticsearch.node,
    requestTimeout: 30000,
    maxRetries: 3,
    sniffOnStart: false,
  };

  if (config.elasticsearch.username && config.elasticsearch.password) {
    clientConfig.auth = {
      username: config.elasticsearch.username,
      password: config.elasticsearch.password,
    };
  }

  esClient = new Client(clientConfig);

  try {
    const info = await esClient.info();
    logger.info(`Elasticsearch connected: cluster "${info?.cluster_name ?? 'unknown'}", version ${info?.version?.number ?? 'unknown'}`);
    await ensureIndices();
    return esClient;
  } catch (error) {
    logger.warn('Elasticsearch connection failed (non-critical):', error.message);
    // Drop the client so getEsClient() returns null and callers no-op fast
    // instead of retrying against a dead server on every request
    try { await esClient.close(); } catch { /* ignore */ }
    esClient = null;
    return null;
  }
};

const ensureIndices = async () => {
  const indexName = config.elasticsearch.indexArticles;

  try {
    const exists = await esClient.indices.exists({ index: indexName });
    if (!exists) {
      await esClient.indices.create({
        index: indexName,
        settings: {
            analysis: {
              analyzer: {
                arabic_analyzer: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: ['lowercase', 'arabic_normalization', 'arabic_stemmer', 'stop'],
                },
                arabic_search_analyzer: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: ['lowercase', 'arabic_normalization', 'arabic_stemmer'],
                },
              },
              filter: {
                arabic_stemmer: {
                  type: 'stemmer',
                  language: 'arabic',
                },
              },
            },
            number_of_shards: 1,
            number_of_replicas: 1,
          },
          mappings: {
            properties: {
              id: { type: 'keyword' },
              title: {
                type: 'text',
                analyzer: 'arabic_analyzer',
                search_analyzer: 'arabic_search_analyzer',
                fields: {
                  keyword: { type: 'keyword', normalizer: 'lowercase' },
                  suggest: { type: 'completion', analyzer: 'arabic_analyzer' },
                },
              },
              subtitle: {
                type: 'text',
                analyzer: 'arabic_analyzer',
                search_analyzer: 'arabic_search_analyzer',
              },
              content: {
                type: 'text',
                analyzer: 'arabic_analyzer',
                search_analyzer: 'arabic_search_analyzer',
                index_options: 'offsets',
              },
              excerpt: {
                type: 'text',
                analyzer: 'arabic_analyzer',
                search_analyzer: 'arabic_search_analyzer',
              },
              slug: { type: 'keyword' },
              tags: { type: 'keyword' },
              category: { type: 'keyword' },
              categoryName: {
                type: 'text',
                analyzer: 'arabic_analyzer',
                fields: { keyword: { type: 'keyword' } },
              },
              author: { type: 'keyword' },
              authorName: { type: 'keyword' },
              status: { type: 'keyword' },
              isBreaking: { type: 'boolean' },
              isFeatured: { type: 'boolean' },
              publishedAt: { type: 'date' },
              views: { type: 'integer' },
              readingTimeMin: { type: 'integer' },
              ogImage: {
                properties: {
                  url: { type: 'keyword', index: false },
                  alt: { type: 'text', analyzer: 'arabic_analyzer' },
                },
              },
            },
          },
      });
      logger.info(`Elasticsearch index "${indexName}" created`);
    }
  } catch (error) {
    logger.error('Failed to ensure Elasticsearch indices:', error.message);
  }
};

const getEsClient = () => esClient;

const disconnectElasticsearch = async () => {
  if (esClient) {
    await esClient.close();
    esClient = null;
    logger.info('Elasticsearch client closed');
  }
};

module.exports = {
  connectElasticsearch,
  getEsClient,
  disconnectElasticsearch,
  ensureIndices,
};
