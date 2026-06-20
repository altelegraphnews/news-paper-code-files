'use strict';

/**
 * Arabic-friendly slug generator
 * Keeps Arabic characters, converts spaces to hyphens, lowercases Latin chars
 */

// Arabic Unicode ranges
const ARABIC_RANGE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const ARABIC_RANGE_G = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g;

/**
 * Generate a URL-safe slug from Arabic or mixed text
 * @param {string} text - Input text
 * @returns {string} - URL-safe slug
 */
const generateSlug = (text) => {
  if (!text) return '';

  let slug = text
    .trim()
    // Normalize Unicode
    .normalize('NFC')
    // Remove diacritics (tashkeel) from Arabic text
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Replace Arabic Tatweel (kashida)
    .replace(/\u0640/g, '')
    // Replace common Arabic punctuation with space
    .replace(/[،؛؟!«»\u2018\u2019\u201C\u201D]/g, ' ')
    // Replace standard punctuation with space
    .replace(/[!"#$%&'()*+,./:;<=>?@[\\\]^_`{|}~]/g, ' ')
    // Lowercase Latin characters
    .replace(/[A-Z]/g, (c) => c.toLowerCase())
    // Replace multiple spaces/hyphens with single hyphen
    .replace(/[\s\-]+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '');

  return slug;
};

/**
 * Generate a unique slug by appending a suffix if needed
 * @param {string} text - Input text
 * @param {Function} existsCheck - Async function that returns true if slug exists
 * @param {string} [existingId] - ID of existing document (for updates)
 * @returns {Promise<string>} - Unique slug
 */
const generateUniqueSlug = async (text, existsCheck, existingId = null) => {
  const baseSlug = generateSlug(text);
  if (!baseSlug) return `article-${Date.now()}`;

  // Check if base slug is available
  const baseExists = await existsCheck(baseSlug, existingId);
  if (!baseExists) return baseSlug;

  // Try with timestamp suffix
  const timestampSlug = `${baseSlug}-${Date.now()}`;
  const tsExists = await existsCheck(timestampSlug, existingId);
  if (!tsExists) return timestampSlug;

  // Fallback with random suffix
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  return `${baseSlug}-${randomSuffix}`;
};

/**
 * Check if text contains Arabic characters
 * @param {string} text
 * @returns {boolean}
 */
const isArabic = (text) => ARABIC_RANGE.test(text);

/**
 * Extract Arabic words from text
 * @param {string} text
 * @returns {string[]}
 */
const extractArabicWords = (text) => {
  if (!text) return [];
  const matches = text.match(ARABIC_RANGE_G);
  return matches ? matches.flatMap((m) => m.split(/\s+/)) : [];
};

module.exports = {
  generateSlug,
  generateUniqueSlug,
  isArabic,
  extractArabicWords,
};
