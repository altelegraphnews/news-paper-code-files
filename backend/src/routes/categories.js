'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();

const {
  getCategories, getCategory, createCategory, updateCategory,
  deleteCategory, reorderCategories, getNavCategories,
} = require('../controllers/categoryController');
const { verifyToken, requireAtLeast, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { publicLimiter } = require('../middleware/rateLimiter');

// Public
router.get('/', publicLimiter, getCategories);
router.get('/nav', publicLimiter, getNavCategories);
router.get('/:slug', publicLimiter, getCategory);

// Admin+
router.post('/', verifyToken, requirePermission('categories.manage'), validate([
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('اسم التصنيف يجب أن يكون بين 2 و 100 حرف'),
]), createCategory);

router.put('/:id', verifyToken, requirePermission('categories.manage'), validate([
  param('id').isMongoId().withMessage('معرف التصنيف غير صالح'),
]), updateCategory);

router.delete('/:id', verifyToken, requirePermission('categories.manage'), validate([
  param('id').isMongoId().withMessage('معرف التصنيف غير صالح'),
]), deleteCategory);

router.post('/reorder', verifyToken, requirePermission('categories.manage'), validate([
  body('orders').isArray().withMessage('قائمة الترتيب مطلوبة'),
]), reorderCategories);

module.exports = router;
