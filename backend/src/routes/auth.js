'use strict';

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const {
  login, refresh, logout, logoutAll,
  forgotPassword, resetPassword, getMe, updateMe, changePassword,
} = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');

// POST /auth/login
router.post('/login', authLimiter, validate([
  body('email').isEmail().normalizeEmail().withMessage('البريد الإلكتروني غير صالح'),
  body('password').notEmpty().withMessage('كلمة المرور مطلوبة'),
]), login);

// POST /auth/refresh
router.post('/refresh', refresh);

// POST /auth/logout
router.post('/logout', logout);

// POST /auth/logout-all
router.post('/logout-all', verifyToken, logoutAll);

// POST /auth/forgot-password
router.post('/forgot-password', authLimiter, validate([
  body('email').isEmail().normalizeEmail().withMessage('البريد الإلكتروني غير صالح'),
]), forgotPassword);

// POST /auth/reset-password
router.post('/reset-password', validate([
  body('token').notEmpty().withMessage('الرمز مطلوب'),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('كلمة المرور يجب أن تحتوي على حروف كبيرة وصغيرة وأرقام وتكون 8 أحرف على الأقل'),
]), resetPassword);

// GET /auth/me
router.get('/me', verifyToken, getMe);

// PATCH /auth/me
router.patch('/me', verifyToken, updateMe);

// POST /auth/change-password
router.post('/change-password', verifyToken, validate([
  body('currentPassword').notEmpty().withMessage('كلمة المرور الحالية مطلوبة'),
  body('newPassword')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('كلمة المرور الجديدة لا تستوفي متطلبات الأمان'),
]), changePassword);

module.exports = router;
