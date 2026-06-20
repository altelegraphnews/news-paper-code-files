'use strict';

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/env');
const { errors } = require('../utils/responseHelper');
const logger = require('../utils/logger');

/**
 * Verify JWT token from Authorization header (Bearer scheme)
 * Sets req.user on success
 */
const verifyToken = async (req, res, next) => {
  try {
    let token;

    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // Fallback: check cookie
    if (!token && req.cookies && req.cookies.access_token) {
      token = req.cookies.access_token;
    }

    if (!token) {
      return errors.unauthorized(res, 'يجب تسجيل الدخول للوصول إلى هذه الصفحة');
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return errors.unauthorized(res, 'انتهت صلاحية جلسة الدخول، يرجى تسجيل الدخول مجددًا');
      }
      if (jwtError.name === 'JsonWebTokenError') {
        return errors.unauthorized(res, 'رمز المصادقة غير صالح');
      }
      throw jwtError;
    }

    if (decoded.type !== 'access') {
      return errors.unauthorized(res, 'رمز المصادقة غير صالح');
    }

    // Fetch user from DB
    const user = await User.findById(decoded.id).select('+refreshTokens');
    if (!user) {
      return errors.unauthorized(res, 'المستخدم غير موجود');
    }

    if (!user.isActive) {
      return errors.unauthorized(res, 'حسابك معطل، يرجى التواصل مع الدعم الفني');
    }

    req.user = user;
    req.tokenPayload = decoded;
    next();
  } catch (error) {
    logger.error('verifyToken error:', error);
    return errors.serverError(res);
  }
};

/**
 * Role-based access control middleware
 * Usage: requireRole('admin', 'super_admin')
 * @param {...string} roles - Allowed roles
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errors.unauthorized(res);
    }

    if (!roles.includes(req.user.role)) {
      return errors.forbidden(
        res,
        `هذه العملية تتطلب صلاحية: ${roles.join(' أو ')}`
      );
    }

    next();
  };
};

/**
 * Require minimum role level
 * Usage: requireAtLeast('editor')
 */
const requireAtLeast = (role) => {
  const hierarchy = { reader: 0, author: 1, editor: 2, admin: 3, super_admin: 4 };

  return (req, res, next) => {
    if (!req.user) {
      return errors.unauthorized(res);
    }

    const userLevel = hierarchy[req.user.role] || 0;
    const requiredLevel = hierarchy[role] || 0;

    if (userLevel < requiredLevel) {
      return errors.forbidden(res, 'ليس لديك الصلاحية الكافية للقيام بهذا الإجراء');
    }

    next();
  };
};

/**
 * Granular permission check (role defaults + per-user overrides).
 * Usage: requirePermission('articles.publish')
 * Multiple keys = user must have ALL of them.
 */
const requirePermission = (...keys) => {
  return (req, res, next) => {
    if (!req.user) {
      return errors.unauthorized(res);
    }

    const missing = keys.filter((key) => !req.user.can(key));
    if (missing.length > 0) {
      return errors.forbidden(res, 'ليس لديك الصلاحية الكافية للقيام بهذا الإجراء');
    }

    next();
  };
};

/**
 * Optional auth - sets req.user if valid token present, does not fail if not
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token && req.cookies && req.cookies.access_token) {
      token = req.cookies.access_token;
    }

    if (!token) return next();

    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      if (decoded.type === 'access') {
        const user = await User.findById(decoded.id);
        if (user && user.isActive) {
          req.user = user;
          req.tokenPayload = decoded;
        }
      }
    } catch {
      // Token invalid - silently ignore
    }

    next();
  } catch (error) {
    logger.error('optionalAuth error:', error);
    next();
  }
};

/**
 * Verify resource ownership or admin access
 * Usage: requireOwnership('authorId field on req body/param')
 */
const requireOwnership = (getOwnerId) => {
  return (req, res, next) => {
    if (!req.user) return errors.unauthorized(res);

    // Admins bypass ownership check
    if (['admin', 'super_admin'].includes(req.user.role)) return next();

    const ownerId = typeof getOwnerId === 'function'
      ? getOwnerId(req)
      : req.resource?.[getOwnerId];

    if (!ownerId) return errors.forbidden(res);

    if (ownerId.toString() !== req.user._id.toString()) {
      return errors.forbidden(res, 'لا يمكنك تعديل محتوى لا تملكه');
    }

    next();
  };
};

/**
 * Generate JWT access token
 */
const generateAccessToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role, type: 'access' },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpires }
  );
};

/**
 * Generate JWT refresh token
 */
const generateRefreshToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role, type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpires }
  );
};

/**
 * Parse refresh token expiry to Date
 */
const getRefreshTokenExpiry = () => {
  const expires = config.jwt.refreshExpires;
  const match = expires.match(/^(\d+)([smhd])$/);
  if (!match) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [, amount, unit] = match;
  const ms = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  }[unit];

  return new Date(Date.now() + parseInt(amount) * ms);
};

module.exports = {
  verifyToken,
  requireRole,
  requireAtLeast,
  requirePermission,
  optionalAuth,
  requireOwnership,
  generateAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
};
