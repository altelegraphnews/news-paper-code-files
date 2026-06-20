'use strict';

/**
 * Arabic language utilities for AL-WID news platform
 */

// Arabic-Indic numerals mapping
const ARABIC_INDIC_MAP = {
  '0': '٠', '1': '١', '2': '٢', '3': '٣', '4': '٤',
  '5': '٥', '6': '٦', '7': '٧', '8': '٨', '9': '٩',
};

const EASTERN_ARABIC_MAP = Object.fromEntries(
  Object.entries(ARABIC_INDIC_MAP).map(([k, v]) => [v, k])
);

// Arabic month names (Gregorian)
const GREGORIAN_MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

// Hijri month names
const HIJRI_MONTHS = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الثاني',
  'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
  'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة',
];

// Arabic day names
const ARABIC_DAYS = [
  'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت',
];

/**
 * Convert Western Arabic numerals to Eastern Arabic (Arabic-Indic) numerals
 * @param {string|number} value
 * @returns {string}
 */
const toArabicNumerals = (value) => {
  return String(value).replace(/[0-9]/g, (d) => ARABIC_INDIC_MAP[d] || d);
};

/**
 * Convert Eastern Arabic numerals to Western Arabic numerals
 * @param {string} value
 * @returns {string}
 */
const toWesternNumerals = (value) => {
  return String(value).replace(/[٠-٩]/g, (d) => EASTERN_ARABIC_MAP[d] || d);
};

/**
 * Format a date in Arabic locale
 * @param {Date|string} date - Date to format
 * @param {object} [options] - Formatting options
 * @param {boolean} [options.includeTime=false] - Include time in output
 * @param {boolean} [options.includeDay=false] - Include day name
 * @param {boolean} [options.arabicNumerals=true] - Use Arabic-Indic numerals
 * @param {boolean} [options.relative=false] - Use relative time (e.g., "منذ 3 ساعات")
 * @returns {string}
 */
const formatArabicDate = (date, options = {}) => {
  const {
    includeTime = false,
    includeDay = false,
    arabicNumerals = true,
    relative = false,
  } = options;

  const d = date instanceof Date ? date : new Date(date);

  if (isNaN(d.getTime())) return '';

  if (relative) {
    return getRelativeTime(d, arabicNumerals);
  }

  const day = d.getDate();
  const month = GREGORIAN_MONTHS_AR[d.getMonth()];
  const year = d.getFullYear();

  let formatted = `${day} ${month} ${year}`;

  if (includeDay) {
    const dayName = ARABIC_DAYS[d.getDay()];
    formatted = `${dayName}، ${formatted}`;
  }

  if (includeTime) {
    const hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const period = hours >= 12 ? 'م' : 'ص';
    const hour12 = hours % 12 || 12;
    formatted += ` - ${hour12}:${minutes} ${period}`;
  }

  return arabicNumerals ? toArabicNumerals(formatted) : formatted;
};

/**
 * Calculate relative time in Arabic
 * @param {Date} date
 * @param {boolean} [arabicNumerals=true]
 * @returns {string}
 */
const getRelativeTime = (date, arabicNumerals = true) => {
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  let result;

  if (diffSec < 60) {
    result = 'منذ لحظات';
  } else if (diffMin < 60) {
    if (diffMin === 1) result = 'منذ دقيقة';
    else if (diffMin === 2) result = 'منذ دقيقتين';
    else if (diffMin <= 10) result = `منذ ${diffMin} دقائق`;
    else result = `منذ ${diffMin} دقيقة`;
  } else if (diffHour < 24) {
    if (diffHour === 1) result = 'منذ ساعة';
    else if (diffHour === 2) result = 'منذ ساعتين';
    else if (diffHour <= 10) result = `منذ ${diffHour} ساعات`;
    else result = `منذ ${diffHour} ساعة`;
  } else if (diffDay < 7) {
    if (diffDay === 1) result = 'منذ يوم';
    else if (diffDay === 2) result = 'منذ يومين';
    else if (diffDay <= 10) result = `منذ ${diffDay} أيام`;
    else result = `منذ ${diffDay} يومًا`;
  } else if (diffWeek < 4) {
    if (diffWeek === 1) result = 'منذ أسبوع';
    else if (diffWeek === 2) result = 'منذ أسبوعين';
    else result = `منذ ${diffWeek} أسابيع`;
  } else if (diffMonth < 12) {
    if (diffMonth === 1) result = 'منذ شهر';
    else if (diffMonth === 2) result = 'منذ شهرين';
    else if (diffMonth <= 10) result = `منذ ${diffMonth} أشهر`;
    else result = `منذ ${diffMonth} شهرًا`;
  } else {
    if (diffYear === 1) result = 'منذ عام';
    else if (diffYear === 2) result = 'منذ عامين';
    else result = `منذ ${diffYear} أعوام`;
  }

  return arabicNumerals ? toArabicNumerals(result) : result;
};

/**
 * Calculate approximate Hijri date from Gregorian date
 * Uses the algorithmic conversion (accurate within 1-2 days)
 * @param {Date|string} date
 * @returns {{ day: number, month: number, monthName: string, year: number, formatted: string }}
 */
const calculateHijriDate = (date) => {
  const d = date instanceof Date ? date : new Date(date);

  if (isNaN(d.getTime())) return null;

  // Algorithm based on the Kuwaiti algorithm for Hijri conversion
  const jd = Math.floor((14 + 153 * (d.getMonth() + 1) + 2) / 5) +
    365 * d.getFullYear() +
    Math.floor(d.getFullYear() / 4) -
    Math.floor(d.getFullYear() / 100) +
    Math.floor(d.getFullYear() / 400) -
    32045 +
    d.getDate();

  // Julian to Hijri
  const l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  const l2 = l - 10631 * n + 354;
  const j = Math.floor((10985 - l2) / 5316) * Math.floor(50 * l2 / 17719) +
    Math.floor(l2 / 5670) * Math.floor(43 * l2 / 15238);
  const l3 = l2 - Math.floor((30 - j) / 15) * Math.floor(17719 * j / 50) -
    Math.floor(j / 16) * Math.floor(15238 * j / 43) + 29;
  const month = Math.floor(24 * l3 / 709);
  const day = l3 - Math.floor(709 * month / 24);
  const year = 30 * n + j - 30;

  const monthName = HIJRI_MONTHS[month - 1] || '';
  const formatted = `${day} ${monthName} ${year} هـ`;

  return { day, month, monthName, year, formatted };
};

/**
 * Format number with Arabic thousands separator
 * @param {number} num
 * @param {boolean} [arabicNumerals=false]
 * @returns {string}
 */
const formatArabicNumber = (num, arabicNumerals = false) => {
  const formatted = new Intl.NumberFormat('ar-EG').format(num);
  return arabicNumerals ? formatted : toWesternNumerals(formatted);
};

/**
 * Normalize Arabic text for comparison (remove diacritics, normalize alef variants)
 * @param {string} text
 * @returns {string}
 */
const normalizeArabic = (text) => {
  if (!text) return '';
  return text
    .replace(/[\u064B-\u065F\u0670]/g, '') // Remove diacritics
    .replace(/\u0640/g, '') // Remove tatweel
    .replace(/[أإآ]/g, 'ا') // Normalize alef variants
    .replace(/[ىئ]/g, 'ي') // Normalize ya
    .replace(/ة/g, 'ه') // Normalize ta marbuta
    .trim();
};

/**
 * Truncate Arabic text at word boundary
 * @param {string} text
 * @param {number} maxLength
 * @param {string} [suffix='...']
 * @returns {string}
 */
const truncateArabic = (text, maxLength, suffix = '...') => {
  if (!text || text.length <= maxLength) return text || '';

  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  const cut = lastSpace > maxLength * 0.7 ? truncated.substring(0, lastSpace) : truncated;

  return cut + suffix;
};

module.exports = {
  toArabicNumerals,
  toWesternNumerals,
  formatArabicDate,
  getRelativeTime,
  calculateHijriDate,
  formatArabicNumber,
  normalizeArabic,
  truncateArabic,
  GREGORIAN_MONTHS_AR,
  HIJRI_MONTHS,
  ARABIC_DAYS,
};
