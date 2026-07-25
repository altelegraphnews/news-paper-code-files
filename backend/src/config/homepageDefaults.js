'use strict';

/**
 * Homepage layout/text settings (stored in siteconfigs under key
 * `homepage:settings`). Defaults mirror the original hardcoded homepage, so
 * nothing changes on screen until an editor customizes it.
 *
 * sections[] drives which top-level blocks render and in what order.
 */
const DEFAULT_HOMEPAGE_SETTINGS = {
  sections: [
    { key: 'heroFeatured', enabled: true },
    { key: 'latest', enabled: true },
    { key: 'categoryRows', enabled: true },
    { key: 'opinion', enabled: true },
    { key: 'newsletter', enabled: true },
  ],
  titles: {
    featured: 'مختارات',
    latest: 'آخر المنشورات',
    mostRead: 'الأكثر قراءة',
    opinion: 'رأي وتحليل',
  },
  mostReadEnabled: true,
  newsletter: {
    kicker: 'برقية أسبوعية',
    heading: 'اشترك في النشرة البريدية',
    body: 'مختارات من الشعر والسرد والفكر، تصلك كل أسبوع كما تصل البرقيات: قصيرةً ومضيئة.',
  },
  // Which categories become homepage rows, ordered. Empty = automatic (first
  // nav categories).
  categoryRowIds: [],
  masthead: {
    enabled: true,
    imageUrl: '', // empty = the default /masthead.jpg baked into the site
  },
};

const SECTION_KEYS = ['heroFeatured', 'latest', 'categoryRows', 'opinion', 'newsletter'];

// Merge saved settings over the defaults, keeping unknown/missing fields sane.
const mergeHomepageSettings = (saved) => {
  const s = saved && typeof saved === 'object' ? saved : {};
  // Keep only known section keys; append any default sections the save omitted
  let sections = Array.isArray(s.sections)
    ? s.sections.filter((x) => x && SECTION_KEYS.includes(x.key)).map((x) => ({ key: x.key, enabled: x.enabled !== false }))
    : [];
  for (const key of SECTION_KEYS) {
    if (!sections.find((x) => x.key === key)) sections.push({ key, enabled: true });
  }
  return {
    sections,
    titles: { ...DEFAULT_HOMEPAGE_SETTINGS.titles, ...(s.titles || {}) },
    mostReadEnabled: s.mostReadEnabled !== false,
    newsletter: { ...DEFAULT_HOMEPAGE_SETTINGS.newsletter, ...(s.newsletter || {}) },
    categoryRowIds: Array.isArray(s.categoryRowIds) ? s.categoryRowIds.map(String) : [],
    masthead: { ...DEFAULT_HOMEPAGE_SETTINGS.masthead, ...(s.masthead || {}) },
  };
};

module.exports = { DEFAULT_HOMEPAGE_SETTINGS, SECTION_KEYS, mergeHomepageSettings };
