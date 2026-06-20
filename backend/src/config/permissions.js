'use strict';

/**
 * Granular permission system.
 * Effective permissions = role defaults merged with per-user overrides
 * set by the admin (overrides can grant or revoke individual keys).
 * super_admin is immune to overrides and always has everything.
 */

const PERMISSION_KEYS = [
  // Articles
  'articles.create',   // create own articles (drafts / submit for review)
  'articles.editOwn',  // edit own non-published articles
  'articles.editAll',  // edit anyone's articles
  'articles.publish',  // publish / unpublish / archive / approve / reject / schedule
  'articles.delete',   // delete articles
  'articles.feature',  // toggle featured / breaking / sponsored
  // Moderation & taxonomy
  'comments.moderate',
  'categories.manage',
  // Media
  'media.upload',      // upload images (needed by writers for covers)
  'media.manage',      // browse/delete media library
  // Site control
  'tickers.manage',
  'homepage.manage',
  'notifications.send',
  // Administration
  'users.manage',
  'analytics.view',
  'settings.manage',
];

const ROLE_DEFAULTS = {
  reader: [],
  author: [
    'articles.create',
    'articles.editOwn',
    'media.upload',
  ],
  editor: [
    'articles.create',
    'articles.editOwn',
    'articles.editAll',
    'articles.publish',
    'articles.feature',
    'comments.moderate',
    'media.upload',
    'media.manage',
    'homepage.manage',
    'tickers.manage',
    'analytics.view',
  ],
  admin: PERMISSION_KEYS.slice(),
  super_admin: PERMISSION_KEYS.slice(),
};

/**
 * Compute effective permissions for a user.
 * @param {string} role
 * @param {Object|Map} overrides - { 'articles.publish': true, ... }
 * @returns {Object} map of every permission key to boolean
 */
function effectivePermissions(role, overrides) {
  const defaults = new Set(ROLE_DEFAULTS[role] || []);
  const result = {};
  for (const key of PERMISSION_KEYS) {
    result[key] = defaults.has(key);
  }

  if (role === 'super_admin') return result;

  if (overrides) {
    const entries = overrides instanceof Map
      ? overrides.entries()
      : Object.entries(overrides);
    for (const [key, value] of entries) {
      if (PERMISSION_KEYS.includes(key) && typeof value === 'boolean') {
        result[key] = value;
      }
    }
  }

  return result;
}

function hasPermission(user, key) {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  const perms = effectivePermissions(user.role, user.permissionOverrides);
  return perms[key] === true;
}

module.exports = { PERMISSION_KEYS, ROLE_DEFAULTS, effectivePermissions, hasPermission };
