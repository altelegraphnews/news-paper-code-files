import type { Article, Author, Category } from '../types';

/**
 * One place for everything search engines read about the site.
 *
 * Two things here are load-bearing and easy to break:
 *  - SITE_URL must be the live domain. It ends up in every canonical, every
 *    og:url and every JSON-LD @id; pointing it anywhere else tells Google the
 *    real pages are duplicates of somewhere we don't own.
 *  - Only ONE page may claim a given canonical. The root layout deliberately
 *    does not set `alternates.canonical`, because a site-wide canonical is
 *    inherited by every page that doesn't override it — which is how the
 *    category, tag and author pages all ended up declaring themselves copies
 *    of the homepage, and therefore unindexable.
 */

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://al-telegraph.com').replace(/\/$/, '');

/** Arabic is the brand; the Latin forms exist so English queries also land. */
export const SITE_NAME = 'التلغراف';
export const SITE_NAME_EN = 'Al-Telegraph';
export const SITE_ALT_NAMES = [
  'Al-Telegraph',
  'Al Telegraph',
  'AlTelegraph',
  'Al-Telegraph Magazine',
  'مجلة التلغراف',
  'التلغراف الثقافية',
];

export const TWITTER_HANDLE = '@altilgraf';

export const SITE_DESCRIPTION =
  'التلغراف — مجلة ثقافية وأدبية تُعنى بالشعر والسرد والقراءات النقدية والفكر والحوار والترجمة';

export const SITE_DESCRIPTION_EN =
  'Al-Telegraph is an Arabic literary and cultural magazine publishing poetry, fiction, criticism, essays, interviews and translation.';

/** Arabic terms first — that is where the traffic is — then the English hooks. */
export const SITE_KEYWORDS = [
  'التلغراف',
  'مجلة التلغراف',
  'مجلة أدبية',
  'مجلة ثقافية',
  'أدب عربي',
  'شعر',
  'شعر عربي',
  'سرد',
  'قصة قصيرة',
  'رواية',
  'نقد أدبي',
  'قراءات نقدية',
  'فكر',
  'حوار',
  'ترجمة أدبية',
  'أدب عراقي',
  'Al-Telegraph',
  'Al Telegraph magazine',
  'Arabic literary magazine',
  'Arabic literature',
  'Arabic poetry',
  'Arabic fiction',
  'literary criticism',
];

/* ─── URL builders ─────────────────────────────────────────────────────────
   Slugs are Arabic, so every path has to be percent-encoded before it goes
   into a canonical, a sitemap or a JSON-LD @id. encodeURI leaves an already
   encoded slug alone, so these are safe to call on either form.            */

export function absoluteUrl(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  // Route params arrive already percent-encoded while API values arrive as raw
  // Arabic. Decode first so both end up encoded exactly once — encoding an
  // encoded slug turns every «%D8» into «%25D8» and the canonical points at a
  // URL that does not exist.
  let decoded = clean;
  try {
    decoded = decodeURI(clean);
  } catch {
    // Malformed escape sequence — encode what we were given rather than throw.
  }
  return encodeURI(`${SITE_URL}${decoded}`);
}

export const getCanonicalUrl = absoluteUrl;

type ArticleLike = { slug: string; category?: { slug?: string } | null };

export function getArticlePath(article: ArticleLike): string {
  return `/article/${article.category?.slug || 'uncategorized'}/${article.slug}`;
}

export function getArticleUrl(article: ArticleLike): string {
  return absoluteUrl(getArticlePath(article));
}

export function getCategoryUrl(category: Pick<Category, 'slug'>): string {
  return absoluteUrl(`/category/${category.slug}`);
}

export function getAuthorUrl(author: { slug?: string; _id?: string }): string {
  return absoluteUrl(`/author/${author.slug || author._id}`);
}

export function getTagUrl(tag: string): string {
  return absoluteUrl(`/tag/${tag}`);
}

/**
 * Social preview image, cropped to the 1.91:1 card Facebook, X and LinkedIn
 * expect.
 *
 * The dimensions we advertise have to be the dimensions we actually serve.
 * Article covers are whatever size they were uploaded — one live example is
 * 549×364 — so declaring a flat 1200×630 told Facebook to wait for an image
 * that never arrived, and its share dialog sat spinning. Cloudinary crops to
 * the real thing; non-Cloudinary sources return unchanged and the caller then
 * declares no dimensions rather than guessing.
 */
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

export function ogImageSrc(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  return url.replace(
    '/upload/',
    `/upload/f_auto,q_auto,c_fill,g_auto,w_${OG_IMAGE_WIDTH},h_${OG_IMAGE_HEIGHT}/`
  );
}

/** True only when we control the crop and therefore know the size. */
export function isCloudinary(url?: string | null): boolean {
  return Boolean(url && url.includes('res.cloudinary.com') && url.includes('/upload/'));
}

/**
 * Google renders roughly 155–160 characters of a description. Category blurbs
 * are written in markdown, so the markers are stripped too — otherwise the
 * search result reads «**الشعر** بابٌ للقصيدة…».
 */
export function metaDescription(text?: string | null, maxLength = 160): string {
  const plain = (text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // [label](url) → label
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // bold
    .replace(/(\*|_)(?=\S)(.*?)(?<=\S)\1/g, '$2') // italic
    .replace(/`{1,3}([^`]*)`{1,3}/g, '$1') // code
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // headings
    .replace(/^\s{0,3}>\s?/gm, '') // quotes
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= maxLength) return plain;
  const cut = plain.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

/* ─── JSON-LD ──────────────────────────────────────────────────────────── */

const PUBLISHER = {
  '@type': 'Organization',
  name: SITE_NAME,
  alternateName: SITE_NAME_EN,
  logo: {
    '@type': 'ImageObject',
    url: `${SITE_URL}/icons/icon-512.png`,
    width: 512,
    height: 512,
  },
};

export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsMediaOrganization',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    alternateName: SITE_ALT_NAMES,
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_URL}/icons/icon-512.png`,
      width: 512,
      height: 512,
    },
    image: `${SITE_URL}/og-default.jpg`,
    description: SITE_DESCRIPTION,
    knowsLanguage: ['ar', 'en'],
    email: 'submit@al-telegraph.com',
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'editorial',
      email: 'submit@al-telegraph.com',
      availableLanguage: ['Arabic', 'English'],
    },
  };
}

export function buildWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: SITE_NAME,
    alternateName: SITE_ALT_NAMES,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: 'ar',
    publisher: { '@id': `${SITE_URL}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function buildBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function buildArticleSchema(article: Article, url: string) {
  const keywords = article.seo?.keywords?.length ? article.seo.keywords : article.tags;
  const plainContent = article.content ? article.content.replace(/<[^>]+>/g, ' ') : '';
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: metaDescription(article.title, 110),
    description: metaDescription(article.seo?.description || article.excerpt, 300),
    image: article.ogImage?.url ? [article.ogImage.url] : undefined,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt || article.publishedAt,
    author: article.author?.name
      ? {
          '@type': 'Person',
          name: article.author.name,
          url: article.author?.slug ? getAuthorUrl(article.author) : undefined,
        }
      : undefined,
    publisher: PUBLISHER,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    articleSection: article.category?.name,
    keywords: keywords?.length ? keywords.join('، ') : undefined,
    wordCount: plainContent ? plainContent.split(/\s+/).filter(Boolean).length : undefined,
    timeRequired: article.readingTimeMin ? `PT${article.readingTimeMin}M` : undefined,
    inLanguage: 'ar',
    isAccessibleForFree: true,
  };
}

type AuthorLike = Pick<Author, 'name'> &
  Partial<Pick<Author, 'slug' | '_id' | 'bio'>> & {
    avatar?: string | { url?: string };
    jobTitle?: string;
  };

export function buildPersonSchema(author: AuthorLike) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: author.name,
    url: getAuthorUrl(author),
    image: typeof author.avatar === 'string' ? author.avatar : author.avatar?.url,
    description: metaDescription(author.bio, 300) || undefined,
    jobTitle: author.jobTitle || undefined,
    worksFor: { '@id': `${SITE_URL}/#organization` },
  };
}

export function buildCollectionSchema(opts: {
  name: string;
  description: string;
  url: string;
  items: { name: string; url: string }[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: opts.name,
    description: opts.description,
    url: opts.url,
    inLanguage: 'ar',
    isPartOf: { '@id': `${SITE_URL}/#website` },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: opts.items.length,
      itemListElement: opts.items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        url: item.url,
      })),
    },
  };
}

/** `<script type="application/ld+json">` payload, XSS-safe. */
export function jsonLdScript(schema: unknown) {
  return { __html: JSON.stringify(schema).replace(/</g, '\\u003c') };
}
