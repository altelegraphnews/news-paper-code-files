'use strict';

const { Worker, Queue } = require('bullmq');
const config = require('../config/env');
const Article = require('../models/Article');
const logger = require('../utils/logger');

const connection = {
  host: config.bull.redis.host,
  port: config.bull.redis.port,
  password: config.bull.redis.password,
};

const recalculateTrending = async () => {
  try {
    const { getRedisClient } = require('../config/redis');
    let redis;
    try { redis = getRedisClient(); } catch { return; }

    // Get articles with highest view velocity (views / hours since publish)
    const articles = await Article.find({
      status: 'published',
      isDeleted: { $ne: true },
      publishedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    })
      .sort({ 'views.total': -1 })
      .limit(20)
      .populate('category', 'name slug color')
      .select('title slug ogImage category views publishedAt readingTimeMin')
      .lean();

    // Apply recency decay
    const now = Date.now();
    const HALF_LIFE = 48 * 60 * 60 * 1000;

    const scored = articles
      .map((a) => {
        const age = now - new Date(a.publishedAt).getTime();
        const score = (a.views?.total || 0) * Math.exp(-age / HALF_LIFE);
        return { ...a, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(({ score, ...a }) => a);

    await redis.setex('trending:articles', 15 * 60, JSON.stringify(scored));
    logger.info('Trending articles recalculated');
  } catch (err) {
    logger.error('Trending recalculation error:', err.message);
  }
};

let worker = null;
let scheduledQueue = null;

const startTrendingWorker = () => {
  worker = new Worker('trending', async (job) => {
    if (job.name === 'recalculate') await recalculateTrending();
  }, { connection });

  worker.on('failed', (job, err) => logger.error(`Trending job failed:`, err.message));

  // Schedule repeating job every 15 minutes
  scheduledQueue = new Queue('trending', { connection });
  scheduledQueue.upsertJobScheduler('recalculate-trending', { every: 15 * 60 * 1000 }, {
    name: 'recalculate',
    opts: { removeOnComplete: 5, removeOnFail: 3 },
  }).catch((err) => logger.error('Failed to schedule trending job:', err.message));

  logger.info('Trending worker started');
  return worker;
};

const stopTrendingWorker = async () => {
  if (worker) { await worker.close(); }
  if (scheduledQueue) { await scheduledQueue.close(); }
};

module.exports = { startTrendingWorker, stopTrendingWorker };
