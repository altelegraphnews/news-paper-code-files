'use strict';

/**
 * Tells a writer what the editors decided about their article.
 *
 * The acknowledgement a submitter receives promises «نُعلمكم بقرار النشر خلال
 * مدّةٍ تتراوح بين يومٍ وأربعة أيام». Nothing kept that promise: approving or
 * rejecting an article only moved its status and wrote an audit row, so a
 * rejected writer heard nothing at all and the editor's note — the one thing
 * they needed — never left the database.
 *
 * Sent over Resend rather than the SMTP transport in emailService, because
 * Resend is the sender already verified for al-telegraph.com and already
 * delivering the acknowledgement these letters complete.
 *
 * Every entry point is best effort and never throws: a mail provider having a
 * bad minute must not fail an editor's decision.
 */

const resend = require('./resendService');
const { submissionRejected, submissionApproved } = require('./emailTemplates');
const config = require('../config/env');
const logger = require('../utils/logger');

// The login-disabled account submissions are parked under when the sender is
// nobody we know. It is a placeholder, not a person — mailing it is mailing
// ourselves. Kept in step with submissionService.getSystemUser.
const SYSTEM_ADDRESS = 'submissions-system@al-telegraph.com';

const isRealAddress = (email) => {
  const value = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return false;
  if (value === SYSTEM_ADDRESS) return false;
  // Our own intake address: a decision letter sent there would land back in
  // the review queue as a new submission.
  if (value === String(config.submissions.inboundAddress || '').toLowerCase()) return false;
  return true;
};

/**
 * Who to write to, and what to call them.
 *
 * A submission carries the address the writer actually sent from, which is the
 * one they are reading; it is preferred over the author record, because a
 * submission from an unknown sender is parked under a placeholder account.
 * Falls back to the author on the article — that is the path for a staff
 * writer whose draft an editor returned.
 *
 * @param {object} article  populated author, and `submission` selected in
 * @returns {{email: string, name: string}|null}
 */
const resolveRecipient = (article) => {
  const submission = article?.submission;
  if (submission && isRealAddress(submission.senderEmail)) {
    return {
      email: String(submission.senderEmail).trim(),
      name: submission.senderName || article.author?.name || '',
    };
  }
  if (isRealAddress(article?.author?.email)) {
    return { email: String(article.author.email).trim(), name: article.author?.name || '' };
  }
  return null;
};

const send = async ({ article, subject, html }) => {
  if (!config.submissions.resendApiKey) {
    logger.warn('RESEND_API_KEY not set — decision letter not sent');
    return false;
  }
  const to = resolveRecipient(article);
  if (!to) {
    logger.info(`No writer address for "${article?.title}" — decision letter skipped`);
    return false;
  }
  await resend.sendEmail({ from: config.submissions.ackFrom, to: to.email, subject, html });
  logger.info(`✉︎ Decision letter → ${to.email} for "${article?.title}"`);
  return true;
};

/**
 * Article returned to the writer, carrying the editor's reason verbatim.
 * @param {object} article populated/selected as resolveRecipient expects
 * @param {string} note    the editor's note — the reason for the return
 */
const notifyRejected = async (article, note) => {
  const { subject, html } = submissionRejected({
    senderName: article?.submission?.senderName || article?.author?.name,
    title: article?.title,
    note,
  });
  return send({ article, subject, html });
};

/**
 * Where the published article lives, for the button in the acceptance letter.
 * Slugs are Arabic, so the path is percent-encoded — same shape the Telegram
 * and Facebook announcers build.
 */
const articleUrl = (article) => {
  const base = (config.frontend.url || '').replace(/\/$/, '');
  if (!base) return '';
  const category = article?.category?.slug || 'uncategorized';
  return encodeURI(`${base}/article/${category}/${article.slug}`);
};

/**
 * Article accepted and published.
 * @param {object} article populated/selected as resolveRecipient expects,
 *                         plus `category` populated for the link
 */
const notifyApproved = async (article) => {
  const { subject, html } = submissionApproved({
    senderName: article?.submission?.senderName || article?.author?.name,
    title: article?.title,
    url: article?.slug ? articleUrl(article) : '',
  });
  return send({ article, subject, html });
};

module.exports = { notifyRejected, notifyApproved, resolveRecipient, isRealAddress, articleUrl };
