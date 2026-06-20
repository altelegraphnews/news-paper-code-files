'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();

const Ticker = require('../models/Ticker');
const { success, created, errors } = require('../utils/responseHelper');
const { verifyToken, requireAtLeast, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { publicLimiter } = require('../middleware/rateLimiter');
const { logAction } = require('../middleware/auditLogger');

// GET /tickers — public, returns active tickers
router.get('/', publicLimiter, async (req, res, next) => {
  try {
    const tickers = await Ticker.getActive(20);
    return success(res, tickers);
  } catch (err) { next(err); }
});

// GET /tickers/all — admin: all tickers
router.get('/all', verifyToken, requirePermission('tickers.manage'), async (req, res, next) => {
  try {
    const tickers = await Ticker.find()
      .sort({ priority: -1, createdAt: -1 })
      .populate('createdBy', 'name')
      .lean();
    return success(res, tickers);
  } catch (err) { next(err); }
});

// POST /tickers — admin
router.post('/', verifyToken, requirePermission('tickers.manage'), validate([
  body('text').trim().isLength({ min: 5, max: 300 }).withMessage('النص يجب أن يكون بين 5 و 300 حرف'),
  body('url').optional().isURL().withMessage('الرابط غير صالح'),
  body('type').optional().isIn(['breaking', 'info', 'update', 'promo']).withMessage('النوع غير صالح'),
]), async (req, res, next) => {
  try {
    const { text, url, type, priority, isActive, startAt, endAt, color, backgroundColor } = req.body;

    const ticker = await Ticker.create({
      text: text.trim(),
      url: url || undefined,
      type: type || 'info',
      priority: priority || 0,
      isActive: isActive !== false,
      startAt: startAt || new Date(),
      endAt: endAt || undefined,
      color: color || undefined,
      backgroundColor: backgroundColor || undefined,
      createdBy: req.user._id,
    });

    await logAction({ req, action: 'ticker.create', resourceType: 'ticker', resourceId: ticker._id, resourceTitle: ticker.text });
    return created(res, ticker, 'تم إنشاء الشريط الإخباري بنجاح');
  } catch (err) { next(err); }
});

// PUT /tickers/:id — admin
router.put('/:id', verifyToken, requirePermission('tickers.manage'), validate([
  param('id').isMongoId().withMessage('معرف غير صالح'),
]), async (req, res, next) => {
  try {
    const ticker = await Ticker.findById(req.params.id);
    if (!ticker) return errors.notFound(res, 'الشريط الإخباري');

    const allowed = ['text', 'url', 'type', 'priority', 'isActive', 'startAt', 'endAt', 'color', 'backgroundColor'];
    allowed.forEach((f) => { if (req.body[f] !== undefined) ticker[f] = req.body[f]; });
    await ticker.save();

    return success(res, ticker, 'تم تحديث الشريط الإخباري');
  } catch (err) { next(err); }
});

// DELETE /tickers/:id — admin
router.delete('/:id', verifyToken, requirePermission('tickers.manage'), validate([
  param('id').isMongoId().withMessage('معرف غير صالح'),
]), async (req, res, next) => {
  try {
    const ticker = await Ticker.findByIdAndDelete(req.params.id);
    if (!ticker) return errors.notFound(res, 'الشريط الإخباري');
    return success(res, null, 'تم حذف الشريط الإخباري');
  } catch (err) { next(err); }
});

// PATCH /tickers/:id/toggle-active — admin
router.patch('/:id/toggle-active', verifyToken, requirePermission('tickers.manage'), validate([
  param('id').isMongoId().withMessage('معرف غير صالح'),
]), async (req, res, next) => {
  try {
    const ticker = await Ticker.findById(req.params.id);
    if (!ticker) return errors.notFound(res, 'الشريط الإخباري');
    ticker.isActive = !ticker.isActive;
    await ticker.save();
    return success(res, { isActive: ticker.isActive });
  } catch (err) { next(err); }
});

// PATCH /tickers/reorder — admin
router.patch('/reorder', verifyToken, requirePermission('tickers.manage'), async (req, res, next) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) return errors.badRequest(res, 'قائمة الترتيب مطلوبة');

    const ops = orderedIds.map((id, index) => ({
      updateOne: { filter: { _id: id }, update: { $set: { priority: orderedIds.length - index } } },
    }));
    await Ticker.bulkWrite(ops);
    return success(res, null, 'تم تحديث الترتيب');
  } catch (err) { next(err); }
});

module.exports = router;
