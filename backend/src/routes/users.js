'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();
const crypto = require('crypto');

const User = require('../models/User');
const Article = require('../models/Article');
const { success, created, paginated, errors } = require('../utils/responseHelper');
const { verifyToken, requireAtLeast, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { logAction } = require('../middleware/auditLogger');
const { getEmailQueue } = require('../jobs/queue');
const { PERMISSION_KEYS, ROLE_DEFAULTS, effectivePermissions } = require('../config/permissions');
const logger = require('../utils/logger');

const STAFF_ROLES = ['author', 'editor', 'admin', 'super_admin'];

// Attach effective permissions to a lean user object
const withPermissions = (user) => ({
  ...user,
  permissions: effectivePermissions(user.role, user.permissionOverrides),
});

// Sanitize permissionOverrides from request body to known keys/booleans
const cleanOverrides = (overrides) => {
  if (!overrides || typeof overrides !== 'object') return undefined;
  const clean = {};
  for (const key of PERMISSION_KEYS) {
    if (typeof overrides[key] === 'boolean') clean[key] = overrides[key];
  }
  return clean;
};

// Only super_admin can manage admin-level accounts
const canManageTarget = (actor, targetRole) => {
  if (actor.role === 'super_admin') return targetRole !== 'super_admin';
  return !['admin', 'super_admin'].includes(targetRole);
};

// GET /users/by-slug/:slug — public: resolve author by name-slug
router.get('/by-slug/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    // slug is kebab-case name, e.g. "mohammad-ali"
    const nameSearch = slug.replace(/-/g, ' ');
    const user = await User.findOne({
      $or: [
        { slug: slug },
        { name: { $regex: new RegExp(nameSearch, 'i') } },
      ],
      isActive: true,
      role: { $in: STAFF_ROLES },
    }).select('name bio avatar role jobTitle socialLinks createdAt').lean();
    if (!user) return errors.notFound(res, 'الكاتب');
    return success(res, user);
  } catch (err) { next(err); }
});

// GET /users/authors — public: active staff with published articles, for the writers index
router.get('/authors', async (req, res, next) => {
  try {
    const counts = await Article.aggregate([
      { $match: { status: 'published' } },
      { $group: { _id: '$author', articlesCount: { $sum: 1 }, latestAt: { $max: '$publishedAt' } } },
    ]);
    const byId = new Map(counts.filter((c) => c._id).map((c) => [String(c._id), c]));
    const users = await User.find({ _id: { $in: [...byId.keys()] }, isActive: true })
      .select('name slug bio avatar jobTitle')
      .lean();
    const authors = users
      .map((u) => ({
        ...u,
        articlesCount: byId.get(String(u._id)).articlesCount,
        latestAt: byId.get(String(u._id)).latestAt,
      }))
      .sort((a, b) => b.articlesCount - a.articlesCount);
    return success(res, authors);
  } catch (err) { next(err); }
});

// GET /users/permission-keys — metadata for the admin privileges editor
router.get('/permission-keys', verifyToken, requirePermission('users.manage'), (req, res) => {
  return success(res, { keys: PERMISSION_KEYS, roleDefaults: ROLE_DEFAULTS });
});

// GET /users/writers — light staff list for author-assignment dropdowns
router.get('/writers', verifyToken, requirePermission('articles.create'), async (req, res, next) => {
  try {
    const writers = await User.find({ role: { $in: STAFF_ROLES }, isActive: true })
      .sort('name')
      .select('name avatar role jobTitle')
      .lean();
    return success(res, writers);
  } catch (err) { next(err); }
});

// GET /users — staff management
router.get('/', verifyToken, requirePermission('users.manage'), async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, search, isActive } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort('-createdAt')
        .skip(skip)
        .limit(limitNum)
        .select('-password -refreshTokens -twoFactorSecret -passwordResetToken')
        .lean(),
      User.countDocuments(filter),
    ]);

    return paginated(res, users.map(withPermissions), { page: pageNum, limit: limitNum, total });
  } catch (err) { next(err); }
});

// GET /users/:id — staff management
router.get('/:id', verifyToken, requirePermission('users.manage'), validate([
  param('id').isMongoId(),
]), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -refreshTokens -twoFactorSecret -passwordResetToken')
      .lean();
    if (!user) return errors.notFound(res, 'المستخدم');
    return success(res, withPermissions(user));
  } catch (err) { next(err); }
});

// POST /users — create account directly (writer/editor/admin) with a password
router.post('/', verifyToken, requirePermission('users.manage'), validate([
  body('email').isEmail().normalizeEmail().withMessage('البريد الإلكتروني غير صالح'),
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('الاسم يجب أن يكون بين 2 و 100 حرف'),
  body('password').isLength({ min: 8 }).withMessage('كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
  body('role').isIn(['author', 'editor', 'admin']).withMessage('الدور غير صالح'),
]), async (req, res, next) => {
  try {
    const { email, name, password, role, bio, jobTitle, avatar, socialLinks, permissionOverrides } = req.body;

    if (!canManageTarget(req.user, role)) {
      return errors.forbidden(res, 'فقط المدير الأعلى يمكنه إنشاء حسابات بصلاحية مدير');
    }

    const existing = await User.findOne({ email });
    if (existing) return errors.conflict(res, 'البريد الإلكتروني مستخدم بالفعل');

    const user = await User.create({
      name,
      email,
      password,
      role,
      bio,
      jobTitle,
      avatar,
      socialLinks,
      permissionOverrides: cleanOverrides(permissionOverrides) || {},
      isActive: true,
      isEmailVerified: true,
      invitedBy: req.user._id,
    });

    await logAction({ req, action: 'user.create', resourceType: 'user', resourceId: user._id, resourceTitle: user.email, severity: 'medium' });
    return created(res, withPermissions(user.toJSON()), 'تم إنشاء الحساب بنجاح');
  } catch (err) { next(err); }
});

// POST /users/invite — create account with temp password sent by email
router.post('/invite', verifyToken, requirePermission('users.manage'), validate([
  body('email').isEmail().normalizeEmail().withMessage('البريد الإلكتروني غير صالح'),
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('الاسم يجب أن يكون بين 2 و 100 حرف'),
  body('role').isIn(['editor', 'author', 'admin']).withMessage('الدور غير صالح'),
]), async (req, res, next) => {
  try {
    const { email, name, role } = req.body;

    if (!canManageTarget(req.user, role)) {
      return errors.forbidden(res, 'فقط المدير الأعلى يمكنه إنشاء حسابات بصلاحية مدير');
    }

    const existing = await User.findOne({ email });
    if (existing) return errors.conflict(res, 'البريد الإلكتروني مستخدم بالفعل');

    const tempPassword = crypto.randomBytes(6).toString('hex') + 'A1!';
    const user = await User.create({ name, email, password: tempPassword, role, isActive: true, invitedBy: req.user._id });

    try {
      const emailQueue = getEmailQueue();
      await emailQueue.add('invite', {
        to: email, name, role, tempPassword,
        loginUrl: `${process.env.ADMIN_URL || 'http://localhost:3001'}/login`,
      });
    } catch (queueErr) {
      logger.error('Failed to queue invite email:', queueErr.message);
    }

    await logAction({ req, action: 'user.invite', resourceType: 'user', resourceId: user._id, resourceTitle: user.email });
    return created(res, { _id: user._id, name: user.name, email: user.email, role: user.role }, 'تم إرسال الدعوة بنجاح');
  } catch (err) { next(err); }
});

// POST /users/:id/reset-password — set a new password for the account
router.post('/:id/reset-password', verifyToken, requirePermission('users.manage'), validate([
  param('id').isMongoId().withMessage('معرف المستخدم غير صالح'),
]), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('+password');
    if (!user) return errors.notFound(res, 'المستخدم');
    if (!canManageTarget(req.user, user.role)) {
      return errors.forbidden(res, 'لا يمكنك تعديل هذا الحساب');
    }

    // Admin may supply the new password directly; otherwise generate one
    const newPassword = (typeof req.body.password === 'string' && req.body.password.length >= 8)
      ? req.body.password
      : crypto.randomBytes(6).toString('hex') + 'A1!';

    user.password = newPassword;
    user.refreshTokens = [];
    await user.save();

    try {
      const emailQueue = getEmailQueue();
      await emailQueue.add('password-reset-admin', {
        to: user.email, name: user.name, tempPassword: newPassword,
        loginUrl: `${process.env.ADMIN_URL || 'http://localhost:3001'}/login`,
      });
    } catch (queueErr) {
      logger.error('Failed to queue password reset email:', queueErr.message);
    }

    await logAction({ req, action: 'user.reset_password', resourceType: 'user', resourceId: user._id, severity: 'high' });

    // Return the generated password so the admin can hand it over directly
    // (email delivery is optional infrastructure)
    const payload = req.body.password ? null : { tempPassword: newPassword };
    return success(res, payload, 'تم إعادة تعيين كلمة المرور');
  } catch (err) { next(err); }
});

// PATCH /users/:id/toggle-active
router.patch('/:id/toggle-active', verifyToken, requirePermission('users.manage'), validate([
  param('id').isMongoId().withMessage('معرف المستخدم غير صالح'),
]), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return errors.notFound(res, 'المستخدم');
    if (!canManageTarget(req.user, user.role)) {
      return errors.forbidden(res, 'لا يمكنك تعديل هذا الحساب');
    }

    user.isActive = !user.isActive;
    if (!user.isActive) user.refreshTokens = [];
    await user.save();

    await logAction({ req, action: user.isActive ? 'user.activate' : 'user.deactivate', resourceType: 'user', resourceId: user._id, severity: 'medium' });
    return success(res, { isActive: user.isActive }, `تم ${user.isActive ? 'تفعيل' : 'تعطيل'} الحساب`);
  } catch (err) { next(err); }
});

// PUT /users/:id — update profile, role and privileges
router.put('/:id', verifyToken, requirePermission('users.manage'), validate([
  param('id').isMongoId().withMessage('معرف المستخدم غير صالح'),
]), async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return errors.notFound(res, 'المستخدم');

    if (!canManageTarget(req.user, user.role)) {
      return errors.forbidden(res, 'لا يمكنك تعديل هذا الحساب');
    }

    // Role escalation guard
    if (req.body.role !== undefined && req.body.role !== user.role) {
      if (!['author', 'editor', 'admin'].includes(req.body.role)) {
        return errors.badRequest(res, 'الدور غير صالح');
      }
      if (!canManageTarget(req.user, req.body.role)) {
        return errors.forbidden(res, 'فقط المدير الأعلى يمكنه منح صلاحية مدير');
      }
      user.role = req.body.role;
    }

    const allowed = ['name', 'isActive', 'bio', 'avatar', 'socialLinks', 'jobTitle'];
    allowed.forEach((f) => { if (req.body[f] !== undefined) user[f] = req.body[f]; });

    const overrides = cleanOverrides(req.body.permissionOverrides);
    if (overrides !== undefined) {
      user.permissionOverrides = overrides;
      user.markModified('permissionOverrides');
    }

    await user.save();
    await logAction({ req, action: 'user.update', resourceType: 'user', resourceId: user._id, resourceTitle: user.email });
    return success(res, withPermissions(user.toJSON()), 'تم تحديث المستخدم');
  } catch (err) { next(err); }
});

// DELETE /users/:id — super_admin only
router.delete('/:id', verifyToken, requireAtLeast('super_admin'), validate([
  param('id').isMongoId(),
]), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return errors.notFound(res, 'المستخدم');
    if (user.role === 'super_admin') return errors.forbidden(res, 'لا يمكن حذف حساب المدير الأعلى');

    user.isActive = false;
    user.refreshTokens = [];
    await user.save();

    await logAction({ req, action: 'user.deactivate', resourceType: 'user', resourceId: user._id, severity: 'high' });
    return success(res, null, 'تم تعطيل حساب المستخدم');
  } catch (err) { next(err); }
});

module.exports = router;
