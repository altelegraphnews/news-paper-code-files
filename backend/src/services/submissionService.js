'use strict';

/**
 * Turns an inbound email submission into a `pending` article that shows up in
 * the editorial review queue. Transport-agnostic: callers pass a normalized
 * payload, so this works the same for the Resend webhook, a future provider,
 * or a manual test.
 */

const mammoth = require('mammoth');
const Article = require('../models/Article');
const User = require('../models/User');
const { generateUniqueSlug } = require('../utils/slugGenerator');
const { calculateReadingTime, sanitizeExcerpt } = require('../utils/readingTime');
const { sanitizeHtml } = require('../utils/sanitizer');
const { uploadBuffer } = require('./cloudinaryService');
const config = require('../config/env');
const logger = require('../utils/logger');

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const isDocx = (att) =>
  att.contentType === DOCX_MIME || /\.docx$/i.test(att.filename || '');

const isImage = (att) =>
  (att.contentType || '').startsWith('image/') || /\.(png|jpe?g|gif|webp|avif)$/i.test(att.filename || '');

// Strip reply/forward prefixes and clamp length for a usable title
const cleanTitle = (subject) => {
  if (!subject) return '';
  return subject
    .replace(/^\s*(re|fwd?|رد|إعادة توجيه)\s*:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
};

// Escape + paragraph-wrap a plain-text body
const textToHtml = (text) => {
  if (!text) return '';
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .filter((p) => p !== '<p></p>')
    .join('\n');
};

// Convert a .docx buffer to HTML, uploading embedded images to Cloudinary
const docxToHtml = async (buffer) => {
  const convertImage = mammoth.images.imgElement(async (image) => {
    try {
      const imgBuf = await image.read();
      const uploaded = await uploadBuffer(imgBuf, { folder: 'alwid/submissions' });
      return { src: uploaded.secure_url || uploaded.url, alt: '' };
    } catch (err) {
      logger.warn('docx image upload failed:', err.message);
      return { src: '' };
    }
  });
  const result = await mammoth.convertToHtml({ buffer }, { convertImage });
  return result.value || '';
};

// A stable, login-disabled system profile used as the placeholder byline /
// editedBy for submissions whose sender doesn't match a known writer.
const getSystemUser = async () => {
  const email = 'submissions-system@al-telegraph.com';
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      name: 'مساهمة بريدية',
      email,
      password: require('crypto').randomBytes(24).toString('hex'),
      role: 'author',
      isProfileOnly: true,
      isActive: true,
      isEmailVerified: true,
      bio: 'حساب النظام لاستقبال المقالات عبر البريد — يعيّن المحرر الكاتب الحقيقي عند المراجعة.',
    });
  }
  return user;
};

// A display name we are willing to put on an article. Rejects the cases where
// a mail client puts the address itself in the display-name slot, which would
// publish someone's email as their byline.
const usableName = (raw) => {
  const name = String(raw || '')
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (name.length < 2 || name.length > 100) return '';
  if (/@/.test(name)) return '';
  return name;
};

/**
 * Give the submission a byline.
 *
 * In order: a writer we already know by address; failing that, a signature-only
 * profile under the sender's own name; failing that, the placeholder.
 *
 * The middle step is the one that was missing. Every submission from an address
 * we did not recognise was parked under the shared «مساهمة بريدية» account, so
 * the article published under that instead of the writer's name — their name
 * was sitting in submission.senderName the whole time, read by nothing. The
 * profile is created exactly like the ones an editor makes on the «الكُتّاب»
 * page: isProfileOnly, so it is a byline identity and can never log in.
 *
 * `matched` still means «this is an author we already had». A profile minted
 * here is not that, and the review queue should go on flagging it so an editor
 * confirms who the writer is before publishing.
 */
const resolveAuthor = async (fromEmail, systemUser, fromName) => {
  const email = String(fromEmail || '').toLowerCase().trim();

  if (email) {
    const match = await User.findOne({ email }).select('_id');
    if (match) return { authorId: match._id, matched: true };
  }

  const name = usableName(fromName);
  if (email && name) {
    try {
      const profile = await User.create({
        name,
        email,
        password: require('crypto').randomBytes(24).toString('hex'),
        role: 'author',
        isProfileOnly: true,
        isActive: true,
        isEmailVerified: true,
      });
      logger.info(`👤 Created byline profile "${name}" <${email}> for a submission`);
      return { authorId: profile._id, matched: false };
    } catch (err) {
      // Two submissions from a new sender at once: the loser of the race reads
      // back the winner's profile rather than falling to the placeholder.
      const existing = await User.findOne({ email }).select('_id');
      if (existing) return { authorId: existing._id, matched: false };
      logger.warn(`Byline profile for <${email}> failed: ${err.message}`);
    }
  }

  return { authorId: systemUser._id, matched: false };
};

// ─── Main entry ──────────────────────────────────────────────────────────────

/**
 * @param {object} p
 * @param {string} p.fromEmail   sender address
 * @param {string} [p.fromName]  sender display name
 * @param {string} [p.subject]
 * @param {string} [p.text]      plain-text body
 * @param {string} [p.html]      html body
 * @param {Array}  [p.attachments] [{ filename, contentType, buffer, contentId }]
 * @param {string} [p.resendEmailId]
 * @returns {Promise<import('mongoose').Document>} the created pending article
 */
const ingestSubmission = async (p) => {
  const attachments = p.attachments || [];
  const systemUser = await getSystemUser();

  // 1) Upload image attachments → Cloudinary (for cover + inline cid resolution)
  const uploadedImages = [];
  for (const att of attachments.filter(isImage)) {
    if (!att.buffer) continue;
    try {
      const up = await uploadBuffer(att.buffer, { folder: 'alwid/submissions' });
      uploadedImages.push({ url: up.secure_url || up.url, publicId: up.public_id, contentId: att.contentId });
    } catch (err) {
      logger.warn('submission image upload failed:', err.message);
    }
  }

  // 2) Build the article body: docx > html > text
  let content = '';
  const docx = attachments.find(isDocx);
  const hadDocx = !!docx;
  if (docx && docx.buffer) {
    content = await docxToHtml(docx.buffer);
  } else if (p.html) {
    content = p.html;
  } else {
    content = textToHtml(p.text);
  }

  // Resolve inline cid: images in html bodies to their uploaded URLs
  for (const img of uploadedImages) {
    if (img.contentId) {
      const cid = img.contentId.replace(/^<|>$/g, '');
      content = content.replace(new RegExp(`cid:${cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'), img.url);
    }
  }

  content = sanitizeHtml(content);

  // Append standalone image attachments (not already inline) to the body
  const inlineUrls = new Set(uploadedImages.filter((i) => i.contentId).map((i) => i.url));
  const standalone = uploadedImages.filter((i) => !inlineUrls.has(i.url) || !content.includes(i.url));
  const appended = standalone
    .filter((i) => !content.includes(i.url))
    .map((i) => `<figure><img src="${i.url}" alt=""></figure>`)
    .join('\n');
  if (appended) content += `\n${appended}`;

  if (!content.trim()) content = '<p>(لا يوجد نص في الرسالة)</p>';

  // 3) Title + slug — prefer subject, then the doc's first heading, then first
  //    line of text, then a dated fallback
  let title = cleanTitle(p.subject);
  if (!title) {
    const heading = content.match(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/i);
    if (heading) {
      title = heading[1].replace(/<[^>]+>/g, '').trim().slice(0, 200);
      // Drop the leading heading from the body so it isn't duplicated
      content = content.replace(heading[0], '').trim();
    }
  }
  if (!title) {
    const firstLine = (p.text || '').split('\n').map((l) => l.trim()).find(Boolean);
    title = firstLine ? firstLine.slice(0, 120) : `مساهمة بريدية — ${new Date().toLocaleDateString('ar')}`;
  }
  const slug = await generateUniqueSlug(title, async (s) => {
    return !!(await Article.findOne({ $or: [{ slug: s }, { slugHistory: s }] }));
  });

  // 4) Author + cover
  const { authorId, matched } = await resolveAuthor(p.fromEmail, systemUser, p.fromName);
  const cover = uploadedImages[0];

  const via = p.via === 'form' ? 'form' : 'email';
  const sourceLabel = via === 'form' ? 'نموذج الموقع' : 'بريد إلكتروني';

  const article = await Article.create({
    title: title.trim(),
    slug,
    content,
    excerpt: sanitizeExcerpt(content, 300),
    // No category — the editor assigns one during review (required to publish)
    author: authorId,
    editedBy: systemUser._id,
    status: 'pending',
    review: { submittedAt: new Date() },
    readingTimeMin: calculateReadingTime(content),
    ogImage: cover ? { url: cover.url, publicId: cover.publicId } : {},
    // `source` is rendered publicly, so it gets the label only. The address
    // lives in `submission.senderEmail`, which is deselected by default.
    source: { name: sourceLabel },
    submission: {
      via,
      senderEmail: p.fromEmail,
      senderName: p.fromName,
      resendEmailId: p.resendEmailId,
      receivedAt: new Date(),
      hadDocx,
      authorMatched: matched,
    },
  });

  logger.info(`📥 Submission → pending article "${title}" (${article._id}) via ${via} from ${p.fromEmail || 'unknown'}, matched=${matched}`);
  return article;
};

module.exports = { ingestSubmission, cleanTitle, textToHtml, isDocx, isImage, usableName };
