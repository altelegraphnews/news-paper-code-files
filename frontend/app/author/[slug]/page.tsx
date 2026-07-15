import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import ArticleCard from '@/components/article/ArticleCard';
import Pagination from '@/components/ui/Pagination';
import Reveal from '@/components/ui/Reveal';
import { Article } from '@/lib/types';

import { API_URL } from '@/lib/api';
import { avatarUrl } from '@/lib/utils/avatar';

interface Props {
  params: { slug: string };
  searchParams: { page?: string };
}

interface AuthorInfo {
  name: string;
  bio?: string;
  avatar?: string;
  jobTitle?: string;
}

async function getAuthorData(slug: string, page = 1) {
  try {
    // params.slug arrives percent-encoded from the router — decode before
    // re-encoding, otherwise Arabic slugs get double-encoded and never match
    const decoded = decodeURIComponent(slug);
    const userRes = await fetch(
      `${API_URL}/users/by-slug/${encodeURIComponent(decoded)}`,
      { next: { revalidate: 3600 } }
    );

    let authorId: string | null = null;
    let author: AuthorInfo | null = null;

    if (userRes.ok) {
      const userJson = await userRes.json();
      const u = userJson.data;
      authorId = u?._id || u?.id || null;
      author = u ? { name: u.name, bio: u.bio, avatar: u.avatar, jobTitle: u.jobTitle } : null;
    }

    if (!authorId) return null;

    const articlesRes = await fetch(
      `${API_URL}/articles?author=${authorId}&page=${page}&limit=16&status=published`,
      { next: { revalidate: 60 } }
    );
    if (!articlesRes.ok) return null;

    const articlesJson = await articlesRes.json();
    return {
      author,
      articles: (articlesJson.data || []) as Article[],
      pagination: articlesJson.meta?.pagination || { page: 1, totalPages: 1, total: 0 },
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getAuthorData(params.slug);
  const name = data?.author?.name || decodeURIComponent(params.slug);
  return {
    title: `${name} | التلغراف`,
    description: `اقرأ جميع مواد الكاتب ${name} في مجلة التلغراف`,
  };
}

export default async function AuthorPage({ params, searchParams }: Props) {
  const page = parseInt(searchParams.page || '1', 10);
  const data = await getAuthorData(params.slug, page);

  if (!data) notFound();

  const { author, articles, pagination } = data;
  const name = author?.name || decodeURIComponent(params.slug);

  return (
    <div className="container mx-auto px-4 max-w-5xl py-8">
      {/* Breadcrumb */}
      <nav
        className="rise rise-1 flex items-center gap-2 text-xs font-arabic mb-7 flex-wrap"
        style={{ color: 'var(--color-text-muted)' }}
        aria-label="مسار التصفح"
      >
        <Link href="/" className="hover:text-accent transition-colors">الرئيسية</Link>
        <span className="text-accent" aria-hidden="true">◆</span>
        <Link href="/author" className="hover:text-accent transition-colors">الكتّاب</Link>
        <span className="text-accent" aria-hidden="true">◆</span>
        <span style={{ color: 'var(--color-text-secondary)' }}>{name}</span>
      </nav>

      {/* Author byline card */}
      <header
        className="rise rise-2 relative rounded-sm border p-6 md:p-8 mb-10 overflow-hidden"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <span className="absolute -top-px right-8 morse-line w-24" aria-hidden="true" />
        <span
          aria-hidden="true"
          className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-accent/10 blur-3xl pointer-events-none"
        />

        <div className="relative flex items-center gap-6 flex-wrap">
          {avatarUrl(author?.avatar) ? (
            <div className="relative w-24 h-24 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-accent/50 ring-offset-2 ring-offset-[color:var(--color-surface)]">
              <Image src={avatarUrl(author?.avatar)!} alt={name} fill className="object-cover" sizes="96px" />
            </div>
          ) : (
            <div className="w-24 h-24 rounded-full bg-accent/15 ring-2 ring-accent/50 ring-offset-2 ring-offset-[color:var(--color-surface)] flex items-center justify-center flex-shrink-0">
              <span className="font-display text-accent-700 dark:text-accent-300 text-4xl leading-none pb-2">
                {name.charAt(0)}
              </span>
            </div>
          )}

          <div className="flex-1 min-w-[14rem]">
            <p className="font-display text-accent-700 dark:text-accent-300 text-base mb-1">
              {author?.jobTitle || 'من كتّاب التلغراف'}
            </p>
            <h1
              className="font-heading font-bold text-3xl mb-2"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {name}
            </h1>
            {author?.bio && (
              <p
                className="font-body leading-loose max-w-2xl"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {author.bio}
              </p>
            )}
            {pagination.total > 0 && (
              <p className="text-xs font-arabic mt-3" style={{ color: 'var(--color-text-muted)' }}>
                {pagination.total.toLocaleString('ar-u-nu-arab')} مادة منشورة
              </p>
            )}
          </div>
        </div>
      </header>

      {articles.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {articles.map((article, i) => (
              <Reveal key={article._id} delay={(i % 3) * 90}>
                <ArticleCard article={article} variant="standard" showExcerpt />
              </Reveal>
            ))}
          </div>
          {pagination.totalPages > 1 && (
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              basePath={`/author/${params.slug}`}
            />
          )}
        </>
      ) : (
        <div className="flex flex-col items-center text-center py-16 gap-6">
          <span className="postmark" aria-hidden="true">
            <span className="text-lg leading-none">✎</span>
            <span>قريباً</span>
          </span>
          <p className="text-lg font-body" style={{ color: 'var(--color-text-secondary)' }}>
            لا توجد مواد لهذا الكاتب حتى الآن
          </p>
          <Link href="/" className="btn-telegraph btn-telegraph--outline">
            العودة للرئيسية
          </Link>
        </div>
      )}
    </div>
  );
}
