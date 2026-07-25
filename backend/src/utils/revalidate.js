'use strict';

const config = require('../config/env');
const logger = require('./logger');

/**
 * Ask the Next.js frontend to drop cached data on demand (ISR), so admin
 * changes appear on the site immediately. Best-effort; never throws.
 * @param {string[]} tags  cache tags to revalidate (e.g. ['nav','homepage'])
 * @param {string[]} paths route paths to revalidate (e.g. ['/'])
 */
const revalidateFrontend = (tags = [], paths = []) => {
  const secret = config.revalidateSecret;
  const base = config.frontend.url;
  if (!secret || !base) return;
  const queries = [
    ...tags.map((t) => `tag=${encodeURIComponent(t)}`),
    ...paths.map((p) => `path=${encodeURIComponent(p)}`),
  ];
  for (const q of queries) {
    fetch(`${base}/api/revalidate?secret=${encodeURIComponent(secret)}&${q}`, { method: 'POST' })
      .catch((err) => logger.warn('Revalidate failed:', err.message));
  }
};

module.exports = { revalidateFrontend };
