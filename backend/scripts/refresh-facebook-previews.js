'use strict';

/**
 * Make Facebook re-read every article's share card.
 *
 * Facebook scrapes a URL once and reuses that scrape for every later share, so
 * a card keeps whatever picture address the page served when it was first
 * shared. Two archives of cards need repairing this way:
 *  - articles that went out while og:image was a format-negotiated `.png`
 *    still carry a blank 1200×630 box;
 *  - every article shared before 2026-11-01 points at its picture on
 *    Cloudinary, which stopped serving the account on 2026-10-31 and only
 *    answers from its cache until that runs out. The pages now serve the same
 *    picture from media.al-telegraph.com.
 * Only asking Facebook to scrape the URL again replaces what it holds.
 *
 * Re-scraping refreshes the cache behind every future share, and Facebook
 * re-renders most existing link attachments from it. A post whose attachment
 * does not pick up the new image has to be deleted and posted again — the
 * script cannot do that for you.
 *
 * Usage (production database through Railway):
 *   FACEBOOK_SCRAPE_TOKEN=<token> railway run --service backend \
 *     node scripts/refresh-facebook-previews.js [--dry] [--limit=N] [--since=YYYY-MM-DD] [--skip=N]
 *
 * The token can be any Graph token: an app token written APP_ID|APP_SECRET,
 * a user token from the Graph API Explorer, or the Page token the direct
 * announcer uses (FACEBOOK_PAGE_ACCESS_TOKEN, the fallback). Newest articles
 * go first, since they are the ones still being shared. Graph rate-limits
 * scrapes; on a limit the script waits and carries on with the same article,
 * and --skip=N resumes a run that was stopped after N articles.
 */

require('dotenv').config();
const mongoose = require('mongoose');

const arg = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Graph's throttling codes: app, user, page and custom limits.
const RATE_LIMITED = new Set([4, 17, 32, 613]);
const RATE_WAIT_MS = 10 * 60 * 1000;
const MAX_WAITS = 12;

(async () => {
  const dry = process.argv.includes('--dry');
  const limit = parseInt(arg('limit'), 10) || 0;
  const skip = parseInt(arg('skip'), 10) || 0;
  const since = arg('since') ? new Date(arg('since')) : null;

  const { articleUrl, rescrape } = require('../src/services/facebookService');
  const token = process.env.FACEBOOK_SCRAPE_TOKEN || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!token && !dry) {
    console.error('Set FACEBOOK_SCRAPE_TOKEN (or FACEBOOK_PAGE_ACCESS_TOKEN) — nothing to do.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alwid_news');
  const Article = require('../src/models/Article');
  require('../src/models/Category');

  const filter = { status: 'published', isDeleted: { $ne: true } };
  if (since) filter.publishedAt = { $gte: since };

  let query = Article.find(filter)
    .sort('-publishedAt')
    .skip(skip)
    .populate('category', 'slug')
    .select('title slug category publishedAt');
  if (limit) query = query.limit(limit);

  const articles = await query.lean();
  console.log(`${articles.length} published article(s) to refresh${dry ? ' (--dry)' : ''}:\n`);

  let ok = 0;
  let failed = 0;

  for (const [i, article] of articles.entries()) {
    const url = articleUrl(article);
    if (dry) {
      console.log(`  · ${url}`);
      continue;
    }
    for (let waits = 0; ; waits += 1) {
      try {
        await rescrape(url, token);
        ok += 1;
        console.log(`  ✓ ${skip + i + 1} ${article.title}`);
      } catch (err) {
        if (RATE_LIMITED.has(err.code) && waits < MAX_WAITS) {
          console.log(`  … rate limited at ${skip + i + 1}, waiting ${RATE_WAIT_MS / 60000} min`);
          await sleep(RATE_WAIT_MS);
          continue;
        }
        if (err.code === 190) {
          // Expired or invalid token: every later call would fail the same way.
          console.error(`\nToken rejected at ${skip + i + 1}: ${err.message}`);
          console.error(`Resume with a new token and --skip=${skip + i}.`);
          await mongoose.connection.close();
          process.exit(1);
        }
        failed += 1;
        console.log(`  ✗ ${skip + i + 1} ${article.title} — ${err.message}`);
      }
      break;
    }
    // Graph's per-app scrape budget is small; one a second keeps a full archive
    // run inside it.
    await sleep(1000);
  }

  if (!dry) console.log(`\nRefreshed ${ok}, failed ${failed}.`);
  await mongoose.connection.close();
})().catch((err) => { console.error(err); process.exit(1); });
