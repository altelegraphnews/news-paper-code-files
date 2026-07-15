import type { Metadata } from 'next';
import ArticleCard from '@/components/article/ArticleCard';
import { Skeleton } from '@/components/ui/Skeleton';
import NewsletterForm from '@/components/ui/NewsletterForm';
import Reveal from '@/components/ui/Reveal';
import Link from 'next/link';
import Image from 'next/image';
import { Article } from '@/lib/types';

import { API_URL } from '@/lib/api';
import { avatarUrl } from '@/lib/utils/avatar';

export const metadata: Metadata = {
  title: 'التلغراف - مجلة أدبية وثقافية',
  description: 'التلغراف — مجلة ثقافية وأدبية تُعنى بالشعر والسرد والقراءات النقدية والفكر والحوار والترجمة',
};

export const revalidate = 60; // ISR: revalidate every 60 seconds

const ARABIC_NUMERALS = ['١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩', '١٠'];

/** Classic newspaper dateline above the masthead fold (refreshes with ISR) */
function Dateline() {
  const now = new Date();
  const gregorian = new Intl.DateTimeFormat('ar-IQ-u-nu-arab', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);
  let hijri = '';
  try {
    hijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-arab', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now);
  } catch {
    // Hijri calendar unavailable in this ICU build — show Gregorian only
  }
  return (
    <div
      className="rise rise-1 flex items-center gap-4 pt-6 text-xs font-arabic"
      style={{ color: 'var(--color-text-muted)' }}
    >
      <span className="whitespace-nowrap">{gregorian}</span>
      {hijri && (
        <>
          <span className="text-accent hidden sm:inline" aria-hidden="true">◆</span>
          <span className="whitespace-nowrap hidden sm:inline">{hijri}</span>
        </>
      )}
      <span className="morse-line morse-line--subtle flex-1" aria-hidden="true" />
      <span className="font-display text-accent-700 dark:text-accent-300 text-sm whitespace-nowrap">
        أدب · فكر · ثقافة
      </span>
    </div>
  );
}

async function getHomepageData() {
  try {
    const res = await fetch(`${API_URL}/homepage`, {
      next: { revalidate: 60 },
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Failed to fetch homepage');
    const json = await res.json();
    return json.data;
  } catch {
    return null;
  }
}

function SectionHeader({ title, href }: { title: string; href?: string }) {
  return (
    <div className="flex items-center gap-5 mb-7">
      <h2
        className="font-heading font-bold text-2xl md:text-[1.75rem] whitespace-nowrap"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {title}
      </h2>
      <span className="morse-line morse-line--animated flex-1" aria-hidden="true" />
      {href && (
        <Link
          href={href}
          className="group flex items-center gap-1.5 text-accent-700 dark:text-accent-300 text-sm font-arabic font-medium hover:text-accent transition-colors whitespace-nowrap"
        >
          عرض الكل
          <span className="inline-block transition-transform duration-300 group-hover:-translate-x-1" aria-hidden="true">
            ←
          </span>
        </Link>
      )}
    </div>
  );
}

function MostReadSidebar({ articles }: { articles: Article[] }) {
  if (!articles?.length) return null;
  return (
    <aside
      className="rounded-sm border p-6 relative overflow-hidden"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-center gap-3 mb-6">
        <h2 className="font-heading font-bold text-xl whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>
          الأكثر قراءة
        </h2>
        <span className="morse-line morse-line--subtle flex-1" aria-hidden="true" />
      </div>
      <ol className="space-y-5">
        {articles.slice(0, 7).map((article: Article, i: number) => (
          <li key={article._id}>
            <Link
              href={`/article/${article.category?.slug || 'uncategorized'}/${article.slug}`}
              className="flex gap-4 items-start group"
            >
              <span className="rank-numeral flex-shrink-0 w-10 text-center" aria-hidden="true">
                {ARABIC_NUMERALS[i]}
              </span>
              <span
                className="text-[0.9375rem] font-heading font-bold leading-relaxed line-clamp-2 pt-1"
                style={{ color: 'var(--color-text-primary)' }}
              >
                <span className="headline-link">{article.title}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </aside>
  );
}

function OpinionSection({ articles }: { articles: Article[] }) {
  if (!articles?.length) return null;
  return (
    <section className="py-12">
      <SectionHeader title="رأي وتحليل" href="/opinion" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {articles.slice(0, 4).map((article: Article, i: number) => (
          <Reveal key={article._id} delay={i * 90}>
            <article
              className="group h-full rounded-sm border p-6 pt-9 relative hover-lift hover:border-accent/50 transition-colors"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              {/* Ornamental quote mark */}
              <span
                className="absolute top-3 right-5 text-5xl leading-none text-accent/30 font-heading select-none transition-colors duration-300 group-hover:text-accent/60"
                aria-hidden="true"
              >
                ❝
              </span>
              <Link href={`/article/${article.category?.slug || 'opinion'}/${article.slug}`} className="flex flex-col h-full">
                <p
                  className="font-body text-[0.9375rem] leading-loose text-center line-clamp-4 mb-5 flex-1"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {article.excerpt}
                </p>

                <span className="ornament-break text-xs mb-4" aria-hidden="true">✦</span>

                <h3
                  className="font-heading font-bold text-base text-center leading-relaxed line-clamp-2 mb-3"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  <span className="headline-link">{article.title}</span>
                </h3>

                <div className="flex items-center justify-center gap-3">
                  {avatarUrl(article.author?.avatar) ? (
                    <span className="relative w-9 h-9 rounded-full overflow-hidden ring-1 ring-accent/40">
                      <Image src={avatarUrl(article.author?.avatar)!} alt={article.author.name} fill className="object-cover" sizes="36px" />
                    </span>
                  ) : (
                    <span className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center ring-1 ring-accent/40">
                      <span className="text-accent-700 dark:text-accent-300 font-heading font-bold text-sm">
                        {article.author?.name?.charAt(0) || 'ك'}
                      </span>
                    </span>
                  )}
                  {article.author && (
                    <span className="text-xs font-arabic" style={{ color: 'var(--color-text-muted)' }}>
                      {article.author.name}
                    </span>
                  )}
                </div>
              </Link>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function CategorySection({
  category,
  articles,
}: {
  category: { name: string; slug: string; color?: string };
  articles: Article[];
}) {
  if (!articles?.length) return null;
  return (
    <Reveal as="section" className="py-10 border-t border-[color:var(--color-border)]">
      <SectionHeader title={category.name} href={`/category/${category.slug}`} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {articles.slice(0, 4).map((article: Article, i: number) => (
          <ArticleCard key={article._id} article={article} variant={i === 0 ? 'featured' : 'standard'} />
        ))}
      </div>
    </Reveal>
  );
}

function NewsletterSignup() {
  return (
    <Reveal as="section" className="newsletter-signup my-14">
      <div className="relative overflow-hidden rounded-sm bg-ink px-8 py-14 md:px-12 md:py-16 text-center">
        {/* Morse pattern backdrop */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-7 morse-line morse-line--animated opacity-20"
        />
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-7 morse-line morse-line--animated opacity-20"
        />
        {/* Soft gold glow */}
        <span
          aria-hidden="true"
          className="absolute -top-32 right-1/2 translate-x-1/2 w-[34rem] h-64 rounded-full bg-accent/15 blur-3xl"
        />

        <div className="relative">
          <p className="font-display text-accent-300 text-lg mb-3">برقية أسبوعية</p>
          <h2 className="font-heading font-bold text-3xl md:text-4xl text-paper mb-4">
            اشترك في النشرة البريدية
          </h2>
          <p className="text-paper/65 font-body text-lg mb-8 max-w-xl mx-auto">
            مختارات من الشعر والسرد والفكر، تصلك كل أسبوع كما تصل البرقيات: قصيرةً ومضيئة.
          </p>
          <NewsletterForm />
        </div>
      </div>
    </Reveal>
  );
}

export default async function HomePage() {
  const data = await getHomepageData();

  if (!data) {
    return (
      <div className="container mx-auto px-4 py-10 text-center">
        <p className="text-lg font-body" style={{ color: 'var(--color-text-secondary)' }}>
          تعذّر تحميل الصفحة الرئيسية. يرجى المحاولة لاحقاً.
        </p>
      </div>
    );
  }

  const { hero, featured = [], latest = [], categoryRows = [], mostRead = [], opinion = [] } = data;

  return (
    <div className="container mx-auto px-4 max-w-7xl">
      <Dateline />

      {/* Hero + Secondary Featured */}
      <section className="py-7">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Hero */}
          <div className="lg:col-span-2">
            {hero ? (
              <ArticleCard article={hero} variant="hero" className="h-full min-h-[340px] md:min-h-[480px]" showExcerpt />
            ) : (
              <Skeleton className="h-[480px] rounded-sm" />
            )}
          </div>

          {/* Secondary featured */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3 mb-3 rise rise-2">
              <span className="font-display text-accent-700 dark:text-accent-300 text-base">مختارات</span>
              <span className="morse-line morse-line--subtle flex-1" aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-5 flex-1 justify-between">
              {(featured || []).slice(0, 3).map((article: Article, i: number) => (
                <div key={article._id} className={`rise rise-${Math.min(i + 3, 6)}`}>
                  <ArticleCard article={article} variant="horizontal" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Ornamental break */}
      <div className="ornament-break text-sm py-2" aria-hidden="true">✦</div>

      {/* Main content + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 py-8">
        {/* Latest */}
        <Reveal className="lg:col-span-2">
          <SectionHeader title="آخر المنشورات" />
          <div className="space-y-6 divide-y divide-[color:var(--color-border)]">
            {(latest || []).slice(0, 10).map((article: Article) => (
              <ArticleCard
                key={article._id}
                article={article}
                variant="horizontal"
                className="pt-6 first:pt-0 [&>a>div:first-child]:md:w-40 [&>a>div:first-child]:md:h-28"
                showExcerpt
              />
            ))}
          </div>
          {latest?.length === 0 && (
            <div className="space-y-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-sm" />
              ))}
            </div>
          )}
        </Reveal>

        {/* Sidebar */}
        <Reveal as="aside" delay={120} className="space-y-6">
          <MostReadSidebar articles={mostRead} />
        </Reveal>
      </div>

      {/* Category rows */}
      {(categoryRows || []).map((row: { category: { name: string; slug: string; color?: string }; articles: Article[] }) => (
        <CategorySection key={row.category.slug} category={row.category} articles={row.articles} />
      ))}

      {/* Opinion */}
      <OpinionSection articles={opinion} />

      {/* Newsletter */}
      <NewsletterSignup />
    </div>
  );
}
