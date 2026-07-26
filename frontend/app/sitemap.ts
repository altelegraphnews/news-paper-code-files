import type { MetadataRoute } from 'next';
import { API_URL } from '@/lib/api';
import { SITE_URL, absoluteUrl, getArticlePath } from '@/lib/utils/seoUtils';

/**
 * https://al-telegraph.com/sitemap.xml — every indexable page on the site.
 *
 * Rebuilt hourly, and immediately whenever the backend revalidates `/` (which
 * it does on any homepage, category or article change), so newly published
 * material shows up for Google without a redeploy.
 *
 * Slugs are Arabic; absoluteUrl() percent-encodes them, which is what the
 * sitemap protocol requires.
 */

export const revalidate = 3600;

type Api<T> = { data?: T };

async function fetchJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate: 3600, tags: ['homepage'] } });
    if (!res.ok) return fallback;
    const json = (await res.json()) as Api<T>;
    return json.data ?? fallback;
  } catch {
    return fallback;
  }
}

interface SitemapArticle {
  slug: string;
  category?: { slug?: string } | null;
  publishedAt?: string;
  updatedAt?: string;
}

/** The list endpoint pages at 100; walk it so nothing is silently left out. */
async function fetchAllArticles(): Promise<SitemapArticle[]> {
  const all: SitemapArticle[] = [];
  for (let page = 1; page <= 50; page++) {
    const batch = await fetchJson<SitemapArticle[]>(`/articles?status=published&limit=100&page=${page}`, []);
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articles, categories, tags, authors] = await Promise.all([
    fetchAllArticles(),
    fetchJson<{ slug: string; updatedAt?: string }[]>('/categories', []),
    fetchJson<string[]>('/tags', []),
    fetchJson<{ slug?: string; _id?: string; latestAt?: string }[]>('/users/authors', []),
  ]);

  const newest = articles.reduce<string | undefined>((latest, a) => {
    const stamp = a.updatedAt || a.publishedAt;
    return stamp && (!latest || stamp > latest) ? stamp : latest;
  }, undefined);
  const lastHomeUpdate = newest ? new Date(newest) : new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: lastHomeUpdate, changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/about'), changeFrequency: 'yearly', priority: 0.5 },
    { url: absoluteUrl('/editorial-board'), changeFrequency: 'monthly', priority: 0.5 },
    { url: absoluteUrl('/author'), changeFrequency: 'weekly', priority: 0.6 },
    { url: absoluteUrl('/contact'), changeFrequency: 'yearly', priority: 0.5 },
    { url: absoluteUrl('/live'), changeFrequency: 'weekly', priority: 0.4 },
  ];

  // Articles carry the most search weight, and a real lastModified is what
  // tells Google an old piece is worth recrawling.
  const articlePages: MetadataRoute.Sitemap = articles
    .filter((a) => a.slug)
    .map((a) => ({
      url: absoluteUrl(getArticlePath(a)),
      lastModified: new Date(a.updatedAt || a.publishedAt || Date.now()),
      changeFrequency: 'monthly' as const,
      priority: 0.9,
    }));

  const categoryPages: MetadataRoute.Sitemap = categories
    .filter((c) => c.slug)
    .map((c) => ({
      url: absoluteUrl(`/category/${c.slug}`),
      lastModified: lastHomeUpdate,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }));

  const authorPages: MetadataRoute.Sitemap = authors
    .filter((a) => a.slug || a._id)
    .map((a) => ({
      url: absoluteUrl(`/author/${a.slug || a._id}`),
      lastModified: a.latestAt ? new Date(a.latestAt) : lastHomeUpdate,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));

  const tagPages: MetadataRoute.Sitemap = tags
    .filter(Boolean)
    .map((tag) => ({
      url: absoluteUrl(`/tag/${tag}`),
      lastModified: lastHomeUpdate,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    }));

  return [...staticPages, ...articlePages, ...categoryPages, ...authorPages, ...tagPages];
}
