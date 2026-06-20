'use strict';

const { validationResult, body, param, query } = require('express-validator');
const { errors } = require('../utils/responseHelper');

/**
 * Run validation and return errors if any
 */
const validate = (validations) => {
  return async (req, res, next) => {
    // Run all validations
    await Promise.all(validations.map((v) => v.run(req)));

    const result = validationResult(req);
    if (result.isEmpty()) return next();

    const formattedErrors = result.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
    }));

    return errors.validationError(res, formattedErrors);
  };
};

// ============================================
// Reusable validators
// ============================================

const articleValidators = {
  create: [
    body('title')
      .trim()
      .notEmpty().withMessage('عنوان المقال مطلوب')
      .isLength({ max: 300 }).withMessage('العنوان لا يتجاوز 300 حرف'),
    body('content')
      .optional()
      .isString().withMessage('المحتوى يجب أن يكون نصًا'),
    body('category')
      .notEmpty().withMessage('التصنيف مطلوب')
      .isMongoId().withMessage('معرف التصنيف غير صالح'),
    body('status')
      .optional()
      .isIn(['draft', 'pending', 'scheduled', 'published', 'archived'])
      .withMessage('حالة المقال غير صالحة'),
    body('tags')
      .optional()
      .isArray().withMessage('الوسوم يجب أن تكون مصفوفة'),
    body('publishAt')
      .optional()
      .isISO8601().withMessage('تاريخ النشر غير صالح'),
  ],
  update: [
    param('id').isMongoId().withMessage('معرف المقال غير صالح'),
    body('title')
      .optional()
      .trim()
      .isLength({ max: 300 }).withMessage('العنوان لا يتجاوز 300 حرف'),
    body('category')
      .optional()
      .isMongoId().withMessage('معرف التصنيف غير صالح'),
    body('status')
      .optional()
      .isIn(['draft', 'pending', 'scheduled', 'published', 'archived'])
      .withMessage('حالة المقال غير صالحة'),
  ],
};

const authValidators = {
  login: [
    body('email')
      .trim()
      .notEmpty().withMessage('البريد الإلكتروني مطلوب')
      .isEmail().withMessage('البريد الإلكتروني غير صالح')
      .normalizeEmail(),
    body('password')
      .notEmpty().withMessage('كلمة المرور مطلوبة')
      .isLength({ min: 6 }).withMessage('كلمة المرور قصيرة جدًا'),
  ],
  forgotPassword: [
    body('email')
      .trim()
      .notEmpty().withMessage('البريد الإلكتروني مطلوب')
      .isEmail().withMessage('البريد الإلكتروني غير صالح')
      .normalizeEmail(),
  ],
  resetPassword: [
    body('token')
      .notEmpty().withMessage('رمز إعادة التعيين مطلوب'),
    body('password')
      .notEmpty().withMessage('كلمة المرور مطلوبة')
      .isLength({ min: 8 }).withMessage('كلمة المرور يجب أن تكون 8 أحرف على الأقل')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('كلمة المرور يجب أن تحتوي على أحرف كبيرة وصغيرة وأرقام'),
    body('confirmPassword')
      .notEmpty().withMessage('تأكيد كلمة المرور مطلوب')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('كلمتا المرور غير متطابقتان');
        }
        return true;
      }),
  ],
};

const categoryValidators = {
  create: [
    body('name')
      .trim()
      .notEmpty().withMessage('اسم التصنيف مطلوب')
      .isLength({ max: 100 }).withMessage('اسم التصنيف لا يتجاوز 100 حرف'),
    body('parent')
      .optional({ nullable: true })
      .isMongoId().withMessage('معرف التصنيف الأب غير صالح'),
    body('order')
      .optional()
      .isInt({ min: 0 }).withMessage('الترتيب يجب أن يكون عددًا موجبًا'),
  ],
};

const commentValidators = {
  create: [
    body('content')
      .trim()
      .notEmpty().withMessage('محتوى التعليق مطلوب')
      .isLength({ min: 2, max: 2000 }).withMessage('التعليق يجب أن يكون بين 2 و 2000 حرف'),
    body('article')
      .notEmpty().withMessage('معرف المقال مطلوب')
      .isMongoId().withMessage('معرف المقال غير صالح'),
    body('parent')
      .optional({ nullable: true })
      .isMongoId().withMessage('معرف التعليق الأب غير صالح'),
  ],
};

const userValidators = {
  create: [
    body('name')
      .trim()
      .notEmpty().withMessage('الاسم مطلوب')
      .isLength({ max: 100 }).withMessage('الاسم لا يتجاوز 100 حرف'),
    body('email')
      .trim()
      .notEmpty().withMessage('البريد الإلكتروني مطلوب')
      .isEmail().withMessage('البريد الإلكتروني غير صالح')
      .normalizeEmail(),
    body('password')
      .notEmpty().withMessage('كلمة المرور مطلوبة')
      .isLength({ min: 8 }).withMessage('كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
    body('role')
      .optional()
      .isIn(['reader', 'author', 'editor', 'admin', 'super_admin'])
      .withMessage('الدور غير صالح'),
  ],
  update: [
    param('id').isMongoId().withMessage('معرف المستخدم غير صالح'),
    body('name')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('الاسم لا يتجاوز 100 حرف'),
    body('role')
      .optional()
      .isIn(['reader', 'author', 'editor', 'admin', 'super_admin'])
      .withMessage('الدور غير صالح'),
  ],
};

const tickerValidators = {
  create: [
    body('text')
      .trim()
      .notEmpty().withMessage('نص الشريط مطلوب')
      .isLength({ max: 300 }).withMessage('نص الشريط لا يتجاوز 300 حرف'),
    body('type')
      .optional()
      .isIn(['breaking', 'info', 'update', 'promo'])
      .withMessage('نوع الشريط غير صالح'),
    body('priority')
      .optional()
      .isInt({ min: 0, max: 10 }).withMessage('الأولوية يجب أن تكون بين 0 و 10'),
  ],
};

const paginationValidators = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('رقم الصفحة يجب أن يكون أكبر من صفر'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('الحد الأقصى يجب أن يكون بين 1 و 100'),
];

module.exports = {
  validate,
  articleValidators,
  authValidators,
  categoryValidators,
  commentValidators,
  userValidators,
  tickerValidators,
  paginationValidators,
};
