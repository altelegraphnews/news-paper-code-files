'use strict';

const express = require('express');
const multer = require('multer');
const router = express.Router();

const { uploadBuffer, deleteAsset, deleteAssets, listAssets } = require('../services/mediaStorage');
const { success, errors } = require('../utils/responseHelper');
const { verifyToken, requirePermission, requireAnyPermission } = require('../middleware/auth');
const { logAction } = require('../middleware/auditLogger');

// Multipart uploads are buffered in memory, then stored on R2 with every
// rendition the site needs (services/mediaStorage.js).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    if (/^(image|video)\//.test(file.mimetype)) return cb(null, true);
    cb(new Error('يُسمح برفع الصور ومقاطع الفيديو فقط'));
  },
});

// The folder becomes part of every key, so it is chosen from a fixed list
// rather than taken from the request as written.
const FOLDERS = new Set(['alwid/articles', 'alwid/media', 'alwid/submissions']);

// GET /media — the media library, newest first.
// Browsing is allowed for anyone who may upload: writers (media.upload only)
// need to pick a cover or an in-article image without the media library page.
router.get('/', verifyToken, requireAnyPermission('media.manage', 'media.upload'), async (req, res, next) => {
  try {
    const { folder = 'alwid', limit = 50, cursor, search } = req.query;
    const result = await listAssets({ folder, limit, cursor, search });
    return success(res, result);
  } catch (err) {
    next(err);
  }
});

// POST /media/upload — receive a multipart file (field `file`) and store it.
router.post(
  '/upload',
  verifyToken,
  requirePermission('media.upload'),
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        const msg =
          err.code === 'LIMIT_FILE_SIZE'
            ? 'حجم الملف كبير جداً (الحد الأقصى 20 ميغابايت)'
            : err.message || 'تعذّر رفع الملف';
        return errors.badRequest(res, msg);
      }
      next();
    });
  },
  async (req, res, next) => {
    try {
      if (!req.file) return errors.badRequest(res, 'لم يتم إرفاق أي ملف');
      const folder = FOLDERS.has(req.body && req.body.folder) ? req.body.folder : 'alwid/media';
      const result = await uploadBuffer(req.file.buffer, {
        folder,
        mimetype: req.file.mimetype,
        uploadedBy: req.user._id,
      });
      // AuditLog.resourceId is an ObjectId, so it takes the index row's id and
      // the publicId goes in the title — a publicId there used to fail the
      // cast and drop the entry without a word.
      await logAction({ req, action: 'media.upload', resourceType: 'media', resourceId: result.asset_id, resourceTitle: result.public_id });
      return success(res, result, 'تم رفع الملف بنجاح');
    } catch (err) {
      if (err.statusCode === 400) return errors.badRequest(res, err.message);
      next(err);
    }
  }
);

// DELETE /media/bulk — declared before /:publicId(*), which would otherwise
// swallow it as a file called "bulk" and report a deletion that never happened.
router.delete('/bulk', verifyToken, requirePermission('media.manage'), async (req, res, next) => {
  try {
    const ids = req.body && req.body.publicIds;
    if (!Array.isArray(ids) || !ids.length || ids.length > 100 || !ids.every((p) => typeof p === 'string' && p)) {
      return errors.badRequest(res, 'قائمة الملفات غير صالحة');
    }
    const result = await deleteAssets(ids);
    for (const publicId of result.deleted) {
      await logAction({ req, action: 'media.delete', resourceType: 'media', resourceTitle: publicId });
    }
    const kept = result.inUse.length ? ` — لم يُحذف ${result.inUse.length} لأنها ما زالت مستخدمة` : '';
    return success(res, result, `تم حذف ${result.deleted.length} ملف${kept}`);
  } catch (err) {
    next(err);
  }
});

// DELETE /media/:publicId — delete one file, unless an article or a profile
// still shows it.
router.delete('/:publicId(*)', verifyToken, requirePermission('media.manage'), async (req, res, next) => {
  try {
    const { publicId } = req.params;
    if (!publicId) return errors.badRequest(res, 'معرف الملف مطلوب');

    await deleteAsset(publicId);
    await logAction({ req, action: 'media.delete', resourceType: 'media', resourceTitle: publicId });

    return success(res, null, 'تم حذف الملف بنجاح');
  } catch (err) {
    if (err.statusCode === 409 || err.statusCode === 404) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
});

module.exports = router;
