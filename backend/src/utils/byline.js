'use strict';

// The login-disabled profile submissionService signs an emailed article with
// when the sender matches no writer (see getSystemUser there). It stands in
// until an editor assigns the real writer, so it is never credited as one.
const PLACEHOLDER_EMAIL = 'submissions-system@al-telegraph.com';

/**
 * The writer to credit when announcing an article — the name the article page
 * prints in its byline — or '' when there is no real writer to name. Expects
 * `author` populated with name and email.
 */
const writerName = (article) => {
  const { author } = article;
  if (!author?.name || author.email === PLACEHOLDER_EMAIL) return '';
  return String(author.name).replace(/\s+/g, ' ').trim();
};

module.exports = { writerName, PLACEHOLDER_EMAIL };
