'use strict';

const Article = require('../models/Article');
// Required for their side effect: populate('category') and populate('author')
// need the models registered, and this service must not depend on some other
// module having loaded them first.
require('../models/Category');
require('../models/User');
const config = require('../config/env');
const logger = require('../utils/logger');
const { bylineLine, AUTHOR_FIELDS } = require('../utils/byline');
// The Page post reads the same whichever route sends it.
const { articleUrl, buildMessage: pageMessage, plain } = require('./facebookService');

const API_URL = 'https://api.buffer.com';

/**
 * Only an article that went live in the last day is announced.
 *
 * The announcer runs on every save of a published article, and the whole
 * existing archive reads as never posted to X or Instagram — so without this,
 * fixing a typo in a two-year-old piece would put it on three networks. An
 * edit keeps the article's original publishedAt, so editing can never make an
 * old article look new; only an actual publish does.
 */
const ANNOUNCE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Channels change rarely; one lookup an hour keeps the API budget for posts. */
const CHANNELS_TTL_MS = 60 * 60 * 1000;

/** Inert until the API key is configured. */
const isConfigured = () => Boolean(config.buffer.apiKey);

const graphql = async (query, variables) => {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.buffer.apiKey}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.errors?.length) {
    throw new Error(body.errors?.[0]?.message || `Buffer API returned ${res.status}`);
  }
  return body.data;
};

/** Every channel on the account, connected or not. */
const listChannels = async () => {
  const { account } = await graphql('query { account { organizations { id } } }');
  const channels = [];
  for (const org of account.organizations) {
    const data = await graphql(
      `query Channels($input: ChannelsInput!) {
        channels(input: $input) {
          id service name isDisconnected isLocked
          linkShortening { isEnabled }
        }
      }`,
      { input: { organizationId: org.id } }
    );
    channels.push(...data.channels);
  }
  return channels;
};

let channelCache = { at: 0, channels: null };

/** The channels that can take a post right now, cached for an hour. */
const connectedChannels = async () => {
  if (channelCache.channels && Date.now() - channelCache.at < CHANNELS_TTL_MS) {
    return channelCache.channels;
  }
  const usable = [];
  for (const channel of await listChannels()) {
    if (channel.isDisconnected || channel.isLocked) {
      logger.warn(
        `Buffer: skipping ${channel.service} "${channel.name}" — ` +
          (channel.isDisconnected ? 'disconnected, reconnect it in Buffer' : 'locked by the plan')
      );
    } else {
      usable.push(channel);
    }
  }
  channelCache = { at: Date.now(), channels: usable };
  return usable;
};

/**
 * The 1200×630 JPEG the article page already serves crawlers as og:image,
 * built exactly as ogImageSrc builds it in the frontend's seoUtils. Matching
 * it to the character means Cloudinary hands back the file it already made
 * rather than producing and billing a second one. 1200:630 is 1.905:1, inside
 * the 4:5 to 1.91:1 range Instagram accepts.
 */
const shareImage = (url) => {
  if (!url) return null;
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  return url
    .replace('/upload/', '/upload/f_jpg,q_auto,c_fill,g_auto,w_1200,h_630/')
    .replace(/\.(png|webp|avif|gif|jpeg|tiff?|bmp|heic)$/i, '.jpg');
};

/** The link as a person reads it: Arabic, not a wall of %D8%. */
const readable = (link) => {
  try {
    return decodeURI(link);
  } catch {
    return link;
  }
};

// X's own count (twitter-text v3): characters in these ranges weigh 1, every
// other one 2, an emoji 2 however many characters make it up, a link 23.
const X_LIMIT = 280;
const X_LINK = 23;
const X_LIGHT = [[0x0000, 0x10ff], [0x2000, 0x200d], [0x2010, 0x201f], [0x2032, 0x2037]];

/**
 * How much of X's 280 a piece of text uses, never less than X will count.
 * Every character is weighed on its own, so an emoji made of several comes
 * out heavier than it is, and a link costs its full 23 on top of its own
 * characters wherever one could begin. X would also read a name like "X.com"
 * in a headline as a link, so guessing high is the only safe way to guess.
 */
const xWeight = (text) => {
  const normal = text.normalize('NFC'); // X counts after normalising too
  let weight = X_LINK * (normal.match(/https?:\/\/|\.[a-z]/gi) || []).length;
  for (const ch of normal) {
    const cp = ch.codePointAt(0);
    weight += X_LIGHT.some(([lo, hi]) => cp >= lo && cp <= hi) ? 1 : 2;
  }
  return weight;
};

/**
 * What each network gets, keyed by Buffer's service name. The article's link
 * is the point everywhere; how it travels differs:
 *
 *  - X builds a card from the page's Open Graph tags, so headline, writer
 *    and link.
 *  - Facebook gets the link as an attachment, so the Page shows a card rather
 *    than a bare URL, under the same message the direct Page announcer writes.
 *  - Instagram has no link posts and no clickable links in captions. Every
 *    post is a picture, so it gets the cover with the link written out in the
 *    caption. An article without a cover cannot go there at all.
 *
 * `field` is the article's once-only claim for that network; `build` returns
 * null when the article cannot go to it.
 */
const NETWORKS = {
  twitter: {
    label: 'X',
    field: 'xPostedAt',
    // The headline is cut, one character at a time, until headline, writer,
    // blank line and link weigh no more than 280. Only if no headline fits
    // beside the writer's name does the name give way.
    build: (article, link) => {
      const fit = (byline) => {
        for (let room = 200; room > 0; room -= 1) {
          const head = `${plain(article.title, room)}${byline}`;
          if (xWeight(head) + 2 + X_LINK <= X_LIMIT) return head;
        }
        return null;
      };
      const byline = bylineLine(article);
      const head = (byline ? fit(`\n${byline}`) : null) ?? fit('');
      return { text: `${head}\n\n${link}` };
    },
  },
  facebook: {
    label: 'Facebook',
    field: 'facebookPostedAt',
    build: (article, link) => ({
      text: pageMessage(article),
      metadata: { facebook: { type: 'post', linkAttachment: { url: link } } },
    }),
  },
  instagram: {
    label: 'Instagram',
    field: 'instagramPostedAt',
    build: (article, link) => {
      const image = shareImage(article.ogImage?.url);
      if (!image) return null;
      return {
        text: `${pageMessage(article)}\n\n${readable(link)}`,
        assets: [{ image: { url: image } }],
        metadata: { instagram: { type: 'post', shouldShareToFeed: true } },
      };
    },
  },
};

const CREATE_POST = `
  mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      ... on PostActionSuccess { post { id status error { message } } }
      ... on MutationError { message }
    }
  }
`;

/**
 * Publish straight away rather than into the posting schedule — news is news
 * when it lands, and the free plan's queue holds only ten posts per channel.
 * `draft` saves it in Buffer unpublished instead, for checking a setup.
 */
const createPost = async (channelId, { text, assets = [], metadata }, { draft = false } = {}) => {
  const { createPost: result } = await graphql(CREATE_POST, {
    input: {
      channelId,
      text,
      assets,
      metadata,
      mode: draft ? 'addToQueue' : 'shareNow',
      schedulingType: 'automatic',
      needsApproval: false,
      saveToDraft: draft,
    },
  });
  if (!result?.post) throw new Error(result?.message || 'Buffer returned no post');
  if (result.post.status === 'error') {
    throw new Error(result.post.error?.message || 'Buffer could not publish the post');
  }
  return result.post;
};

const announceable = () => ({
  status: 'published',
  isDeleted: { $ne: true },
  publishedAt: { $gte: new Date(Date.now() - ANNOUNCE_WINDOW_MS) },
});

/**
 * Load the page and its picture once before any network is told about them.
 * Every network fetches both the moment the post goes out and keeps what it
 * saw, so a page on its first render or a picture Cloudinary has not produced
 * yet is exactly the bad first read that outlives the moment that caused it.
 * Best effort: nothing here can stop the post.
 */
const warmUp = (urls) =>
  Promise.allSettled(
    urls.filter(Boolean).map((url) =>
      fetch(url, { signal: AbortSignal.timeout(15000) }).then((res) => res.arrayBuffer())
    )
  );

/**
 * One network, exactly once: claim its field, post to its channels, and
 * release the claim if the post fails so the next save of the article tries
 * again instead of silently losing it.
 */
const announceOn = async (article, channels, { label, field, build }, warm) => {
  const payload = build(article, articleUrl(article));
  if (!payload) return;

  const claim = await Article.updateOne(
    { ...announceable(), _id: article._id, [field]: null },
    { $set: { [field]: new Date() } }
  );
  if (claim.modifiedCount !== 1) return; // already announced, or no longer eligible

  try {
    await warm();
    for (const channel of channels) await createPost(channel.id, payload);
    logger.info(`📢 Buffer → ${label}: announced "${article.title}"`);
  } catch (err) {
    logger.error(`Buffer → ${label} failed for "${article.title}": ${err.message}`);
    // The channel may have been disconnected or removed; look again next time.
    channelCache.at = 0;
    await Article.updateOne({ _id: article._id }, { $set: { [field]: null } }).catch(() => {});
  }
};

/**
 * Post an article to every network connected in Buffer, each exactly once,
 * ever. Same guard as the Telegram and Facebook announcers, one claim per
 * network so a failure on one can neither block nor duplicate another.
 *
 * Never throws — announcing must not be able to fail a publish.
 */
const announceViaBuffer = async (articleId) => {
  if (!isConfigured()) return;

  try {
    // Most calls are edits of articles that are already out everywhere, and
    // answering those from the database keeps them off Buffer's API budget.
    const article = await Article.findOne({
      ...announceable(),
      _id: articleId,
      $or: Object.values(NETWORKS).map(({ field }) => ({ [field]: null })),
    })
      .populate('category', 'name slug')
      .populate('author', AUTHOR_FIELDS)
      .select('title excerpt slug category author ogImage')
      .lean();
    if (!article) return;

    const channels = await connectedChannels();
    let warming;
    const warm = () =>
      (warming ??= warmUp([articleUrl(article), shareImage(article.ogImage?.url)]));

    await Promise.all(
      Object.entries(NETWORKS).map(([service, network]) => {
        const targets = channels.filter((c) => c.service === service);
        return targets.length ? announceOn(article, targets, network, warm) : null;
      })
    );
  } catch (err) {
    logger.error(`Buffer announce failed: ${err.message}`);
  }
};

module.exports = {
  isConfigured,
  announceViaBuffer,
  listChannels,
  createPost,
  NETWORKS,
  articleUrl,
};
