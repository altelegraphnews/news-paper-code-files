'use strict';

const Article = require('../models/Article');
// Required for its side effect: populate('category') needs the model
// registered, and this service must not depend on some other module having
// loaded it first.
require('../models/Category');
const config = require('../config/env');
const logger = require('../utils/logger');

// Pinned rather than floating: Graph drops old versions on a schedule, and a
// silent bump is how a working integration starts failing after a deploy.
const GRAPH_VERSION = 'v21.0';
const API_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

/** Inert until both the page and its token are configured. */
const isConfigured = () =>
  Boolean(config.facebook.pageId && config.facebook.pageAccessToken);

/**
 * Unlike Telegram there is no parse mode here — a Page post's `message` is
 * plain text, so any markup would be posted literally. Stripping tags and
 * collapsing whitespace also flattens a hard-broken headline back onto one
 * line, which is what we want off the article page.
 */
const plain = (text, max) => {
  const stripped = String(text ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (stripped.length <= max) return stripped;
  const cut = stripped.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`;
};

/**
 * Slugs are Arabic, so the path has to be percent-encoded before Facebook
 * fetches it to build the preview card.
 */
const articleUrl = (article) => {
  const base = (config.frontend.url || '').replace(/\/$/, '');
  const category = article.category?.slug || 'uncategorized';
  return encodeURI(`${base}/article/${category}/${article.slug}`);
};

/**
 * Make Facebook re-read the page's Open Graph tags before it is asked to build
 * a card from them.
 *
 * Facebook caches its scrape of a URL and reuses it for every later share, so
 * whatever it saw the first time is what readers keep seeing. The first time is
 * usually this service, a second after the article went live — before the
 * frontend's ISR entry for that URL is warm. One bad scrape then outlives the
 * problem that caused it. Asking for a fresh scrape costs one request and takes
 * the cache out of the equation; the same call is what repairs an article whose
 * card is already wrong (see scripts/refresh-facebook-previews.js).
 *
 * Best effort on purpose: if this fails the post still goes out.
 */
const rescrape = async (link) => {
  const res = await fetch(`${API_BASE}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: link, scrape: true, access_token: config.facebook.pageAccessToken }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    throw new Error(body.error?.message || `Graph API returned ${res.status}`);
  }
  return body;
};

/**
 * The link is passed as its own field rather than pasted into the message, so
 * Facebook attaches a real preview card built from the page's Open Graph tags
 * instead of rendering a bare URL in the body.
 */
const postToFeed = async ({ message, link }) => {
  const res = await fetch(`${API_BASE}/${config.facebook.pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, link, access_token: config.facebook.pageAccessToken }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    throw new Error(body.error?.message || `Graph API returned ${res.status}`);
  }
  return body;
};

/** The Page post: section, headline, excerpt. The link rides alongside. */
const buildMessage = (article) => {
  const lines = [];
  if (article.category?.name) lines.push(`🗞 ${plain(article.category.name, 80)}`);
  lines.push(plain(article.title, 200));

  const excerpt = plain(article.excerpt, 320);
  if (excerpt) lines.push('', excerpt);

  return lines.join('\n');
};

/**
 * Post an article to the Page, exactly once, ever.
 *
 * Same guard as the Telegram announcer and for the same reason: an article can
 * reach `published` through five different routes and can be unpublished and
 * published again, so the claim has to live on the document rather than at the
 * call site. `facebookPostedAt` is deliberately a separate field from
 * `telegramPostedAt` — one network being down, throttled or misconfigured must
 * not consume the other's claim, and the whole existing archive, every article
 * of which already carries a `telegramPostedAt`, must not be treated as
 * already announced here.
 *
 * Never throws — announcing must not be able to fail a publish.
 */
const announceOnFacebook = async (articleId) => {
  if (!isConfigured()) return;

  let claimed = false;
  try {
    const claim = await Article.updateOne(
      { _id: articleId, status: 'published', isDeleted: { $ne: true }, facebookPostedAt: null },
      { $set: { facebookPostedAt: new Date() } }
    );
    if (claim.modifiedCount !== 1) return; // already announced, or not published
    claimed = true;

    const article = await Article.findById(articleId)
      .populate('category', 'name slug')
      .select('title excerpt slug category')
      .lean();
    if (!article) throw new Error('article vanished between claim and send');

    const link = articleUrl(article);
    await rescrape(link).catch((e) =>
      logger.warn(`Facebook rescrape failed for ${link}: ${e.message}`)
    );
    await postToFeed({ message: buildMessage(article), link });
    logger.info(`📘 Facebook: announced "${article.title}"`);
  } catch (err) {
    logger.error(`Facebook announce failed: ${err.message}`);
    if (claimed) {
      // Let a later publish try again rather than silently losing the post.
      await Article.updateOne({ _id: articleId }, { $set: { facebookPostedAt: null } })
        .catch(() => {});
    }
  }
};

module.exports = { isConfigured, announceOnFacebook, buildMessage, articleUrl, rescrape };
