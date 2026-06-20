'use strict';

/**
 * Reading time calculator with Arabic language support
 * Average Arabic reading speed: 200 words/minute
 * Average English reading speed: 238 words/minute
 */

const ARABIC_WPM = 200;
const ENGLISH_WPM = 238;
const ARABIC_RANGE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/**
 * Strip HTML tags from content
 * @param {string} html
 * @returns {string}
 */
const stripHtml = (html) => {
  if (!html) return '';
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Count words in text, separating Arabic and Latin words
 * @param {string} text - Plain text
 * @returns {{ arabic: number, english: number, total: number }}
 */
const countWords = (text) => {
  if (!text || !text.trim()) return { arabic: 0, english: 0, total: 0 };

  const words = text.trim().split(/\s+/).filter(Boolean);
  let arabic = 0;
  let english = 0;

  for (const word of words) {
    if (ARABIC_RANGE.test(word)) {
      arabic++;
    } else if (/[a-zA-Z]/.test(word)) {
      english++;
    }
    // Numbers and symbols ignored
  }

  return { arabic, english, total: arabic + english };
};

/**
 * Calculate reading time in minutes from HTML or plain text
 * @param {string} content - HTML or plain text content
 * @param {boolean} [isHtml=true] - Whether content is HTML
 * @returns {number} - Reading time in minutes (minimum 1)
 */
const calculateReadingTime = (content, isHtml = true) => {
  if (!content) return 1;

  const text = isHtml ? stripHtml(content) : content;
  const { arabic, english } = countWords(text);

  if (arabic === 0 && english === 0) return 1;

  const arabicTime = arabic / ARABIC_WPM;
  const englishTime = english / ENGLISH_WPM;
  const totalMinutes = arabicTime + englishTime;

  return Math.max(1, Math.ceil(totalMinutes));
};

/**
 * Format reading time for display in Arabic
 * @param {number} minutes
 * @returns {string}
 */
const formatReadingTimeArabic = (minutes) => {
  if (minutes === 1) return 'دقيقة واحدة';
  if (minutes === 2) return 'دقيقتان';
  if (minutes >= 3 && minutes <= 10) return `${minutes} دقائق`;
  return `${minutes} دقيقة`;
};

/**
 * Get word count summary from article content
 * @param {string} content - HTML content
 * @returns {{ wordCount: number, readingTimeMin: number, characterCount: number }}
 */
const getContentStats = (content) => {
  const text = stripHtml(content || '');
  const { total } = countWords(text);
  const readingTimeMin = calculateReadingTime(content);
  const characterCount = text.length;

  return { wordCount: total, readingTimeMin, characterCount };
};

/**
 * Build a plain-text excerpt from HTML content,
 * trimmed to maxLength on a word boundary.
 */
const sanitizeExcerpt = (html, maxLength = 300) => {
  const text = stripHtml(html || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trim() + '…';
};

module.exports = {
  calculateReadingTime,
  countWords,
  stripHtml,
  formatReadingTimeArabic,
  getContentStats,
  sanitizeExcerpt,
};
