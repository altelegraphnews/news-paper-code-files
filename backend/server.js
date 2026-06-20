'use strict';

const config = require('./src/config/env');
const logger = require('./src/utils/logger');

// Uncaught exception / rejection handlers — must be first
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('UNHANDLED REJECTION:', reason);
  process.exit(1);
});

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const { connectDatabase } = require('./src/config/database');
const { connectRedis } = require('./src/config/redis');
const { connectElasticsearch } = require('./src/config/elasticsearch');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');
const { publicLimiter } = require('./src/middleware/rateLimiter');

// Route imports
const authRoutes = require('./src/routes/auth');
const articleRoutes = require('./src/routes/articles');
const categoryRoutes = require('./src/routes/categories');
const commentRoutes = require('./src/routes/comments');
const tickerRoutes = require('./src/routes/tickers');
const searchRoutes = require('./src/routes/search');
const analyticsRoutes = require('./src/routes/analytics');
const userRoutes = require('./src/routes/users');
const homepageRoutes = require('./src/routes/homepage');
const mediaRoutes = require('./src/routes/media');
const notificationRoutes = require('./src/routes/notifications');

const app = express();

// ─── Security & Middleware ───────────────────────────────────────────────────
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com', 'https://*.cloudinary.com'],
      connectSrc: ["'self'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // allow non-browser requests
    if (config.frontend.allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Canonical-Slug'],
}));

app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logging
if (config.env !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
    skip: (req) => req.path === '/health',
  }));
}

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', env: config.env, timestamp: new Date().toISOString() });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
const apiBase = `/api/${config.apiVersion}`;

app.use(`${apiBase}/auth`, authRoutes);
app.use(`${apiBase}/articles`, articleRoutes);
app.use(`${apiBase}/tags`, require('./src/routes/tags'));
app.use(`${apiBase}/categories`, categoryRoutes);
app.use(`${apiBase}/comments`, commentRoutes);
app.use(`${apiBase}/tickers`, tickerRoutes);
app.use(`${apiBase}/search`, searchRoutes);
app.use(`${apiBase}/analytics`, analyticsRoutes);
app.use(`${apiBase}/users`, userRoutes);
app.use(`${apiBase}/homepage`, homepageRoutes);
app.use(`${apiBase}/media`, mediaRoutes);
app.use(`${apiBase}/notifications`, notificationRoutes);

// ─── 404 & Error handlers ─────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Boot ─────────────────────────────────────────────────────────────────────
const start = async () => {
  try {
    // Connect to MongoDB
    await connectDatabase();

    // Connect to Redis (optional, graceful failure)
    try {
      await connectRedis();
    } catch (redisErr) {
      logger.warn('Redis unavailable, running without cache:', redisErr.message);
    }

    // Connect to Elasticsearch (optional, graceful failure)
    try {
      await connectElasticsearch();
    } catch (esErr) {
      logger.warn('Elasticsearch unavailable, running without search indexing:', esErr.message);
    }

    const PORT = config.port;
    const server = app.listen(PORT, () => {
      logger.info(`✅ AL-WID API running on port ${PORT} [${config.env}]`);
      logger.info(`📖 API base: http://localhost:${PORT}${apiBase}`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`${signal} received, shutting down gracefully...`);

      server.close(async () => {
        try {
          const mongoose = require('mongoose');
          await mongoose.connection.close();
          logger.info('MongoDB connection closed');

          const { closeQueues } = require('./src/jobs/queue');
          await closeQueues();
        } catch (err) {
          logger.error('Shutdown error:', err.message);
        }
        process.exit(0);
      });

      // Force exit after 10s
      setTimeout(() => process.exit(1), 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    return server;
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
};

start();

module.exports = app; // for tests
