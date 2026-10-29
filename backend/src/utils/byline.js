'use strict';

// The login-disabled profile submissionService signs an emailed article with
// when the sender matches no writer (see getSystemUser there). It stands in
// until an editor assigns the real writer, so it is never credited as one.
const PLACEHOLDER_EMAIL = 'submissions-system@al-telegraph.com';

/** What `author` has to be populated with for bylineLine to tell them apart. */
const AUTHOR_FIELDS = 'name email';

/**
 * The writer to credit — the name the article page prints in its byline — or
 * '' when there is no real writer to name. Fails closed: an author loaded
 * without an email could be the placeholder, so it is not named.
 */
const writerName = (article) => {
  const { author } = article;
  if (!author?.name || !author.email || author.email === PLACEHOLDER_EMAIL) return '';
  return String(author.name).replace(/\s+/g, ' ').trim();
};

/** The announcement's writer line, the same on every network, or ''. */
const bylineLine = (article) => {
  const writer = writerName(article);
  return writer ? `✍️ بقلم: ${writer}` : '';
};

module.exports = { bylineLine, AUTHOR_FIELDS, PLACEHOLDER_EMAIL };
