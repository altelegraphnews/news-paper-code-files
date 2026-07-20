'use strict';

const express = require('express');
const multer = require('multer');
const { param } = require('express-validator');
const router = express.Router();

const {
  getSignedUploadParams,
  uploadBuffer,
  deleteAsset,
  listAssets,
} = require('../services/cloudinaryService');
const { success, errors } = require('../utils/responseHelper');
const { verifyToken, requireAtLeast, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { logAction } = require('../middleware/auditLogger');

// Multipart uploads are buffered in memory then streamed to Cloudinary.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    if (/^(image|video)\//.test(file.mimetype)) return cb(null, true);
    cb(new Error('يُسمح برفع الصور ومقاطع الفيديو فقط'));
  },
});

// GET /media — list Cloudinary assets
router.get('/', verifyToken, requirePermission('media.manage'), async (req, res, next) => {
  try {
    const { folder = 'alwid', limit = 50, cursor } = req.query;
    const result = await listAssets({ folder, maxResults: parseInt(limit), nextCursor: cursor });
    return success(res, result);
  } catch (err) {
    next(err);
  }
});

// POST /media/sign — get signed upload params (for direct client→Cloudinary)
router.post('/sign', verifyToken, requirePermission('media.upload'), async (req, res, next) => {
  try {
    const { folder = 'alwid/articles' } = req.body;
    const params = getSignedUploadParams(folder);
    return success(res, params);
  } catch (err) {
    next(err);
  }
});

// POST /media/upload — receive a multipart file and push it to Cloudinary.
// The admin media library posts here (field name `file`).
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
      const folder = (req.body && req.body.folder) || 'alwid/media';
      const result = await uploadBuffer(req.file.buffer, { folder });
      await logAction({ req, action: 'media.upload', resourceType: 'media', resourceId: result.public_id });
      return success(res, result, 'تم رفع الملف بنجاح');
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /media/:publicId — delete asset
router.delete(
  '/:publicId(*)',
  verifyToken,
  requirePermission('media.manage'),
  async (req, res, next) => {
    try {
      const { publicId } = req.params;
      if (!publicId) return errors.badRequest(res, 'معرف الملف مطلوب');

      await deleteAsset(publicId);
      await logAction({ req, action: 'media.delete', resourceType: 'media', resourceId: publicId });

      return success(res, null, 'تم حذف الملف بنجاح');
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
