'use strict';

const Redis = require('ioredis');
const config = require('./env');
const logger = require('../utils/logger');

let redisClient = null;

const getRedisConfig = () => {
  const cfg = {
    host: config.redis.host,
    port: config.redis.port,
    db: config.redis.db,
    // Railway's private network is IPv6-only; ioredis defaults to IPv4.
    // family: 0 lets Node resolve both A and AAAA records.
    family: 0,
    retryStrategy: (times) => {
      const delay = Math.min(times * 100, 3000);
      logger.warn(`Redis retry attempt ${times}, waiting ${delay}ms`);
      return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  };

  if (config.redis.password) {
    cfg.password = config.redis.password;
  }

  if (config.redis.tls) {
    cfg.tls = {};
  }

  return cfg;
};

const connectRedis = async () => {
  if (redisClient) return redisClient;

  redisClient = new Redis(getRedisConfig());

  redisClient.on('connect', () => {
    logger.info('Redis client connected');
  });

  redisClient.on('ready', () => {
    logger.info('Redis client ready');
  });

  redisClient.on('error', (err) => {
    logger.error('Redis client error:', err.message);
  });

  redisClient.on('close', () => {
    logger.warn('Redis client connection closed');
  });

  redisClient.on('reconnecting', () => {
    logger.info('Redis client reconnecting...');
  });

  // Wait for ready state. On failure, drop the client entirely — otherwise
  // ioredis keeps reconnecting and every command stalls ~5s in the offline
  // queue before erroring (the admin dashboard hung on /analytics/trending).
  // With a null client, getRedisClient() throws fast and callers no-op.
  try {
    await new Promise((resolve, reject) => {
      if (redisClient.status === 'ready') return resolve();
      redisClient.once('ready', resolve);
      redisClient.once('error', reject);
      setTimeout(() => reject(new Error('Redis connection timeout')), 10000);
    });
  } catch (err) {
    redisClient.disconnect();
    redisClient = null;
    throw err;
  }

  return redisClient;
};

const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return redisClient;
};

const disconnectRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis client disconnected');
  }
};

// Cache helpers
const cacheGet = async (key) => {
  try {
    const client = getRedisClient();
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.error('Redis cacheGet error:', error.message);
    return null;
  }
};

const cacheSet = async (key, value, ttlSeconds = 300) => {
  try {
    const client = getRedisClient();
    await client.setex(key, ttlSeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    logger.error('Redis cacheSet error:', error.message);
    return false;
  }
};

const cacheDel = async (...keys) => {
  try {
    const client = getRedisClient();
    await client.del(...keys);
    return true;
  } catch (error) {
    logger.error('Redis cacheDel error:', error.message);
    return false;
  }
};

const cacheDelPattern = async (pattern) => {
  try {
    const client = getRedisClient();
    let cursor = '0';
    let deleted = 0;
    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await client.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== '0');
    return deleted;
  } catch (error) {
    logger.error('Redis cacheDelPattern error:', error.message);
    return 0;
  }
};

const incrementViewCount = async (articleId) => {
  try {
    const client = getRedisClient();
    const key = `views:${articleId}`;
    const count = await client.incr(key);
    // Expire after 25 hours to allow 24h window calculations
    if (count === 1) {
      await client.expire(key, 90000);
    }
    return count;
  } catch (error) {
    logger.error('Redis incrementViewCount error:', error.message);
    return 0;
  }
};

module.exports = {
  connectRedis,
  getRedisClient,
  disconnectRedis,
  cacheGet,
  cacheSet,
  cacheDel,
  cacheDelPattern,
  incrementViewCount,
};
