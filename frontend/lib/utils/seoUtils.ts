import type { Article, Author, Category } from '../types';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://altilgraf.com';
const SITE_NAME = 'التلغراف';
const TWITTER_HANDLE = '@altilgraf';

/**
 * Generate full canonical URL from path.
 */
export function getCanonicalUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${cleanPath}`;
}

/**
 * Generate article URL.
 */
export function getArticleUrl(article: Article): string {
  return `${SITE_URL}/article/${article.category.slug}/${article.slug}`;
}

/**
 * Generate category URL.
 */
export function getCategoryUrl(category: Category): string {
  return `${SITE_URL}/category/${category.slug}`;
}

/**
 * Generate author URL.
 */
export function getAuthorUrl(author: Author): string {
  return `${SITE_URL}/author/${author.authorSlug}`;
}

/**
 * Build JSON-LD NewsArticle schema.
 */
export function buildNewsArticleSchema(article: Article) {
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.seo.description || article.excerpt,
    image: [article.ogImage.url],
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: {
      '@type': 'Person',
      name: article.author.name,
      url: getAuthorUrl(article.author),
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/icons/icon-512.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': getArticleUrl(article),
    },
    articleSection: article.category.name,
    keywords: article.tags.join(', '),
    inLanguage: 'ar',
    isAccessibleForFree: true,
  };
}

/**
 * Build JSON-LD BreadcrumbList schema.
 */
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

/**
 * Build JSON-LD Organization schema.
 */
export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsMediaOrganization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/icons/icon-512.png`,
    sameAs: [
      'https://twitter.com/alwid_news',
      'https://facebook.com/alwidnews',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: 'Arabic',
    },
  };
}

/**
 * Build JSON-LD WebSite schema with SearchAction.
 */
export function buildWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
    inLanguage: 'ar',
  };
}

/**
 * Build JSON-LD Person schema for author.
 */
export function buildAuthorSchema(author: Author) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: author.name,
    url: getAuthorUrl(author),
    image: author.avatar,
    description: author.bio,
    worksFor: {
      '@type': 'Organization',
      name: SITE_NAME,
    },
  };
}

/**
 * Build Open Graph meta tags for an article.
 */
export function buildArticleOGTags(article: Article) {
  return {
    title: article.seo.title || article.title,
    description: article.seo.description || article.excerpt || '',
    url: getArticleUrl(article),
    type: 'article',
    image: article.ogImage.url,
    imageAlt: article.ogImage.alt,
    locale: 'ar_IQ',
    siteName: SITE_NAME,
    publishedTime: article.publishedAt,
    modifiedTime: article.updatedAt,
    author: article.author.name,
    section: article.category.name,
    tags: article.tags,
  };
}

/**
 * Build Twitter card meta tags.
 */
export function buildTwitterCardTags(article: Article) {
  return {
    card: 'summary_large_image',
    site: TWITTER_HANDLE,
    creator: TWITTER_HANDLE,
    title: article.seo.title || article.title,
    description: article.seo.description || article.excerpt || '',
    image: article.ogImage.url,
    imageAlt: article.ogImage.alt,
  };
}

/**
 * Truncate meta description to 160 characters.
 */
export function truncateMetaDescription(text: string, maxLength = 160): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

export { SITE_URL, SITE_NAME, TWITTER_HANDLE };
