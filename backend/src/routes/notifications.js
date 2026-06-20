'use strict';

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const PushSubscription = require('../models/PushSubscription');
const { broadcast } = require('../services/notificationService');
const { success, created, errors } = require('../utils/responseHelper');
const { verifyToken, optionalAuth, requireAtLeast, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { publicLimiter } = require('../middleware/rateLimiter');
const config = require('../config/env');

// POST /notifications/subscribe — save push subscription
router.post('/subscribe', publicLimiter, optionalAuth, validate([
  body('endpoint').isURL().withMessage('endpoint غير صالح'),
  body('keys.p256dh').notEmpty().withMessage('مفتاح p256dh مطلوب'),
  body('keys.auth').notEmpty().withMessage('مفتاح auth مطلوب'),
]), async (req, res, next) => {
  try {
    const { endpoint, keys } = req.body;
    const userId = req.user?._id || null;

    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { endpoint, keys, userId, userAgent: req.headers['user-agent'] },
      { upsert: true, new: true }
    );

    return created(res, null, 'تم تسجيل الاشتراك في الإشعارات');
  } catch (err) { next(err); }
});

// DELETE /notifications/unsubscribe
router.delete('/unsubscribe', publicLimiter, async (req, res, next) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return errors.badRequest(res, 'endpoint مطلوب');
    await PushSubscription.deleteOne({ endpoint });
    return success(res, null, 'تم إلغاء الاشتراك');
  } catch (err) { next(err); }
});

// GET /notifications/vapid-key — public key for service worker
router.get('/vapid-key', (req, res) => {
  return success(res, { publicKey: config.webPush.publicKey });
});

// GET /notifications/count — admin: subscriber count
router.get('/count', verifyToken, requirePermission('notifications.send'), async (req, res, next) => {
  try {
    const count = await PushSubscription.countDocuments();
    return success(res, { count });
  } catch (err) { next(err); }
});

// POST /notifications/send — admin: broadcast custom notification
router.post('/send', verifyToken, requirePermission('notifications.send'), validate([
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('العنوان مطلوب'),
  body('body').trim().isLength({ min: 1, max: 500 }).withMessage('نص الإشعار مطلوب'),
]), async (req, res, next) => {
  try {
    const { title, body: bodyText, icon, url, image } = req.body;
    const result = await broadcast({ title, body: bodyText, icon, data: { url }, image });
    return success(res, result, `تم إرسال الإشعار إلى ${result.sent} مشترك`);
  } catch (err) { next(err); }
});

module.exports = router;
