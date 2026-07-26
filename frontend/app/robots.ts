import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/utils/seoUtils';

/**
 * https://al-telegraph.com/robots.txt
 *
 * Points crawlers at the sitemap so Google finds new material even between
 * Search Console submissions. Search result pages are excluded: they are
 * thin, infinite and compete with the real category pages.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/search', '/api/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
