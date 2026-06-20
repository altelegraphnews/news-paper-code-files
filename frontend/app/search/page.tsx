import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import ArticleCard from '@/components/article/ArticleCard';
import Pagination from '@/components/ui/Pagination';
import PageHeader from '@/components/layout/PageHeader';
import Reveal from '@/components/ui/Reveal';
import { Article } from '@/lib/types';

import { API_URL } from '@/lib/api';

interface Props {
  searchParams: { q?: string; page?: string; category?: string };
}

export const metadata: Metadata = {
  title: 'البحث | التلغراف',
  robots: { index: false, follow: false },
};

async function search(q: string, page = 1, category?: string) {
  try {
    const params = new URLSearchParams({ q, page: String(page), limit: '16' });
    if (category) params.set('category', category);

    const res = await fetch(`${API_URL}/search?${params}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    return { hits: json.data, total: json.meta?.pagination?.total || 0, totalPages: json.meta?.pagination?.totalPages || 1 };
  } catch {
    return null;
  }
}

export default async function SearchPage({ searchParams }: Props) {
  const q = searchParams.q?.trim() || '';
  const page = parseInt(searchParams.page || '1', 10);
  const category = searchParams.category;

  const result = q ? await search(q, page, category) : null;

  const baseSearchPath = `/search?q=${encodeURIComponent(q)}${category ? `&category=${category}` : ''}`;

  return (
    <div className="container mx-auto px-4 max-w-5xl py-8">
      <PageHeader
        kicker="البحث في الأرشيف"
        title={q ? `نتائج البحث عن «${q}»` : 'البحث'}
        crumbs={[{ label: 'البحث' }]}
        meta={
          result ? (
            <span>
              {result.total > 0
                ? `${result.total.toLocaleString('ar-u-nu-arab')} نتيجة`
                : 'لا توجد نتائج'}
            </span>
          ) : undefined
        }
      />

      {/* Search form (for no-JS or navigation) */}
      <form action="/search" method="get" className="rise rise-4 mb-10 -mt-2">
        <div className="relative">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="ابحث في الشعر والسرد والفكر..."
            className="input-telegraph"
            style={{ paddingLeft: '3.5rem' }}
            autoFocus={!q}
          />
          <button
            type="submit"
            aria-label="بحث"
            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-sm text-accent-700 dark:text-accent-300 hover:bg-accent hover:text-ink transition-colors duration-300"
          >
            <Search className="w-5 h-5" />
          </button>
        </div>
      </form>

      {/* Empty prompt */}
      {!q && (
        <div className="rise rise-5 flex flex-col items-center text-center py-14 gap-6">
          <span className="postmark" aria-hidden="true">
            <Search className="w-5 h-5" />
            <span>بحث</span>
          </span>
          <p className="text-lg font-body" style={{ color: 'var(--color-text-secondary)' }}>
            اكتب ما تبحث عنه أعلاه — عنواناً أو كاتباً أو فكرة
          </p>
        </div>
      )}

      {q && !result && (
        <div className="text-center py-16 font-body" style={{ color: 'var(--color-text-secondary)' }}>
          <p>حدث خطأ أثناء البحث. يرجى المحاولة مرة أخرى.</p>
        </div>
      )}

      {q && result && result.total === 0 && (
        <div className="flex flex-col items-center text-center py-14 gap-6">
          <span className="postmark" aria-hidden="true">
            <span className="text-lg leading-none">؟</span>
            <span>لا نتائج</span>
          </span>
          <div>
            <p className="text-xl font-heading font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
              لا توجد نتائج لـ «{q}»
            </p>
            <p className="font-body" style={{ color: 'var(--color-text-secondary)' }}>
              جرّب كلمات مختلفة أو أقل تحديداً
            </p>
          </div>
          <Link href="/" className="btn-telegraph btn-telegraph--outline">
            العودة للرئيسية
          </Link>
        </div>
      )}

      {q && result && result.total > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {(result.hits || []).map((article: Article, i: number) => (
              <Reveal key={article._id} delay={(i % 3) * 90}>
                <ArticleCard article={article} variant="standard" showExcerpt />
              </Reveal>
            ))}
          </div>

          {result.totalPages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={result.totalPages}
              basePath={baseSearchPath}
            />
          )}
        </>
      )}
    </div>
  );
}
