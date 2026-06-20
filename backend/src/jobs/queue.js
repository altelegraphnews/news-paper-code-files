'use strict';

const { Queue } = require('bullmq');
const config = require('../config/env');
const logger = require('../utils/logger');

const connection = {
  host: config.bull.redis.host,
  port: config.bull.redis.port,
  password: config.bull.redis.password,
  // Railway private network is IPv6-only; ioredis defaults to IPv4.
  family: 0,
  // Fail fast when Redis is unavailable instead of buffering commands
  // forever — queue.add() callers wrap in try/catch and treat it as optional.
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  retryStrategy: (times) => Math.min(times * 2000, 30000),
};

let emailQueue = null;
let sitemapQueue = null;
let notificationQueue = null;
let trendingQueue = null;

// BullMQ's add() waits for a Redis connection indefinitely, which would hang
// HTTP responses when Redis is down. Race it against a short timeout so
// callers' try/catch treats queueing as optional infrastructure.
const ADD_TIMEOUT_MS = 3000;

const withAddTimeout = (queue) => {
  const originalAdd = queue.add.bind(queue);
  queue.add = (...args) =>
    Promise.race([
      originalAdd(...args),
      new Promise((_, reject) => {
        const t = setTimeout(
          () => reject(new Error(`queue(${queue.name}).add timed out — Redis unavailable`)),
          ADD_TIMEOUT_MS
        );
        if (t.unref) t.unref();
      }),
    ]);
  return queue;
};

const getEmailQueue = () => {
  if (!emailQueue) {
    emailQueue = withAddTimeout(new Queue('email', { connection, defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } } }));
  }
  return emailQueue;
};

const getSitemapQueue = () => {
  if (!sitemapQueue) {
    sitemapQueue = withAddTimeout(new Queue('sitemap', { connection, defaultJobOptions: { attempts: 2, backoff: { type: 'fixed', delay: 5000 } } }));
  }
  return sitemapQueue;
};

const getNotificationQueue = () => {
  if (!notificationQueue) {
    notificationQueue = withAddTimeout(new Queue('notification', { connection, defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 1000 } } }));
  }
  return notificationQueue;
};

const getTrendingQueue = () => {
  if (!trendingQueue) {
    trendingQueue = withAddTimeout(new Queue('trending', { connection }));
  }
  return trendingQueue;
};

const closeQueues = async () => {
  try {
    await Promise.all([
      emailQueue?.close(),
      sitemapQueue?.close(),
      notificationQueue?.close(),
      trendingQueue?.close(),
    ]);
    logger.info('All queues closed');
  } catch (err) {
    logger.error('Error closing queues:', err.message);
  }
};

module.exports = {
  getEmailQueue,
  getSitemapQueue,
  getNotificationQueue,
  getTrendingQueue,
  closeQueues,
};
