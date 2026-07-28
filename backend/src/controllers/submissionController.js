'use strict';

const crypto = require('crypto');
const { ingestSubmission } = require('../services/submissionService');
const resend = require('../services/resendService');
const { submissionAck } = require('../services/emailTemplates');
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

const escapeHtml = (value) =>
  String(value ?? '').replace(/[<>&"']/g, (c) => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]
  ));

// Forward a copy of the submission to the configured inbox (e.g. Gmail), with
// the original attachments and a link back to the draft. Reply-to is the
// writer so the editor can respond to them straight from their inbox.
const forwardToInbox = async ({ email, fromEmail, fromName, attachments, article }) => {
  const to = config.submissions.forwardTo;
  if (!to) return;

  // The sender's name and address come from an unauthenticated submitter and
  // land in an HTML email read by editors — escape them so they cannot inject
  // markup (e.g. a lookalike link) into the banner alongside the real one.
  // As a bonus this makes the address visible again: unescaped, the `<…>`
  // wrapper was parsed as a tag and never rendered.
  const sender = fromName
    ? `${escapeHtml(fromName)} &lt;${escapeHtml(fromEmail)}&gt;`
    : (escapeHtml(fromEmail) || 'غير معروف');
  const editUrl = `${config.frontend.adminUrl || 'https://admin.al-telegraph.com'}/articles/${article._id}/edit`;
  const banner =
    `<div style="font-family:sans-serif;background:#f6f3ec;border:1px solid #e5ddc8;border-radius:8px;padding:14px;margin-bottom:16px" dir="rtl">
       <div style="font-weight:bold;color:#8a6d2f">📥 مساهمة جديدة عبر البريد</div>
       <div style="font-size:13px;color:#555;margin-top:6px">المُرسِل: ${sender}</div>
       <div style="font-size:13px;color:#555">أُنشئت كمسودة قيد المراجعة:
         <a href="${editUrl}" style="color:#8a6d2f">فتح المسودة للتحرير ↗</a></div>
     </div>`;
  const original = email.html || (email.text ? `<pre style="white-space:pre-wrap;font-family:sans-serif">${escapeHtml(email.text)}</pre>` : '<i>(لا يوجد نص)</i>');

  await resend.sendEmail({
    from: config.submissions.forwardFrom,
    to,
    replyTo: fromEmail || undefined,
    subject: `[مساهمة] ${String(email.subject || '(بدون عنوان)').replace(/[\r\n]/g, ' ')}`,
    html: banner + original,
    attachments,
  });
  logger.info(`↪︎ Forwarded submission "${article.title}" to ${to}`);
};

// Send the branded Arabic acknowledgement back to the writer. Guarded so we
// never reply to our own domain addresses (avoids mail loops).
const sendAcknowledgement = async ({ fromEmail, fromName, article }) => {
  if (!config.submissions.ackEnabled) return;
  if (!fromEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fromEmail)) return;
  if (/@al-telegraph\.com$/i.test(fromEmail)) return; // don't ack our own sends

  const { subject, html } = submissionAck({ senderName: fromName, title: article.title });
  await resend.sendEmail({ from: config.submissions.ackFrom, to: fromEmail, subject, html });
  logger.info(`↩︎ Sent acknowledgement to ${fromEmail}`);
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

    // Auto-reply to the writer confirming receipt — best effort
    await sendAcknowledgement({ fromEmail, fromName, article }).catch((e) =>
      logger.warn('Submission ack failed:', e.message)
    );

    return success(res, { ok: true, articleId: article._id, title: article.title });
  } catch (err) {
    // 500 lets Resend retry transient failures
    logger.error('Inbound webhook processing error:', err.message);
    return next(err);
  }
};

/**
 * POST /submissions/form  (public, rate-limited)
 * On-site submission form. Accepts name/email/title/body + optional .docx and
 * images (multipart), creates a pending article, acks the writer, and forwards
 * a copy if configured.
 */
const formSubmit = async (req, res, next) => {
  try {
    // Honeypot: real users never fill the hidden "website" field
    if (req.body.website) return success(res, { ok: true });

    const name = (req.body.name || '').trim();
    const email = (req.body.email || '').trim();
    const title = (req.body.title || '').trim();
    const body = (req.body.body || '').trim();

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return errors.badRequest(res, 'يرجى إدخال بريد إلكتروني صحيح');
    }
    const files = req.files || {};
    const docxFile = (files.docx || [])[0];
    const imageFiles = files.images || [];
    if (!title && !body && !docxFile) {
      return errors.badRequest(res, 'يرجى كتابة المقال أو إرفاق ملف Word');
    }

    const attachments = [];
    if (docxFile) attachments.push({ filename: docxFile.originalname || 'article.docx', contentType: docxFile.mimetype, buffer: docxFile.buffer });
    for (const img of imageFiles) attachments.push({ filename: img.originalname, contentType: img.mimetype, buffer: img.buffer });

    const article = await ingestSubmission({
      via: 'form', fromEmail: email, fromName: name, subject: title, text: body, attachments,
    });

    await forwardToInbox({ email: { subject: title, text: body, html: '' }, fromEmail: email, fromName: name, attachments, article })
      .catch((e) => logger.warn('Form submission forward failed:', e.message));
    await sendAcknowledgement({ fromEmail: email, fromName: name, article })
      .catch((e) => logger.warn('Form submission ack failed:', e.message));

    return success(res, { ok: true, title: article.title }, 'تم استلام مقالك بنجاح');
  } catch (err) { next(err); }
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

module.exports = { inboundWebhook, formSubmit, testIngest, verifySignature, parseFrom };
