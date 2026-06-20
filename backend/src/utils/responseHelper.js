'use strict';

/**
 * Standardized API response helpers for AL-WID
 */

/**
 * Send a successful response
 * @param {object} res - Express response object
 * @param {*} data - Response data
 * @param {string} [message] - Success message (Arabic)
 * @param {object} [meta] - Pagination or additional metadata
 * @param {number} [statusCode=200]
 */
const success = (res, data, message = 'تمت العملية بنجاح', meta = null, statusCode = 200) => {
  const response = {
    success: true,
    message,
    data,
  };

  if (meta) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
};

/**
 * Send a created response (201)
 * @param {object} res
 * @param {*} data
 * @param {string} [message]
 */
const created = (res, data, message = 'تم الإنشاء بنجاح') => {
  return success(res, data, message, null, 201);
};

/**
 * Send a paginated response
 * @param {object} res
 * @param {Array} data
 * @param {object} pagination
 * @param {number} pagination.page
 * @param {number} pagination.limit
 * @param {number} pagination.total
 * @param {string} [message]
 */
const paginated = (res, data, pagination, message = 'تمت العملية بنجاح') => {
  const { page, limit, total } = pagination;
  const totalPages = Math.ceil(total / limit);

  const meta = {
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };

  return success(res, data, message, meta);
};

/**
 * Send an error response
 * @param {object} res
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message (Arabic)
 * @param {*} [details] - Additional error details
 * @param {string} [code] - Machine-readable error code
 */
const error = (res, statusCode, message, details = null, code = null) => {
  const response = {
    success: false,
    message,
  };

  if (code) {
    response.code = code;
  }

  if (details && process.env.NODE_ENV !== 'production') {
    response.details = details;
  } else if (details && Array.isArray(details)) {
    // Always include validation errors
    response.errors = details;
  }

  return res.status(statusCode).json(response);
};

/**
 * Common error responses in Arabic
 */
const errors = {
  notFound: (res, resource = 'العنصر') =>
    error(res, 404, `${resource} غير موجود`, null, 'NOT_FOUND'),

  unauthorized: (res, message = 'غير مصرح لك بالوصول') =>
    error(res, 401, message, null, 'UNAUTHORIZED'),

  forbidden: (res, message = 'ليس لديك صلاحية للقيام بهذا الإجراء') =>
    error(res, 403, message, null, 'FORBIDDEN'),

  badRequest: (res, message = 'طلب غير صالح', details = null) =>
    error(res, 400, message, details, 'BAD_REQUEST'),

  validationError: (res, errors) =>
    error(res, 422, 'خطأ في البيانات المدخلة', errors, 'VALIDATION_ERROR'),

  conflict: (res, message = 'يوجد تعارض في البيانات') =>
    error(res, 409, message, null, 'CONFLICT'),

  serverError: (res, message = 'حدث خطأ في الخادم، يرجى المحاولة لاحقًا') =>
    error(res, 500, message, null, 'SERVER_ERROR'),

  tooManyRequests: (res, message = 'لقد تجاوزت الحد المسموح به من الطلبات، يرجى المحاولة لاحقًا') =>
    error(res, 429, message, null, 'TOO_MANY_REQUESTS'),

  serviceUnavailable: (res, message = 'الخدمة غير متاحة حاليًا، يرجى المحاولة لاحقًا') =>
    error(res, 503, message, null, 'SERVICE_UNAVAILABLE'),
};

/**
 * Send no content response (204)
 * @param {object} res
 */
const noContent = (res) => res.status(204).send();

module.exports = {
  success,
  created,
  paginated,
  error,
  errors,
  noContent,
};
