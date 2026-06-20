'use strict';

const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();

const {
  getArticles, getArticle, createArticle, updateArticle, deleteArticle,
  publishArticle, unpublishArticle, archiveArticle, getRevisions, restoreRevision,
  getFeaturedArticles, getBreakingArticles, toggleFeatured,
  bulkDeleteArticles, bulkUpdateStatus, checkSlug, getTags,
  submitForReview, approveArticle, rejectArticle, getPendingCount,
} = require('../controllers/articleController');
const { verifyToken, optionalAuth, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { publicLimiter } = require('../middleware/rateLimiter');

// Public routes
router.get('/featured', publicLimiter, getFeaturedArticles);
router.get('/breaking', publicLimiter, getBreakingArticles);
router.get('/check-slug', verifyToken, requirePermission('articles.create'), validate([
  query('slug').trim().notEmpty().withMessage('الرابط مطلوب'),
]), checkSlug);
router.get('/pending-count', verifyToken, requirePermission('articles.publish'), getPendingCount);
router.get('/', publicLimiter, optionalAuth, getArticles);
router.get('/:slug', publicLimiter, optionalAuth, getArticle);

// Tags
router.get('/tags/list', publicLimiter, getTags);

// Bulk operations (must come before /:id routes)
router.delete('/bulk', verifyToken, requirePermission('articles.delete'), validate([
  body('ids').isArray({ min: 1 }).withMessage('يجب تحديد مقالات'),
]), bulkDeleteArticles);

router.patch('/bulk/status', verifyToken, requirePermission('articles.publish'), validate([
  body('ids').isArray({ min: 1 }).withMessage('يجب تحديد مقالات'),
  body('status').isIn(['draft', 'pending', 'published', 'archived']).withMessage('الحالة غير صالحة'),
]), bulkUpdateStatus);

// Create — writers and up; controller scopes author/status by permission
router.post('/', verifyToken, requirePermission('articles.create'), validate([
  body('title').trim().isLength({ min: 5, max: 300 }).withMessage('العنوان يجب أن يكون بين 5 و 300 حرف'),
  body('category').isMongoId().withMessage('التصنيف غير صالح'),
  body('status').optional().isIn(['draft', 'pending', 'scheduled', 'published', 'archived']).withMessage('الحالة غير صالحة'),
]), createArticle);

// Update — ownership/permission enforced in controller
router.put('/:id', verifyToken, validate([
  param('id').isMongoId().withMessage('معرف المقال غير صالح'),
]), updateArticle);

router.delete('/:id', verifyToken, requirePermission('articles.delete'), validate([
  param('id').isMongoId().withMessage('معرف المقال غير صالح'),
]), deleteArticle);

// Review workflow
router.post('/:id/submit', verifyToken, requirePermission('articles.create'), validate([
  param('id').isMongoId().withMessage('معرف المقال غير صالح'),
]), submitForReview);

router.post('/:id/approve', verifyToken, requirePermission('articles.publish'), validate([
  param('id').isMongoId().withMessage('معرف المقال غير صالح'),
]), approveArticle);

router.post('/:id/reject', verifyToken, requirePermission('articles.publish'), validate([
  param('id').isMongoId().withMessage('معرف المقال غير صالح'),
  body('note').trim().isLength({ min: 3, max: 1000 }).withMessage('سبب الرفض مطلوب (3 إلى 1000 حرف)'),
]), rejectArticle);

router.post('/:id/publish', verifyToken, requirePermission('articles.publish'), validate([
  param('id').isMongoId().withMessage('معرف المقال غير صالح'),
]), publishArticle);

router.post('/:id/unpublish', verifyToken, requirePermission('articles.publish'), validate([
  param('id').isMongoId().withMessage('معرف المقال غير صالح'),
]), unpublishArticle);

router.post('/:id/archive', verifyToken, requirePermission('articles.publish'), validate([
  param('id').isMongoId().withMessage('معرف المقال غير صالح'),
]), archiveArticle);

// Revisions — ownership/permission enforced in controller
router.get('/:id/revisions', verifyToken, validate([
  param('id').isMongoId().withMessage('معرف المقال غير صالح'),
]), getRevisions);

router.post('/:id/revisions/:revisionId/restore', verifyToken, validate([
  param('id').isMongoId().withMessage('معرف المقال غير صالح'),
]), restoreRevision);

router.patch('/:id/toggle-featured', verifyToken, requirePermission('articles.feature'), validate([
  param('id').isMongoId().withMessage('معرف المقال غير صالح'),
]), toggleFeatured);

module.exports = router;
