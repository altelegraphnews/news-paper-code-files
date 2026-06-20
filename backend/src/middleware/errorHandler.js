'use strict';

const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Map common error types to Arabic messages and HTTP status codes
 */
const getErrorResponse = (err) => {
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return {
      statusCode: 422,
      message: 'خطأ في البيانات المدخلة',
      errors,
      code: 'VALIDATION_ERROR',
    };
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'حقل';
    const fieldNames = {
      email: 'البريد الإلكتروني',
      slug: 'الرابط',
      name: 'الاسم',
    };
    const fieldAr = fieldNames[field] || field;
    return {
      statusCode: 409,
      message: `${fieldAr} مستخدم بالفعل`,
      code: 'DUPLICATE_KEY',
    };
  }

  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return {
      statusCode: 400,
      message: 'معرف غير صالح',
      code: 'INVALID_ID',
    };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return {
      statusCode: 401,
      message: 'رمز المصادقة غير صالح',
      code: 'INVALID_TOKEN',
    };
  }

  if (err.name === 'TokenExpiredError') {
    return {
      statusCode: 401,
      message: 'انتهت صلاحية الجلسة',
      code: 'TOKEN_EXPIRED',
    };
  }

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return {
      statusCode: 413,
      message: 'حجم الملف كبير جدًا',
      code: 'FILE_TOO_LARGE',
    };
  }

  // Multer unexpected field
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return {
      statusCode: 400,
      message: 'حقل الملف غير متوقع',
      code: 'UNEXPECTED_FILE_FIELD',
    };
  }

  // Custom app errors with status code
  if (err.statusCode) {
    return {
      statusCode: err.statusCode,
      message: err.message || 'حدث خطأ',
      code: err.code || 'APP_ERROR',
    };
  }

  // Default server error
  return {
    statusCode: 500,
    message: 'حدث خطأ في الخادم، يرجى المحاولة لاحقًا',
    code: 'INTERNAL_SERVER_ERROR',
  };
};

/**
 * Global error handler middleware
 * Must be registered last in the middleware chain
 */
const errorHandler = (err, req, res, next) => {
  // Log the error
  const isServerError = !err.statusCode || err.statusCode >= 500;

  if (isServerError) {
    logger.error('Unhandled error:', {
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userId: req.user?._id,
    });
  } else {
    logger.warn('Client error:', {
      message: err.message,
      url: req.originalUrl,
      method: req.method,
      statusCode: err.statusCode,
    });
  }

  const { statusCode, message, errors: errList, code } = getErrorResponse(err);

  const response = {
    success: false,
    message,
    code,
  };

  if (errList) {
    response.errors = errList;
  }

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development' && isServerError) {
    response.stack = err.stack;
  }

  return res.status(statusCode).json(response);
};

/**
 * Handle 404 not found
 */
const notFoundHandler = (req, res) => {
  return res.status(404).json({
    success: false,
    message: `المسار غير موجود: ${req.method} ${req.originalUrl}`,
    code: 'NOT_FOUND',
  });
};

/**
 * Create a custom app error
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'APP_ERROR') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = { errorHandler, notFoundHandler, AppError };
