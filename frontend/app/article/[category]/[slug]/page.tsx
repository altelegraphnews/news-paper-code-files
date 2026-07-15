import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import ArticleBody from '@/components/article/ArticleBody';
import AuthorCard from '@/components/article/AuthorCard';
import ShareButtons from '@/components/article/ShareButtons';
import RelatedArticles from '@/components/article/RelatedArticles';
import Badge from '@/components/ui/Badge';
import ReadingProgress from '@/components/ui/ReadingProgress';
import ViewTracker from '@/components/article/ViewTracker';
import { Article } from '@/lib/types';
import { formatArabicDateTime } from '@/lib/utils/dateUtils';
import { avatarUrl } from '@/lib/utils/avatar';

import { API_URL } from '@/lib/api';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://altilgraf.com';

// ISR: cache each rendered article for 5 minutes so navigating to it (or back to
// it) is served from cache instead of re-rendering + re-querying the backend.
export const revalidate = 300;

interface Props {
  params: { category: string; slug: string };
}

async function getArticle(slug: string): Promise<Article | null> {
  try {
    const res = await fetch(`${API_URL}/articles/${slug}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data;
  } catch {
    return null;
  }
}

async function getRecommendations(articleId: string): Promise<Article[]> {
  try {
    const res = await fetch(`${API_URL}/search/recommendations?articleId=${articleId}&limit=6`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await getArticle(params.slug);
  if (!article) return { title: 'المقال غير موجود | التلغراف' };

  const url = `${SITE_URL}/article/${params.category}/${params.slug}`;

  return {
    title: article.seo?.title || article.title,
    description: article.seo?.description || article.excerpt,
    keywords: article.seo?.keywords || article.tags,
    authors: [{ name: article.author?.name }],
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title: article.seo?.title || article.title,
      description: article.seo?.description || article.excerpt,
      images: article.ogImage?.url ? [{ url: article.ogImage.url, alt: article.ogImage.alt }] : [],
      locale: 'ar_IQ',
      siteName: 'التلغراف',
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      authors: [article.author?.name || ''],
      section: article.category?.name,
      tags: article.tags,
    },
    twitter: {
      card: 'summary_large_image',
      site: '@altilgraf',
      title: article.seo?.title || article.title,
      description: article.seo?.description || article.excerpt,
      images: article.ogImage?.url ? [article.ogImage.url] : [],
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const article = await getArticle(params.slug);
  if (!article) notFound();

  const articleUrl = `${SITE_URL}/article/${params.category}/${params.slug}`;

  // JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.excerpt,
    image: article.ogImage?.url,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt || article.publishedAt,
    author: {
      '@type': 'Person',
      name: article.author?.name,
      url: article.author?.authorSlug ? `${SITE_URL}/author/${article.author.authorSlug}` : undefined,
    },
    publisher: {
      '@type': 'Organization',
      name: 'التلغراف',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': articleUrl },
    articleSection: article.category?.name,
    keywords: article.tags?.join(', '),
    inLanguage: 'ar',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <ReadingProgress />
      <ViewTracker articleId={article._id} />

      <article className="max-w-4xl mx-auto px-4 py-10">
        {/* Breadcrumb */}
        <nav className="rise rise-1 flex items-center justify-center gap-2 text-xs font-arabic text-gray-500 dark:text-gray-400 mb-8 flex-wrap">
          <Link href="/" className="hover:text-accent transition-colors">الرئيسية</Link>
          <span className="text-accent" aria-hidden="true">◆</span>
          {article.category && (
            <>
              <Link href={`/category/${article.category.slug}`} className="hover:text-accent transition-colors">
                {article.category.name}
              </Link>
              <span className="text-accent" aria-hidden="true">◆</span>
            </>
          )}
          <span className="text-gray-700 dark:text-gray-300 line-clamp-1 max-w-[18rem]">{article.title}</span>
        </nav>

        {/* Breaking / Sponsored badges */}
        <div className="rise rise-1 flex items-center justify-center gap-2 mb-5 flex-wrap">
          {article.isBreaking && (
            <span className="flex items-center gap-1.5 bg-breaking text-white text-sm px-3 py-1 rounded-sm font-arabic font-bold">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              عاجل
            </span>
          )}
          {article.isSponsored && (
            <Badge variant="muted" size="sm">محتوى مدفوع</Badge>
          )}
          {article.category && (
            <Badge variant="accent" size="sm">
              <Link href={`/category/${article.category.slug}`}>{article.category.name}</Link>
            </Badge>
          )}
        </div>

        {/* Title — centered editorial headline */}
        <h1 className="rise rise-2 font-heading font-bold text-3xl md:text-5xl text-center text-gray-900 dark:text-gray-100 leading-[1.6] md:leading-[1.5] mb-5">
          {article.title}
        </h1>

        {/* Subtitle */}
        {article.subtitle && (
          <p className="rise rise-3 text-xl font-body text-center text-gray-600 dark:text-gray-400 font-normal leading-loose mb-6 max-w-2xl mx-auto">
            {article.subtitle}
          </p>
        )}

        {/* Morse divider under the headline */}
        <div className="rise rise-3 flex justify-center mb-8" aria-hidden="true">
          <span className="morse-line w-44" />
        </div>

        {/* Author + Meta */}
        <div className="rise rise-4 flex items-center justify-between flex-wrap gap-4 mb-6 pb-6 border-b border-[color:var(--color-border)]">
          {article.author && (
            <AuthorCard
              author={article.author}
              publishedAt={article.publishedAt}
              readingTimeMin={article.readingTimeMin}
            />
          )}
          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            {article.views?.total > 0 && (
              <span>{article.views.total.toLocaleString('ar')} مشاهدة</span>
            )}
            {article.commentsCount > 0 && (
              <span>{article.commentsCount} تعليق</span>
            )}
          </div>
        </div>

        {/* Hero image */}
        {article.ogImage?.url && (
          <figure className="rise rise-5 mb-8 -mx-4 md:mx-0">
            <div className="relative aspect-[16/9] md:rounded-sm overflow-hidden frame-gold shadow-card" style={{ background: 'var(--color-surface-2)' }}>
              <Image
                src={article.ogImage.url}
                alt={article.ogImage.alt || article.title}
                fill
                className="object-contain"
                priority
                sizes="(max-width: 896px) 100vw, 896px"
              />
            </div>
            {(article.ogImage.caption || article.ogImage.credit) && (
              <figcaption className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center px-4">
                {article.ogImage.caption}
                {article.ogImage.credit && (
                  <span className="mr-1 opacity-70">· تصوير: {article.ogImage.credit}</span>
                )}
              </figcaption>
            )}
          </figure>
        )}

        {/* Share buttons (top) */}
        <ShareButtons title={article.title} url={articleUrl} className="mb-6" />

        {/* Article content */}
        {article.content && (
          <ArticleBody content={article.content} className="mb-4" />
        )}

        {/* End-of-article ornament */}
        <div className="article-end-mark" aria-hidden="true">
          <span>◆</span>
          <span>◆</span>
          <span>◆</span>
        </div>

        {/* Tags */}
        {article.tags?.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mb-8 pt-6 border-t border-[color:var(--color-border)]">
            <span className="text-sm font-arabic text-gray-600 dark:text-gray-400 font-medium">الوسوم:</span>
            {article.tags.map((tag) => (
              <Link
                key={tag}
                href={`/tag/${encodeURIComponent(tag)}`}
                className="px-3 py-1 border border-[color:var(--color-border)] text-gray-700 dark:text-gray-300 text-sm font-arabic rounded-sm hover:border-accent hover:bg-accent hover:text-ink transition-all duration-300"
              >
                {tag}
              </Link>
            ))}
          </div>
        )}

        {/* Share buttons (bottom) */}
        <ShareButtons title={article.title} url={articleUrl} className="mb-8 pb-8 border-b border-gray-100 dark:border-gray-800" />

        {/* Author bio */}
        {article.author?.bio && (
          <div className="relative rounded-sm border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 pt-8 mb-8">
            <span className="absolute -top-px right-6 morse-line w-20" aria-hidden="true" />
            <div className="flex items-start gap-4">
              {avatarUrl(article.author.avatar) ? (
                <div className="relative w-16 h-16 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-accent/40">
                  <Image src={avatarUrl(article.author.avatar)!} alt={article.author.name} fill className="object-cover" sizes="64px" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-accent/15 ring-1 ring-accent/40 flex items-center justify-center flex-shrink-0">
                  <span className="text-accent-700 dark:text-accent-300 font-heading font-bold text-2xl">{article.author.name?.charAt(0)}</span>
                </div>
              )}
              <div>
                <Link
                  href={`/author/${article.author.authorSlug || article.author._id}`}
                  className="font-heading font-bold text-lg text-gray-900 dark:text-gray-100 hover:text-accent transition-colors block mb-1"
                >
                  {article.author.name}
                </Link>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{article.author.bio}</p>
              </div>
            </div>
          </div>
        )}

        {/* Updated date */}
        {article.updatedAt && article.updatedAt !== article.publishedAt && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-8">
            آخر تحديث: {formatArabicDateTime(article.updatedAt)}
          </p>
        )}
      </article>

      {/* Related articles — streamed after the article so it never blocks the
          main render on the (slower) recommendations query. */}
      <Suspense fallback={null}>
        <RelatedArticlesSection articleId={article._id} />
      </Suspense>
    </>
  );
}

async function RelatedArticlesSection({ articleId }: { articleId: string }) {
  const recommendations = await getRecommendations(articleId);
  if (!recommendations.length) return null;
  return (
    <div className="max-w-7xl mx-auto px-4">
      <RelatedArticles articles={recommendations} />
    </div>
  );
}
