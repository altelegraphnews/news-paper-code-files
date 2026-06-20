'use strict';

const express = require('express');
const { param } = require('express-validator');
const router = express.Router();

const { getSignedUploadParams, deleteAsset, listAssets } = require('../services/cloudinaryService');
const { success, errors } = require('../utils/responseHelper');
const { verifyToken, requireAtLeast, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { logAction } = require('../middleware/auditLogger');

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

// POST /media/sign — get signed upload params
router.post('/sign', verifyToken, requirePermission('media.upload'), async (req, res, next) => {
  try {
    const { folder = 'alwid/articles' } = req.body;
    const params = getSignedUploadParams(folder);
    return success(res, params);
  } catch (err) {
    next(err);
  }
});

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
