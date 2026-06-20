'use strict';

const crypto = require('crypto');
const User = require('../models/User');
const { success, errors } = require('../utils/responseHelper');
const {
  generateAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
} = require('../middleware/auth');
const { getEmailQueue } = require('../jobs/queue');
const { effectivePermissions } = require('../config/permissions');
const logger = require('../utils/logger');
const config = require('../config/env');

// Cookie options for refresh token
const refreshCookieOptions = {
  httpOnly: true,
  secure: config.env === 'production',
  sameSite: config.env === 'production' ? 'strict' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/v1/auth',
};

const accessCookieOptions = {
  httpOnly: true,
  secure: config.env === 'production',
  sameSite: config.env === 'production' ? 'strict' : 'lax',
  maxAge: 15 * 60 * 1000, // 15 minutes
};

/**
 * POST /auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user with password field
    const user = await User.findOne({ email }).select('+password +refreshTokens');

    if (!user || !(await user.comparePassword(password))) {
      return errors.unauthorized(res, 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }

    if (!user.isActive) {
      return errors.unauthorized(res, 'حسابك معطل، يرجى التواصل مع الدعم الفني');
    }

    // Generate tokens
    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id, user.role);
    const expiresAt = getRefreshTokenExpiry();

    // Clean expired tokens and add new one
    user.cleanExpiredTokens();
    user.refreshTokens.push({
      token: refreshToken,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      expiresAt,
    });

    // Update login stats
    user.lastLoginAt = new Date();
    user.lastLoginIp = req.ip;
    user.loginCount += 1;

    await user.save();

    // Set HTTP-only cookies
    res.cookie('refresh_token', refreshToken, refreshCookieOptions);
    res.cookie('access_token', accessToken, accessCookieOptions);

    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      jobTitle: user.jobTitle,
      permissions: effectivePermissions(user.role, user.permissionOverrides),
    };

    return success(res, {
      user: userData,
      accessToken,
      expiresIn: config.jwt.accessExpires,
    }, 'تم تسجيل الدخول بنجاح');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/refresh
 * Rotate refresh token
 */
const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refresh_token || req.body?.refreshToken;

    if (!refreshToken) {
      return errors.unauthorized(res, 'رمز التحديث مطلوب');
    }

    const jwt = require('jsonwebtoken');
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
    } catch (jwtErr) {
      res.clearCookie('refresh_token', { path: '/api/v1/auth' });
      if (jwtErr.name === 'TokenExpiredError') {
        return errors.unauthorized(res, 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجددًا');
      }
      return errors.unauthorized(res, 'رمز التحديث غير صالح');
    }

    if (decoded.type !== 'refresh') {
      return errors.unauthorized(res, 'رمز التحديث غير صالح');
    }

    const user = await User.findById(decoded.id).select('+refreshTokens');
    if (!user || !user.isActive) {
      return errors.unauthorized(res);
    }

    // Find and validate the refresh token
    const tokenIndex = user.refreshTokens.findIndex(
      (rt) => rt.token === refreshToken && rt.expiresAt > new Date()
    );

    if (tokenIndex === -1) {
      // Token reuse detected - invalidate all tokens
      user.refreshTokens = [];
      await user.save();
      logger.warn(`Refresh token reuse detected for user: ${user.email}`);
      return errors.unauthorized(res, 'تم اكتشاف استخدام مشبوه للجلسة، يرجى تسجيل الدخول مجددًا');
    }

    // Rotate: remove old, add new
    const newRefreshToken = generateRefreshToken(user._id, user.role);
    const newAccessToken = generateAccessToken(user._id, user.role);
    const newExpiresAt = getRefreshTokenExpiry();

    user.refreshTokens.splice(tokenIndex, 1);
    user.cleanExpiredTokens();
    user.refreshTokens.push({
      token: newRefreshToken,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      expiresAt: newExpiresAt,
    });

    await user.save();

    res.cookie('refresh_token', newRefreshToken, refreshCookieOptions);
    res.cookie('access_token', newAccessToken, accessCookieOptions);

    return success(res, {
      accessToken: newAccessToken,
      expiresIn: config.jwt.accessExpires,
    }, 'تم تجديد الجلسة بنجاح');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/logout
 */
const logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refresh_token || req.body?.refreshToken;

    if (req.user && refreshToken) {
      const user = await User.findById(req.user._id).select('+refreshTokens');
      if (user) {
        user.refreshTokens = user.refreshTokens.filter((rt) => rt.token !== refreshToken);
        await user.save();
      }
    }

    res.clearCookie('refresh_token', { path: '/api/v1/auth' });
    res.clearCookie('access_token');

    return success(res, null, 'تم تسجيل الخروج بنجاح');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/logout-all
 * Logout from all devices
 */
const logoutAll = async (req, res, next) => {
  try {
    if (req.user) {
      await User.findByIdAndUpdate(req.user._id, { $set: { refreshTokens: [] } });
    }

    res.clearCookie('refresh_token', { path: '/api/v1/auth' });
    res.clearCookie('access_token');

    return success(res, null, 'تم تسجيل الخروج من جميع الأجهزة');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/forgot-password
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });

    // Always return success to prevent email enumeration
    const successResponse = () =>
      success(
        res,
        null,
        'إذا كان البريد الإلكتروني مسجلًا لدينا، ستصل إليك رسالة لإعادة تعيين كلمة المرور'
      );

    if (!user || !user.isActive) {
      return successResponse();
    }

    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // Queue email job
    try {
      const emailQueue = getEmailQueue();
      await emailQueue.add('password-reset', {
        to: user.email,
        name: user.name,
        resetToken,
        resetUrl: `${config.frontend.url}/reset-password?token=${resetToken}`,
      });
    } catch (queueErr) {
      logger.error('Failed to queue password reset email:', queueErr.message);
      // Rollback token
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
      return errors.serverError(res, 'فشل إرسال البريد الإلكتروني، يرجى المحاولة لاحقًا');
    }

    return successResponse();
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/reset-password
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    // Hash the token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) {
      return errors.badRequest(res, 'رمز إعادة التعيين غير صالح أو منتهي الصلاحية');
    }

    // Update password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    // Invalidate all refresh tokens
    user.refreshTokens = [];
    await user.save();

    // Send confirmation email
    try {
      const emailQueue = getEmailQueue();
      await emailQueue.add('password-changed', {
        to: user.email,
        name: user.name,
      });
    } catch {
      // Non-critical
    }

    return success(res, null, 'تم إعادة تعيين كلمة المرور بنجاح، يمكنك تسجيل الدخول الآن');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /auth/me
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('preferences.categories', 'name slug')
      .lean();

    if (!user) return errors.notFound(res, 'المستخدم');

    user.permissions = effectivePermissions(user.role, user.permissionOverrides);

    return success(res, user);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /auth/me
 */
const updateMe = async (req, res, next) => {
  try {
    const allowedFields = ['name', 'nameEn', 'bio', 'socialLinks', 'preferences', 'avatar', 'jobTitle'];
    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    return success(res, user, 'تم تحديث البيانات بنجاح');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/change-password
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password +refreshTokens');

    if (!(await user.comparePassword(currentPassword))) {
      return errors.badRequest(res, 'كلمة المرور الحالية غير صحيحة');
    }

    user.password = newPassword;
    // Invalidate all other refresh tokens
    user.refreshTokens = [];
    await user.save();

    res.clearCookie('refresh_token', { path: '/api/v1/auth' });

    return success(res, null, 'تم تغيير كلمة المرور بنجاح');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  refresh,
  logout,
  logoutAll,
  forgotPassword,
  resetPassword,
  getMe,
  updateMe,
  changePassword,
};
