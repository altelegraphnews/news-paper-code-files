'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();

const {
  getComments, createComment, updateComment, deleteComment,
  moderateComment, likeComment, getPendingCount,
} = require('../controllers/commentController');
const { verifyToken, requireAtLeast, requirePermission, optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { publicLimiter, authLimiter } = require('../middleware/rateLimiter');

// Public: get approved comments
router.get('/', publicLimiter, optionalAuth, getComments);

// Public: post comment (guest or authenticated)
router.post('/', authLimiter, optionalAuth, validate([
  body('article').isMongoId().withMessage('معرف المقال غير صالح'),
  body('content').trim().isLength({ min: 2, max: 2000 }).withMessage('التعليق يجب أن يكون بين 2 و 2000 حرف'),
  body('parent').optional().isMongoId().withMessage('معرف التعليق الأصلي غير صالح'),
  body('guestName').optional().trim().isLength({ max: 100 }),
  body('guestEmail').optional().isEmail().normalizeEmail(),
]), createComment);

// Authenticated: edit own comment
router.put('/:id', verifyToken, validate([
  param('id').isMongoId().withMessage('معرف التعليق غير صالح'),
  body('content').trim().isLength({ min: 2, max: 2000 }).withMessage('التعليق يجب أن يكون بين 2 و 2000 حرف'),
]), updateComment);

// Authenticated: delete own or mod+
router.delete('/:id', verifyToken, validate([
  param('id').isMongoId().withMessage('معرف التعليق غير صالح'),
]), deleteComment);

// Moderator+: moderate comment
router.patch('/:id/moderate', verifyToken, requirePermission('comments.moderate'), validate([
  param('id').isMongoId().withMessage('معرف التعليق غير صالح'),
  body('status').isIn(['approved', 'rejected', 'spam']).withMessage('حالة الإشراف غير صالحة'),
]), moderateComment);

// Authenticated: like comment
router.post('/:id/like', verifyToken, validate([
  param('id').isMongoId().withMessage('معرف التعليق غير صالح'),
]), likeComment);

// Admin: pending count
router.get('/pending-count', verifyToken, requirePermission('comments.moderate'), getPendingCount);

module.exports = router;
