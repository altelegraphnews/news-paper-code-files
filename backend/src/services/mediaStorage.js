'use strict';

/**
 * Pictures live on Cloudflare R2, since the Cloudinary account stopped
 * answering on 2026-10-31.
 *
 * R2 stores bytes and nothing else, so this does what Cloudinary used to do
 * for us: it names each upload, checks what the bytes really are, renders
 * every size the site asks for (mediaVariants) and keeps the index
 * (models/Media) the media library lists from. Its results keep the shape of
 * Cloudinary's upload result and resources() listing, which the admin and
 * submissionService were written against.
 */

const crypto = require('crypto');
const mongoose = require('mongoose');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const config = require('../config/env');
const logger = require('../utils/logger');
const Media = require('../models/Media');
const Article = require('../models/Article');
const User = require('../models/User');
const { CONTENT_TYPES, renderVariants, variantKey, encodePath } = require('./mediaVariants');

const { r2 } = config;
const isConfigured = Boolean(r2.accountId && r2.accessKeyId && r2.secretAccessKey && r2.bucket);

if (!isConfigured) {
  logger.warn('R2 not configured — media uploads will fail until the R2_* variables are set');
}

// Checksums only where S3 requires them, and Buffers rather than streams:
// newer SDKs otherwise send CRC32 trailers that R2 has rejected before.
const s3 = isConfigured
  ? new S3Client({
    region: 'auto',
    endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
  : null;

// Every key is new and never rewritten, so browsers and Cloudflare may keep
// a file for a year without asking again.
const IMMUTABLE = 'public, max-age=31536000, immutable';
const VIDEO_EXT = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const unavailable = () => httpError(503, 'خدمة الوسائط غير مُهيأة على الخادم');

const urlOf = (key) => `${r2.publicUrl}/${encodePath(key)}`;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Twenty characters of [a-z0-9], like Cloudinary's ids: unguessable, so a
// new upload can never land on a key a cache already holds.
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const newId = () => Array.from(crypto.randomBytes(20), (b) => ALPHABET[b % ALPHABET.length]).join('');

const put = (Key, Body, ContentType) => s3.send(new PutObjectCommand({
  Bucket: r2.bucket, Key, Body, ContentType, CacheControl: IMMUTABLE,
}));

// One DeleteObject per key rather than DeleteObjects: the SDK forces a CRC32
// header onto DeleteObjects, which R2 has refused, and single deletes are free.
const removeKeys = async (keys) => {
  for (let i = 0; i < keys.length; i += 16) {
    await Promise.all(keys.slice(i, i + 16).map((Key) => s3.send(new DeleteObjectCommand({ Bucket: r2.bucket, Key }))));
  }
};

/** The Cloudinary-shaped record the admin reads. */
const toResource = (m) => ({
  asset_id: String(m._id),
  public_id: m.publicId,
  secure_url: m.url,
  url: m.url,
  format: m.format,
  width: m.width,
  height: m.height,
  bytes: m.bytes,
  resource_type: m.resourceType,
  folder: m.folder,
  created_at: m.createdAt,
});

/**
 * Store one upload: the original as it came, every rendition beside it, and
 * its row in the index. Either all of it is written or none of it is.
 */
const uploadBuffer = async (buffer, { folder = 'alwid/media', mimetype = '', uploadedBy = null } = {}) => {
  if (!isConfigured) throw unavailable();
  const publicId = `${folder}/${newId()}`;
  const written = [];
  let doc;

  try {
    if (/^video\//.test(mimetype)) {
      const ext = VIDEO_EXT[mimetype];
      if (!ext) throw httpError(400, 'صيغة الفيديو غير مدعومة — ارفعه بصيغة MP4');
      const key = `${publicId}.${ext}`;
      await put(key, buffer, CONTENT_TYPES[ext]);
      written.push(key);
      doc = { key, format: ext, resourceType: 'video', variants: [] };
    } else {
      // Throws a 400 with an Arabic reason for SVG, HEIC or a broken file.
      const { info, outputs } = await renderVariants(buffer);
      const key = `${publicId}.${info.ext}`;
      await put(key, buffer, CONTENT_TYPES[info.ext]);
      written.push(key);
      const variants = outputs.map((o) => variantKey(publicId, o.name));
      await Promise.all(outputs.map(async (o, i) => {
        await put(variants[i], o.buffer, o.contentType);
        written.push(variants[i]);
      }));
      doc = { key, format: info.ext, width: info.width, height: info.height, resourceType: 'image', variants };
    }

    const media = await Media.create({
      ...doc, publicId, url: urlOf(doc.key), folder, bytes: buffer.length, uploadedBy, source: 'upload',
    });
    return toResource(media);
  } catch (err) {
    if (written.length) await removeKeys(written).catch(() => {});
    if (!err.statusCode) logger.error('R2 upload error:', err.message);
    throw err;
  }
};

/**
 * Where a picture is still used. A picture is attached to the site only by
 * its URL (or publicId) inside a document, so deleting the file under a live
 * article would leave a hole in it; the routes refuse until it is detached.
 */
const whereUsed = async (publicId) => {
  const inUrl = new RegExp(`/${escapeRegex(publicId)}\\.`);
  const [article, user, masthead] = await Promise.all([
    Article.findOne({
      $or: [{ 'ogImage.publicId': publicId }, { 'ogImage.url': inUrl }, { 'gallery.url': inUrl }, { content: inUrl }],
    }).select('title').lean(),
    User.findOne({ 'avatar.url': inUrl }).select('name').lean(),
    mongoose.connection.collection('siteconfigs').findOne({ 'value.masthead.imageUrl': inUrl }),
  ]);
  if (article) return `المقال «${article.title}»`;
  if (user) return `الملف الشخصي لـ ${user.name}`;
  if (masthead) return 'شريط الترويسة في الصفحة الرئيسية';
  return null;
};

/**
 * Delete files no longer used anywhere: original, renditions and index row.
 * Returns what was deleted, what was still in use, and what was unknown.
 */
const deleteAssets = async (publicIds) => {
  if (!isConfigured) throw unavailable();
  const docs = await Media.find({ publicId: { $in: publicIds } }).lean();
  const found = new Set(docs.map((d) => d.publicId));
  const inUse = [];
  const free = [];
  for (const d of docs) {
    const where = await whereUsed(d.publicId);
    if (where) inUse.push({ publicId: d.publicId, where });
    else free.push(d);
  }
  await removeKeys(free.flatMap((d) => [d.key, ...(d.variants || [])]));
  if (free.length) await Media.deleteMany({ _id: { $in: free.map((d) => d._id) } });
  return {
    deleted: free.map((d) => d.publicId),
    inUse,
    notFound: publicIds.filter((p) => !found.has(p)),
  };
};

const deleteAsset = async (publicId) => {
  const { deleted, inUse } = await deleteAssets([publicId]);
  if (inUse.length) throw httpError(409, `لا يمكن حذف الصورة — ما زالت مستخدمة في ${inUse[0].where}`);
  if (!deleted.length) throw httpError(404, 'الملف غير موجود');
};

/**
 * The media library, newest first. `cursor` is opaque to the admin: the
 * createdAt and _id of the last row it was given.
 */
const listAssets = async ({ folder = 'alwid', limit = 50, cursor, search } = {}) => {
  const max = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const filter = { $and: [] };
  if (folder) filter.$and.push({ publicId: { $regex: `^${escapeRegex(String(folder))}/` } });
  if (search) filter.$and.push({ publicId: { $regex: escapeRegex(String(search)), $options: 'i' } });
  const base = filter.$and.length ? filter : {};

  const page = { ...base };
  if (cursor) {
    const [at, id] = String(cursor).split('_');
    if (at && mongoose.isValidObjectId(id)) {
      const when = new Date(Number(at));
      page.$or = [{ createdAt: { $lt: when } }, { createdAt: when, _id: { $lt: new mongoose.Types.ObjectId(id) } }];
    }
  }

  const [docs, total] = await Promise.all([
    Media.find(page).sort({ createdAt: -1, _id: -1 }).limit(max + 1).lean(),
    Media.countDocuments(base),
  ]);
  const more = docs.length > max;
  const rows = more ? docs.slice(0, max) : docs;
  const last = rows[rows.length - 1];
  return {
    resources: rows.map(toResource),
    total_count: total,
    next_cursor: more && last ? `${new Date(last.createdAt).getTime()}_${last._id}` : undefined,
  };
};

module.exports = { isConfigured, uploadBuffer, deleteAsset, deleteAssets, listAssets, whereUsed };
