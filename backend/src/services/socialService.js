'use strict';

const { announceArticle: announceOnTelegram } = require('./telegramService');
const { announceOnFacebook } = require('./facebookService');

/**
 * Fan one publish out to every configured network.
 *
 * The controller calls this from all five routes an article can reach
 * `published` through, exactly as it used to call the Telegram announcer — the
 * call sites did not have to change, and neither did their fire-and-forget
 * style. Each announcer owns its own once-only claim on the article and
 * swallows its own errors, so a network that is unconfigured, throttled or
 * down can neither block another network nor fail the publish that triggered
 * it. Adding a network here is a one-line change.
 *
 * Not awaited by design: announcing is a side effect of publishing, never a
 * precondition of it.
 */
const announceArticle = (articleId) => {
  announceOnTelegram(articleId);
  announceOnFacebook(articleId);
};

module.exports = { announceArticle };
