'use strict';

const crypto = require('crypto');
const { ingestSubmission } = require('../services/submissionService');
const resend = require('../services/resendService');
const { success, errors } = require('../utils/responseHelper');
const config = require('../config/env');
const logger = require('../utils/logger');

/**
 * Verify a Resend (Svix) webhook signature.
 * signedContent = `${svix-id}.${svix-timestamp}.${rawBody}`
 * expected = base64(HMAC_SHA256(base64decode(secret after "whsec_"), signedContent))
 * The `svix-signature` header holds space-separated `v1,<sig>` entries.
 */
const verifySignature = (secret, headers, rawBody) => {
  const id = headers['svix-id'];
  const timestamp = headers['svix-timestamp'];
  const sigHeader = headers['svix-signature'];
  if (!id || !timestamp || !sigHeader) return false;

  // Reject stale timestamps (>5 min) to blunt replay attacks
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', key).update(signedContent).digest('base64');

  return sigHeader
    .split(' ')
    .map((p) => p.split(',')[1])
    .filter(Boolean)
    .some((sig) => {
      try {
        return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
      } catch { return false; }
    });
};

// Parse "Display Name <email@host>" (or a bare address, or an object) → { email, name }
const parseFrom = (from) => {
  if (!from) return { email: '', name: '' };
  if (typeof from === 'object') return { email: from.email || from.address || '', name: from.name || '' };
  const m = String(from).match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].replace(/^"|"$/g, '').trim(), email: m[2].trim() };
  return { email: String(from).trim(), name: '' };
};

// Forward a copy of the submission to the configured inbox (e.g. Gmail), with
// the original attachments and a link back to the draft. Reply-to is the
// writer so the editor can respond to them straight from their inbox.
const forwardToInbox = async ({ email, fromEmail, fromName, attachments, article }) => {
  const to = config.submissions.forwardTo;
  if (!to) return;

  const sender = fromName ? `${fromName} <${fromEmail}>` : (fromEmail || 'غير معروف');
  const editUrl = `${config.frontend.adminUrl || 'https://admin.al-telegraph.com'}/articles/${article._id}/edit`;
  const banner =
    `<div style="font-family:sans-serif;background:#f6f3ec;border:1px solid #e5ddc8;border-radius:8px;padding:14px;margin-bottom:16px" dir="rtl">
       <div style="font-weight:bold;color:#8a6d2f">📥 مساهمة جديدة عبر البريد</div>
       <div style="font-size:13px;color:#555;margin-top:6px">المُرسِل: ${sender}</div>
       <div style="font-size:13px;color:#555">أُنشئت كمسودة قيد المراجعة:
         <a href="${editUrl}" style="color:#8a6d2f">فتح المسودة للتحرير ↗</a></div>
     </div>`;
  const original = email.html || (email.text ? `<pre style="white-space:pre-wrap;font-family:sans-serif">${email.text.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</pre>` : '<i>(لا يوجد نص)</i>');

  await resend.sendEmail({
    from: config.submissions.forwardFrom,
    to,
    replyTo: fromEmail || undefined,
    subject: `[مساهمة] ${email.subject || '(بدون عنوان)'}`,
    html: banner + original,
    attachments,
  });
  logger.info(`↪︎ Forwarded submission "${article.title}" to ${to}`);
};

/**
 * POST /submissions/inbound
 * Resend "email.received" webhook. Verifies signature, pulls the full email +
 * attachments from the Resend API, and creates a pending article.
 */
const inboundWebhook = async (req, res, next) => {
  try {
    const secret = config.submissions.webhookSecret;
    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body || {});

    if (secret) {
      if (!verifySignature(secret, req.headers, rawBody)) {
        logger.warn('Inbound webhook: signature verification failed');
        return errors.unauthorized(res, 'Invalid signature');
      }
    } else {
      logger.warn('RESEND_WEBHOOK_SECRET not set — skipping signature verification');
    }

    const event = req.body || {};
    if (event.type && event.type !== 'email.received') {
      return success(res, { ignored: event.type });
    }

    const data = event.data || {};
    const emailId = data.email_id || data.id || (data.email && data.email.id);
    if (!emailId) {
      logger.error('Inbound webhook: could not find email id in payload', JSON.stringify(event).slice(0, 500));
      return errors.badRequest(res, 'Missing email id');
    }

    if (!config.submissions.resendApiKey) {
      logger.error('RESEND_API_KEY not set — cannot fetch inbound email');
      return errors.badRequest(res, 'Server not configured for inbound email');
    }

    // Full body + attachment list (with signed download URLs)
    const email = await resend.getReceivedEmail(emailId);
    const attachmentsMeta = await resend.getReceivedAttachments(emailId).catch(() => []);

    // Download only docx + images (skip anything oversize)
    const attachments = [];
    for (const a of attachmentsMeta) {
      const ct = a.content_type || '';
      const wanted = ct.startsWith('image/') ||
        ct === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        /\.(docx|png|jpe?g|gif|webp|avif)$/i.test(a.filename || '');
      if (!wanted || !a.download_url) continue;
      const buffer = await resend.downloadAttachment(a.download_url).catch((e) => {
        logger.warn(`attachment fetch failed (${a.filename}): ${e.message}`);
        return null;
      });
      if (buffer) attachments.push({ filename: a.filename, contentType: ct, buffer, contentId: a.content_id });
    }

    const { email: fromEmail, name: fromName } = parseFrom(email.from);

    const article = await ingestSubmission({
      fromEmail,
      fromName,
      subject: email.subject,
      text: email.text,
      html: email.html,
      attachments,
      resendEmailId: emailId,
    });

    // Forward a copy to the configured inbox (e.g. Gmail) — best effort
    await forwardToInbox({ email, fromEmail, fromName, attachments, article }).catch((e) =>
      logger.warn('Submission forward failed:', e.message)
    );

    return success(res, { ok: true, articleId: article._id, title: article.title });
  } catch (err) {
    // 500 lets Resend retry transient failures
    logger.error('Inbound webhook processing error:', err.message);
    return next(err);
  }
};

/**
 * POST /submissions/test-ingest  (auth: articles.publish)
 * Manually create a pending article from a text/subject payload — for testing
 * the pipeline without sending a real email.
 */
const testIngest = async (req, res, next) => {
  try {
    const { from, subject, text, html } = req.body;
    const { email: fromEmail, name: fromName } = parseFrom(from);
    const article = await ingestSubmission({ fromEmail, fromName, subject, text, html, attachments: [] });
    return success(res, { ok: true, articleId: article._id, title: article.title });
  } catch (err) { next(err); }
};

module.exports = { inboundWebhook, testIngest, verifySignature, parseFrom };
