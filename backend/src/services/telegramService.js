'use strict';

const Article = require('../models/Article');
// Required for its side effect: populate('category') needs the model
// registered, and this service must not depend on some other module having
// loaded it first.
require('../models/Category');
const config = require('../config/env');
const logger = require('../utils/logger');

const API_BASE = 'https://api.telegram.org';

/** Inert until both the bot token and the channel are configured. */
const isConfigured = () =>
  Boolean(config.telegram.botToken && config.telegram.channelId);

/** Telegram's HTML parse mode only needs these three escaped. */
const escapeHtml = (value) =>
  String(value ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

const trim = (text, max) => {
  const plain = String(text ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`;
};

/**
 * Slugs are Arabic, so the path has to be percent-encoded before Telegram
 * fetches it for the preview card.
 */
const articleUrl = (article) => {
  const base = (config.frontend.url || '').replace(/\/$/, '');
  const category = article.category?.slug || 'uncategorized';
  return encodeURI(`${base}/article/${category}/${article.slug}`);
};

const sendMessage = async (text) => {
  const res = await fetch(`${API_BASE}/bot${config.telegram.botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: config.telegram.channelId,
      text,
      parse_mode: 'HTML',
      // The preview card is the point — Telegram builds it from the page's
      // Open Graph tags, so the article's own image and headline carry it.
      disable_web_page_preview: false,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok !== true) {
    throw new Error(body.description || `Telegram API returned ${res.status}`);
  }
  return body.result;
};

/** The channel post: section, headline, excerpt, link. */
const buildMessage = (article) => {
  const lines = [];
  if (article.category?.name) lines.push(`🗞 <b>${escapeHtml(article.category.name)}</b>`);
  lines.push(`<b>${escapeHtml(trim(article.title, 200))}</b>`);

  const excerpt = trim(article.excerpt, 320);
  if (excerpt) lines.push('', escapeHtml(excerpt));

  lines.push('', articleUrl(article));
  return lines.join('\n');
};

/**
 * Post an article to the channel, exactly once, ever.
 *
 * An article can reach `published` through five different routes (create,
 * update, publish, approve, bulk status) and can be unpublished and published
 * again, so the guard has to live on the document rather than at the call
 * site. `telegramPostedAt` is claimed with a conditional update before the
 * request goes out: whichever route gets there first wins, and the others see
 * a modifiedCount of 0 and stop. If the send then fails the claim is released
 * so the next publish can retry.
 *
 * Never throws — announcing must not be able to fail a publish.
 */
const announceArticle = async (articleId) => {
  if (!isConfigured()) return;

  let claimed = false;
  try {
    const claim = await Article.updateOne(
      { _id: articleId, status: 'published', isDeleted: { $ne: true }, telegramPostedAt: null },
      { $set: { telegramPostedAt: new Date() } }
    );
    if (claim.modifiedCount !== 1) return; // already announced, or not published
    claimed = true;

    const article = await Article.findById(articleId)
      .populate('category', 'name slug')
      .select('title excerpt slug category')
      .lean();
    if (!article) throw new Error('article vanished between claim and send');

    await sendMessage(buildMessage(article));
    logger.info(`📣 Telegram: announced "${article.title}"`);
  } catch (err) {
    logger.error(`Telegram announce failed: ${err.message}`);
    if (claimed) {
      // Let a later publish try again rather than silently losing the post.
      await Article.updateOne({ _id: articleId }, { $set: { telegramPostedAt: null } })
        .catch(() => {});
    }
  }
};

module.exports = { isConfigured, announceArticle, buildMessage, articleUrl };
