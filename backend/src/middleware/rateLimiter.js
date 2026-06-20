'use strict';

const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const config = require('../config/env');
const { errors } = require('../utils/responseHelper');
const logger = require('../utils/logger');

// Lazy Redis client getter to avoid circular dependency at startup
const getRedisClient = () => {
  try {
    const { getRedisClient: getClient } = require('../config/redis');
    return getClient();
  } catch {
    return null;
  }
};

/**
 * Create a rate limiter with optional Redis backing
 */
const createLimiter = (options) => {
  const { windowMs, max, message, keyPrefix } = options;

  const limiterConfig = {
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded: ${req.ip} on ${req.path}`);
      return errors.tooManyRequests(res, message);
    },
    skip: (req) => {
      // Skip rate limiting in test environment
      return process.env.NODE_ENV === 'test';
    },
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise IP
      if (req.user) return `user:${req.user._id}`;
      return req.ip;
    },
  };

  // Add Redis store if available
  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      limiterConfig.store = new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
        prefix: `rl:${keyPrefix}:`,
      });
    } catch (err) {
      logger.warn('Redis rate limit store unavailable, using memory store:', err.message);
    }
  }

  return rateLimit(limiterConfig);
};

/**
 * Public endpoints: 100 requests per minute
 */
const publicLimiter = createLimiter({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.publicMax,
  message: 'لقد تجاوزت الحد المسموح به من الطلبات، يرجى الانتظار دقيقة',
  keyPrefix: 'public',
});

/**
 * Auth endpoints: 5 requests per minute
 */
const authLimiter = createLimiter({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authMax,
  message: 'لقد تجاوزت المحاولات المسموح بها لتسجيل الدخول، يرجى الانتظار دقيقة',
  keyPrefix: 'auth',
});

/**
 * Admin endpoints: 300 requests per minute
 */
const adminLimiter = createLimiter({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.adminMax,
  message: 'لقد تجاوزت الحد المسموح به من طلبات الإدارة',
  keyPrefix: 'admin',
});

/**
 * Strict limiter for password reset: 3 per hour
 */
const passwordResetLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: 'لقد تجاوزت الحد المسموح به لطلبات إعادة كلمة المرور',
  keyPrefix: 'pwd_reset',
});

/**
 * Upload limiter: 20 per 10 minutes
 */
const uploadLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: 'لقد تجاوزت الحد المسموح به لرفع الملفات',
  keyPrefix: 'upload',
});

/**
 * Search limiter: 30 per minute
 */
const searchLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'لقد تجاوزت الحد المسموح به لطلبات البحث',
  keyPrefix: 'search',
});

module.exports = {
  publicLimiter,
  authLimiter,
  adminLimiter,
  passwordResetLimiter,
  uploadLimiter,
  searchLimiter,
};
