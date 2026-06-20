'use strict';

const createDOMPurify = require('isomorphic-dompurify');

// DOMPurify is already configured for server-side use with isomorphic-dompurify
const DOMPurify = createDOMPurify;

/**
 * Allowed HTML tags for article content
 */
const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'a', 'img', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'div', 'span', 'section', 'article',
  'sup', 'sub',
  'iframe', // for embedded videos (controlled by allowedAttr)
];

/**
 * Allowed attributes per tag
 */
const ALLOWED_ATTR = [
  'href', 'title', 'target', 'rel',
  'src', 'alt', 'width', 'height', 'loading',
  'class', 'id', 'dir', 'lang',
  'colspan', 'rowspan',
  'data-*',
  // iframe for YouTube/Vimeo embeds only
  'allowfullscreen', 'frameborder', 'allow',
];

/**
 * Sanitize HTML content for safe storage and display
 * @param {string} dirty - Unsanitized HTML
 * @param {object} [options] - Override DOMPurify options
 * @returns {string} - Sanitized HTML
 */
const sanitizeHtml = (dirty, options = {}) => {
  if (!dirty) return '';

  const config = {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: true,
    FORBID_TAGS: ['script', 'style', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onfocus', 'onblur'],
    // Force links to be safe
    ADD_ATTR: ['target'],
    FORCE_BODY: false,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    ...options,
  };

  let clean = DOMPurify.sanitize(dirty, config);

  // Force target="_blank" links to have rel="noopener noreferrer"
  clean = clean.replace(
    /<a([^>]*)\starget="_blank"([^>]*)>/gi,
    (match, before, after) => {
      const hasRel = /rel=/i.test(match);
      if (!hasRel) {
        return `<a${before} target="_blank" rel="noopener noreferrer"${after}>`;
      }
      return match;
    }
  );

  return clean;
};

/**
 * Sanitize plain text (strip all HTML)
 * @param {string} text
 * @returns {string}
 */
const sanitizeText = (text) => {
  if (!text) return '';
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
};

/**
 * Sanitize for excerpt (allow only basic inline formatting)
 * @param {string} html
 * @param {number} [maxLength=300]
 * @returns {string}
 */
const sanitizeExcerpt = (html, maxLength = 300) => {
  if (!html) return '';

  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['strong', 'b', 'em', 'i', 'br'],
    ALLOWED_ATTR: [],
  });

  // Strip remaining tags for plain excerpt
  const text = clean.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  if (text.length <= maxLength) return text;

  // Cut at word boundary
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated) + '...';
};

/**
 * Validate that content doesn't contain malicious patterns
 * @param {string} content
 * @returns {{ valid: boolean, issues: string[] }}
 */
const validateContent = (content) => {
  const issues = [];

  if (!content) return { valid: true, issues };

  // Check for script tags (even obfuscated)
  if (/<\s*script/i.test(content)) {
    issues.push('Script tags are not allowed');
  }

  // Check for javascript: protocol
  if (/javascript\s*:/i.test(content)) {
    issues.push('JavaScript protocol is not allowed');
  }

  // Check for data: URIs in src attributes
  if (/src\s*=\s*['"]?\s*data:/i.test(content)) {
    issues.push('Data URIs in src attributes are not allowed');
  }

  // Check for on* event handlers
  if (/\son\w+\s*=/i.test(content)) {
    issues.push('Event handler attributes are not allowed');
  }

  return { valid: issues.length === 0, issues };
};

module.exports = {
  sanitizeHtml,
  sanitizeText,
  sanitizeExcerpt,
  validateContent,
};
