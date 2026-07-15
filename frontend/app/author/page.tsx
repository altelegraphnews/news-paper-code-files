import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import PageHeader from '@/components/layout/PageHeader';
import Reveal from '@/components/ui/Reveal';

import { API_URL } from '@/lib/api';
import { avatarUrl } from '@/lib/utils/avatar';

export const metadata: Metadata = {
  title: 'الكتّاب | التلغراف',
  description: 'تعرّف على كتّاب مجلة التلغراف وتصفّح موادهم المنشورة في الشعر والسرد والفكر والترجمة.',
};

export const revalidate = 300;

interface AuthorEntry {
  _id: string;
  name: string;
  slug?: string;
  bio?: string;
  avatar?: string;
  jobTitle?: string;
  articlesCount: number;
}

async function getAuthors(): Promise<AuthorEntry[]> {
  try {
    const res = await fetch(`${API_URL}/users/authors`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}

const authorHref = (author: AuthorEntry) =>
  `/author/${author.slug || author._id}`;

export default async function AuthorsIndexPage() {
  const authors = await getAuthors();

  return (
    <div className="container mx-auto px-4 max-w-6xl py-8">
      <PageHeader
        kicker="أقلام التلغراف"
        title="الكتّاب"
        subtitle="الأصوات التي تكتب التلغراف: شعراء وساردون ونقّاد ومترجمون من مختلف أنحاء العالم العربي."
        crumbs={[{ label: 'الكتّاب' }]}
        meta={
          authors.length > 0 ? (
            <span>{authors.length.toLocaleString('ar-u-nu-arab')} كاتباً وكاتبة</span>
          ) : undefined
        }
      />

      {authors.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {authors.map((author, i) => (
            <Reveal key={author._id} delay={(i % 3) * 90}>
              <Link
                href={authorHref(author)}
                className="group card flex items-start gap-4 p-6 h-full"
              >
                {avatarUrl(author.avatar) ? (
                  <span className="relative w-16 h-16 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-accent/40 transition-shadow duration-300 group-hover:ring-2 group-hover:ring-accent/70">
                    <Image src={avatarUrl(author.avatar)!} alt={author.name} fill className="object-cover" sizes="64px" />
                  </span>
                ) : (
                  <span className="w-16 h-16 rounded-full bg-accent/15 ring-1 ring-accent/40 flex items-center justify-center flex-shrink-0 transition-shadow duration-300 group-hover:ring-2 group-hover:ring-accent/70">
                    <span className="font-display text-accent-700 dark:text-accent-300 text-2xl leading-none pb-1">
                      {author.name.charAt(0)}
                    </span>
                  </span>
                )}

                <span className="flex-1 min-w-0">
                  <span
                    className="font-heading font-bold text-lg block mb-0.5"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    <span className="headline-link">{author.name}</span>
                  </span>
                  {author.jobTitle && (
                    <span className="text-xs font-arabic text-accent-700 dark:text-accent-300 block mb-1.5">
                      {author.jobTitle}
                    </span>
                  )}
                  {author.bio && (
                    <span
                      className="text-sm font-body leading-relaxed line-clamp-2 block"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {author.bio}
                    </span>
                  )}
                  <span
                    className="text-xs font-arabic mt-2 flex items-center gap-1.5"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    <span className="text-accent" aria-hidden="true">◆</span>
                    {author.articlesCount.toLocaleString('ar-u-nu-arab')} مادة منشورة
                  </span>
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center text-center py-16 gap-6">
          <span className="postmark" aria-hidden="true">
            <span className="text-lg leading-none">✎</span>
            <span>قريباً</span>
          </span>
          <p className="text-lg font-body" style={{ color: 'var(--color-text-secondary)' }}>
            ستظهر صفحات الكتّاب هنا فور نشر موادهم الأولى
          </p>
          <Link href="/" className="btn-telegraph btn-telegraph--outline">
            العودة للرئيسية
          </Link>
        </div>
      )}
    </div>
  );
}
