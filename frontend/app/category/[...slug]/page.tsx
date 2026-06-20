import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import ArticleCard from '@/components/article/ArticleCard';
import Pagination from '@/components/ui/Pagination';
import PageHeader from '@/components/layout/PageHeader';
import Reveal from '@/components/ui/Reveal';
import { Article } from '@/lib/types';

import { API_URL } from '@/lib/api';

interface Props {
  params: { slug: string[] };
  searchParams: { page?: string };
}

async function getCategoryData(slug: string, page = 1) {
  try {
    const res = await fetch(`${API_URL}/categories/${slug}?page=${page}&limit=16`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  let data = await getCategoryData(params.slug[params.slug.length - 1]);
  if (!data && params.slug.length > 1) data = await getCategoryData(params.slug[0]);
  if (!data) return { title: 'التصنيف غير موجود | التلغراف' };
  return {
    title: `${data.category.name} | التلغراف`,
    description: data.category.description || `أحدث مواد قسم ${data.category.name} في مجلة التلغراف`,
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const page = parseInt(searchParams.page || '1', 10);
  // Try the most specific slug first, fall back to parent slug
  let slug = params.slug[params.slug.length - 1];
  let data = await getCategoryData(slug, page);
  if (!data && params.slug.length > 1) {
    slug = params.slug[0];
    data = await getCategoryData(slug, page);
  }

  if (!data) notFound();

  const { category, articles, pagination, subcategories } = data;

  return (
    <div className="container mx-auto px-4 max-w-7xl py-8">
      <PageHeader
        kicker="من أبواب التلغراف"
        title={category.name}
        subtitle={category.description}
        crumbs={[{ label: category.name }]}
        meta={
          pagination?.total > 0 ? (
            <span>{pagination.total.toLocaleString('ar-u-nu-arab')} مادة منشورة</span>
          ) : undefined
        }
      />

      {/* Subcategories */}
      {subcategories?.length > 0 && (
        <div className="rise rise-5 flex items-center gap-2 flex-wrap mb-8 -mt-3">
          <Link href={`/category/${slug}`} className="chip-telegraph chip-telegraph--active">
            الكل
          </Link>
          {subcategories.map((sub: { _id: string; name: string; slug: string }) => (
            <Link key={sub._id} href={`/category/${sub.slug}`} className="chip-telegraph">
              {sub.name}
            </Link>
          ))}
        </div>
      )}

      {/* Articles grid */}
      {articles?.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-12">
            {articles.map((article: Article, i: number) => (
              <Reveal key={article._id} delay={(i % 4) * 80}>
                <ArticleCard
                  article={article}
                  variant={i === 0 && page === 1 ? 'featured' : 'standard'}
                  showExcerpt={i === 0 && page === 1}
                />
              </Reveal>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              basePath={`/category/${slug}`}
            />
          )}
        </>
      ) : (
        <div className="flex flex-col items-center text-center py-20 gap-6">
          <span className="postmark" aria-hidden="true">
            <span className="text-lg leading-none">◆</span>
            <span>لا جديد</span>
          </span>
          <p className="text-lg font-body" style={{ color: 'var(--color-text-secondary)' }}>
            لا توجد مواد في هذا الباب حتى الآن
          </p>
          <Link href="/" className="btn-telegraph btn-telegraph--outline">
            العودة للرئيسية
          </Link>
        </div>
      )}
    </div>
  );
}
