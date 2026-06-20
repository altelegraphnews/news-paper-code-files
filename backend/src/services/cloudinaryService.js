'use strict';

const cloudinary = require('cloudinary').v2;
const config = require('../config/env');
const logger = require('../utils/logger');

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

// Cloudinary is optional in local/dev — without credentials we degrade gracefully
// (empty media library) instead of throwing 500s, mirroring Redis/ES fallbacks.
const isConfigured = Boolean(
  config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret
);

if (!isConfigured) {
  logger.warn('Cloudinary not configured — media library will be empty until credentials are set');
}

/**
 * Generate signed upload params for client-side upload
 */
const getSignedUploadParams = (folder = 'alwid') => {
  if (!isConfigured) {
    const err = new Error('خدمة الوسائط (Cloudinary) غير مُهيأة على الخادم');
    err.statusCode = 503;
    throw err;
  }
  const timestamp = Math.round(Date.now() / 1000);
  const params = { timestamp, folder, upload_preset: config.cloudinary.uploadPreset };
  const signature = cloudinary.utils.api_sign_request(params, config.cloudinary.apiSecret);

  return {
    signature,
    timestamp,
    folder,
    apiKey: config.cloudinary.apiKey,
    cloudName: config.cloudinary.cloudName,
    uploadPreset: config.cloudinary.uploadPreset,
  };
};

/**
 * Delete media asset by public ID
 */
const deleteAsset = async (publicId) => {
  if (!isConfigured) {
    const err = new Error('خدمة الوسائط (Cloudinary) غير مُهيأة على الخادم');
    err.statusCode = 503;
    throw err;
  }
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (err) {
    logger.error('Cloudinary delete error:', err.message);
    throw err;
  }
};

/**
 * List assets in a folder
 */
const listAssets = async ({ folder = 'alwid', maxResults = 50, nextCursor }) => {
  if (!isConfigured) return { resources: [], total_count: 0 };
  try {
    const options = { type: 'upload', prefix: folder, max_results: maxResults };
    if (nextCursor) options.next_cursor = nextCursor;

    const result = await cloudinary.api.resources(options);
    return result;
  } catch (err) {
    logger.error('Cloudinary list error:', err.message);
    throw err;
  }
};

/**
 * Get asset details
 */
const getAsset = async (publicId) => {
  try {
    return await cloudinary.api.resource(publicId);
  } catch (err) {
    logger.error('Cloudinary get asset error:', err.message);
    throw err;
  }
};

module.exports = { getSignedUploadParams, deleteAsset, listAssets, getAsset };
