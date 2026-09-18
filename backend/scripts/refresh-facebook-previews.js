'use strict';

/**
 * Repair the share cards Facebook already cached wrong.
 *
 * Facebook scrapes a URL once and reuses that scrape for every later share, so
 * the articles that went out while og:image was served as a format-negotiated
 * `.png` still carry the blank 1200×630 box even though the page now serves a
 * pinned JPEG. Only asking Facebook to scrape the URL again replaces what it
 * holds.
 *
 * Re-scraping refreshes the cache behind every future share, and Facebook
 * re-renders most existing link attachments from it. A post whose attachment
 * does not pick up the new image has to be deleted and posted again — the
 * script cannot do that for you.
 *
 * Usage:
 *   node scripts/refresh-facebook-previews.js [--dry] [--limit=N] [--since=YYYY-MM-DD]
 *
 * Requires FACEBOOK_PAGE_ID + FACEBOOK_PAGE_ACCESS_TOKEN, the same pair the
 * announcer uses. Graph is rate limited, so this paces itself.
 */

require('dotenv').config();
const mongoose = require('mongoose');

const arg = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const dry = process.argv.includes('--dry');
  const limit = parseInt(arg('limit'), 10) || 0;
  const since = arg('since') ? new Date(arg('since')) : null;

  const { isConfigured, articleUrl, rescrape } = require('../src/services/facebookService');
  if (!isConfigured()) {
    console.error('FACEBOOK_PAGE_ID / FACEBOOK_PAGE_ACCESS_TOKEN not set — nothing to do.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alwid_news');
  const Article = require('../src/models/Article');
  require('../src/models/Category');

  const filter = { status: 'published', isDeleted: { $ne: true } };
  if (since) filter.publishedAt = { $gte: since };

  let query = Article.find(filter)
    .sort('-publishedAt')
    .populate('category', 'slug')
    .select('title slug category publishedAt');
  if (limit) query = query.limit(limit);

  const articles = await query.lean();
  console.log(`${articles.length} published article(s) to refresh${dry ? ' (--dry)' : ''}:\n`);

  let ok = 0;
  let failed = 0;

  for (const article of articles) {
    const url = articleUrl(article);
    if (dry) {
      console.log(`  · ${url}`);
      continue;
    }
    try {
      await rescrape(url);
      ok += 1;
      console.log(`  ✓ ${article.title}`);
    } catch (err) {
      failed += 1;
      console.log(`  ✗ ${article.title} — ${err.message}`);
    }
    // Graph's per-app scrape budget is small; one a second keeps a full archive
    // run inside it.
    await sleep(1000);
  }

  if (!dry) console.log(`\nRefreshed ${ok}, failed ${failed}.`);
  await mongoose.connection.close();
})().catch((err) => { console.error(err); process.exit(1); });
