import type { Metadata } from 'next';
import Link from 'next/link';
import ArticleCard from '@/components/article/ArticleCard';
import Pagination from '@/components/ui/Pagination';
import PageHeader from '@/components/layout/PageHeader';
import Reveal from '@/components/ui/Reveal';
import { Article } from '@/lib/types';

import { API_URL } from '@/lib/api';

interface Props {
  params: { slug: string };
  searchParams: { page?: string };
}

async function getTagArticles(tag: string, page = 1) {
  try {
    const res = await fetch(
      `${API_URL}/articles?tag=${encodeURIComponent(tag)}&page=${page}&limit=16&status=published`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return { articles: json.data || [], pagination: json.meta?.pagination };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tag = decodeURIComponent(params.slug);
  return {
    title: `${tag} | التلغراف`,
    description: `أحدث المواد المصنفة تحت وسم «${tag}» في مجلة التلغراف`,
  };
}

export default async function TagPage({ params, searchParams }: Props) {
  const tag = decodeURIComponent(params.slug);
  const page = parseInt(searchParams.page || '1', 10);
  const data = await getTagArticles(tag, page);
  const articles: Article[] = data?.articles ?? [];
  const pagination = data?.pagination;

  return (
    <div className="container mx-auto px-4 max-w-5xl py-8">
      <PageHeader
        kicker="وسم"
        title={tag}
        crumbs={[{ label: 'الوسوم' }, { label: tag }]}
        meta={
          (pagination?.total ?? 0) > 0 ? (
            <span>{pagination.total.toLocaleString('ar-u-nu-arab')} مادة موسومة</span>
          ) : undefined
        }
      />

      {articles.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {articles.map((article: Article, i: number) => (
              <Reveal key={article._id} delay={(i % 3) * 90}>
                <ArticleCard article={article} variant="standard" showExcerpt />
              </Reveal>
            ))}
          </div>
          {(pagination?.totalPages ?? 0) > 1 && (
            <Pagination
              currentPage={page}
              totalPages={pagination.totalPages}
              basePath={`/tag/${params.slug}`}
            />
          )}
        </>
      ) : (
        <div className="flex flex-col items-center text-center py-16 gap-6">
          <span className="postmark" aria-hidden="true">
            <span className="text-lg leading-none">#</span>
            <span>وسم فارغ</span>
          </span>
          <p className="text-lg font-body" style={{ color: 'var(--color-text-secondary)' }}>
            لا توجد مواد بهذا الوسم حتى الآن
          </p>
          <Link href="/" className="btn-telegraph btn-telegraph--outline">
            العودة للرئيسية
          </Link>
        </div>
      )}
    </div>
  );
}
