'use strict';

require('dotenv').config();

const required = (key) => {
  const val = process.env[key];
  if (!val && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
};

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  apiVersion: process.env.API_VERSION || 'v1',

  mongodb: {
    uri: process.env.NODE_ENV === 'test'
      ? (process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/alwid_news_test')
      : (process.env.MONGODB_URI || 'mongodb://localhost:27017/alwid_news'),
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'alwid-dev-access-secret-CHANGE-IN-PRODUCTION',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'alwid-dev-refresh-secret-CHANGE-IN-PRODUCTION',
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
    resetExpires: process.env.JWT_RESET_EXPIRES || '1h',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB, 10) || 0,
    tls: process.env.REDIS_TLS === 'true',
  },

  elasticsearch: {
    node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
    username: process.env.ELASTICSEARCH_USERNAME || '',
    password: process.env.ELASTICSEARCH_PASSWORD || '',
    indexArticles: process.env.ELASTICSEARCH_INDEX_ARTICLES || 'alwid_articles',
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || 'alwid_articles',
  },

  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    fromName: process.env.EMAIL_FROM_NAME || 'الود - AL-WID',
    fromAddress: process.env.EMAIL_FROM_ADDRESS || 'noreply@alwid.com',
  },

  webPush: {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@alwid.com',
  },

  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:3000',
    allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001').split(','),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
    publicMax: parseInt(process.env.RATE_LIMIT_PUBLIC_MAX, 10) || 100,
    authMax: parseInt(process.env.RATE_LIMIT_AUTH_MAX, 10) || 5,
    adminMax: parseInt(process.env.RATE_LIMIT_ADMIN_MAX, 10) || 300,
  },

  sitemap: {
    baseUrl: process.env.SITEMAP_BASE_URL || 'https://alwid.com',
    outputDir: process.env.SITEMAP_OUTPUT_DIR || './public/sitemaps',
  },

  bull: {
    redis: {
      host: process.env.BULL_REDIS_HOST || 'localhost',
      port: parseInt(process.env.BULL_REDIS_PORT, 10) || 6379,
      password: process.env.BULL_REDIS_PASSWORD || undefined,
    },
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/alwid.log',
  },

  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@alwid.com',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
  },
};

module.exports = config;
