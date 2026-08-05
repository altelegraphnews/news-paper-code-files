'use strict';

const config = require('../config/env');
const logger = require('./logger');

/**
 * Ask the Next.js frontend to drop cached data on demand (ISR), so admin
 * changes appear on the site immediately. Best-effort; never throws.
 * @param {string[]} tags  cache tags to revalidate (e.g. ['nav','homepage'])
 * @param {string[]} paths route paths to revalidate (e.g. ['/'])
 */
let warnedMissingConfig = false;

const revalidateFrontend = (tags = [], paths = []) => {
  const secret = config.revalidateSecret;
  const base = config.frontend.url;
  if (!secret || !base) {
    // Silence here meant a misconfigured deploy looked identical to a working
    // one: the admin's cache-clear would report success, Redis really would be
    // emptied, and the site would still serve its ISR copy with nothing
    // anywhere saying why. Warn once rather than on every write.
    if (!warnedMissingConfig) {
      warnedMissingConfig = true;
      logger.warn(
        `Frontend revalidation disabled — ${!secret ? 'REVALIDATE_SECRET' : 'FRONTEND_URL'} is not set. ` +
        'Admin changes will wait out the ISR window instead of appearing immediately.'
      );
    }
    return;
  }
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
