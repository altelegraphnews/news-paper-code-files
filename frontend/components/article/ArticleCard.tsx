import Link from 'next/link';
import Image from 'next/image';
import { Article } from '@/lib/types';
import { getRelativeTime } from '@/lib/utils/dateUtils';

interface ArticleCardProps {
  article: Article;
  variant?: 'hero' | 'featured' | 'standard' | 'compact' | 'horizontal';
  className?: string;
  showExcerpt?: boolean;
  showAuthor?: boolean;
}

const articleUrl = (article: Article) =>
  `/article/${article.category?.slug || 'uncategorized'}/${article.slug}`;

export default function ArticleCard({
  article,
  variant = 'standard',
  className = '',
  showExcerpt = false,
  showAuthor = true,
}: ArticleCardProps) {
  if (variant === 'hero') {
    return (
      <article className={`relative overflow-hidden rounded-sm group frame-gold ${className}`}>
        <Link href={articleUrl(article)} className="block h-full">
          <div className="relative h-full min-h-[inherit] aspect-[16/10] md:aspect-auto">
            {article.ogImage?.url ? (
              <Image
                src={article.ogImage.url}
                alt={article.ogImage.alt || article.title}
                fill
                className="object-cover img-zoom img-tone"
                priority
                sizes="(max-width: 1024px) 100vw, 66vw"
              />
            ) : (
              <div className="w-full h-full absolute inset-0 bg-gradient-to-br from-ink via-primary-900 to-primary-800" />
            )}
            {/* Ink veil */}
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
          </div>

          <div className="absolute bottom-0 right-0 left-0 p-5 md:p-9">
            <div className="flex items-center gap-2.5 mb-4 rise rise-1">
              {article.isBreaking && (
                <span className="flex items-center gap-1.5 bg-breaking text-white text-xs px-2.5 py-1 font-arabic font-bold rounded-sm">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  عاجل
                </span>
              )}
              {article.category && (
                <span className="bg-accent text-ink text-xs font-arabic font-semibold px-2.5 py-1 rounded-sm">
                  {article.category.name}
                </span>
              )}
              <span className="morse-line morse-line--subtle w-16 hidden md:block" aria-hidden="true" />
            </div>

            <h2 className="rise rise-2 text-2xl md:text-4xl lg:text-[2.75rem] font-heading font-bold text-paper leading-[1.5] mb-4 line-clamp-3 [text-shadow:0_2px_24px_rgba(0,0,0,0.5)]">
              <span className="headline-link">{article.title}</span>
            </h2>

            {article.excerpt && (
              <p className="rise rise-3 text-paper/75 font-body text-base md:text-lg line-clamp-2 mb-5 hidden md:block max-w-3xl">
                {article.excerpt}
              </p>
            )}

            <div className="rise rise-4 flex items-center gap-3 text-paper/60 text-xs font-arabic">
              {showAuthor && article.author?.name && (
                <span className="font-medium text-accent-200">{article.author.name}</span>
              )}
              {article.publishedAt && (
                <time dateTime={article.publishedAt}>
                  {getRelativeTime(article.publishedAt)}
                </time>
              )}
              {article.readingTimeMin && (
                <span>{article.readingTimeMin} دقائق للقراءة</span>
              )}
            </div>
          </div>
        </Link>
      </article>
    );
  }

  if (variant === 'featured') {
    return (
      <article className={`group overflow-hidden rounded-sm border border-border bg-surface dark:bg-surface-dark dark:border-gray-800 shadow-card hover-lift hover:border-accent/40 ${className}`} style={{ borderColor: 'var(--color-border)' }}>
        <Link href={articleUrl(article)} className="block">
          <div className="relative aspect-[16/9] overflow-hidden">
            {article.ogImage?.url ? (
              <Image
                src={article.ogImage.url}
                alt={article.ogImage.alt || article.title}
                fill
                className="object-cover img-zoom img-tone"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary-100 to-accent-100 dark:from-primary-800 dark:to-accent-950" />
            )}
            {article.category && (
              <span className="absolute bottom-0 right-4 translate-y-1/2 bg-accent text-ink text-xs font-arabic font-semibold px-2.5 py-1 rounded-sm shadow-gold">
                {article.category.name}
              </span>
            )}
          </div>

          <div className="p-5 pt-6">
            <h2 className="font-heading font-bold text-xl leading-relaxed line-clamp-2 mb-2" style={{ color: 'var(--color-text-primary)' }}>
              <span className="headline-link">{article.title}</span>
            </h2>
            {showExcerpt && article.excerpt && (
              <p className="text-sm font-body line-clamp-2 mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                {article.excerpt}
              </p>
            )}
            <div className="flex items-center gap-2 text-xs font-arabic mt-3" style={{ color: 'var(--color-text-muted)' }}>
              {showAuthor && article.author?.name && <span>{article.author.name}</span>}
              {article.publishedAt && (
                <>
                  <span className="text-accent" aria-hidden="true">◆</span>
                  <time dateTime={article.publishedAt}>{getRelativeTime(article.publishedAt)}</time>
                </>
              )}
            </div>
          </div>
        </Link>
      </article>
    );
  }

  if (variant === 'horizontal') {
    return (
      <article className={`group flex gap-3 ${className}`}>
        <Link href={articleUrl(article)} className="flex gap-4 flex-1 items-start">
          <div className="relative w-24 h-20 md:w-32 md:h-24 flex-shrink-0 rounded-sm overflow-hidden ring-1 ring-transparent group-hover:ring-accent/60 transition-[box-shadow] duration-300">
            {article.ogImage?.url ? (
              <Image
                src={article.ogImage.url}
                alt={article.ogImage.alt || article.title}
                fill
                className="object-cover img-zoom img-tone"
                sizes="128px"
              />
            ) : (
              <div className="w-full h-full" style={{ background: 'var(--color-surface-2)' }} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            {article.category && (
              <span className="text-accent-700 dark:text-accent-300 text-xs font-arabic font-medium">
                {article.category.name}
              </span>
            )}
            <h3 className="font-heading font-bold text-base leading-relaxed line-clamp-2 mt-0.5" style={{ color: 'var(--color-text-primary)' }}>
              <span className="headline-link">{article.title}</span>
            </h3>
            {article.publishedAt && (
              <time className="text-xs font-arabic mt-1.5 block" style={{ color: 'var(--color-text-muted)' }} dateTime={article.publishedAt}>
                {getRelativeTime(article.publishedAt)}
              </time>
            )}
          </div>
        </Link>
      </article>
    );
  }

  if (variant === 'compact') {
    return (
      <article className={`group ${className}`}>
        <Link href={articleUrl(article)} className="block">
          {article.category && (
            <span className="text-accent-700 dark:text-accent-300 text-xs font-arabic font-medium">
              {article.category.name}
            </span>
          )}
          <h3 className="font-heading font-bold text-base leading-relaxed line-clamp-2 mt-0.5" style={{ color: 'var(--color-text-primary)' }}>
            <span className="headline-link">{article.title}</span>
          </h3>
          {article.publishedAt && (
            <time className="text-xs font-arabic" style={{ color: 'var(--color-text-muted)' }} dateTime={article.publishedAt}>
              {getRelativeTime(article.publishedAt)}
            </time>
          )}
        </Link>
      </article>
    );
  }

  // Standard
  return (
    <article className={`group ${className}`}>
      <Link href={articleUrl(article)} className="block">
        <div className="relative aspect-[16/9] rounded-sm overflow-hidden mb-3 frame-gold">
          {article.ogImage?.url ? (
            <Image
              src={article.ogImage.url}
              alt={article.ogImage.alt || article.title}
              fill
              className="object-cover img-zoom img-tone"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="w-full h-full" style={{ background: 'var(--color-surface-2)' }} />
          )}
          {article.isBreaking && (
            <span className="absolute top-2 right-2 z-[3] flex items-center gap-1 bg-breaking text-white text-xs px-2 py-0.5 rounded-sm font-arabic font-bold">
              <span className="w-1 h-1 bg-white rounded-full animate-pulse" /> عاجل
            </span>
          )}
        </div>

        {article.category && (
          <span className="text-accent-700 dark:text-accent-300 text-xs font-arabic font-medium">
            {article.category.name}
          </span>
        )}
        <h3 className="font-heading font-bold text-lg leading-relaxed line-clamp-2 mb-2 mt-0.5" style={{ color: 'var(--color-text-primary)' }}>
          <span className="headline-link">{article.title}</span>
        </h3>
        {showExcerpt && article.excerpt && (
          <p className="text-sm font-body line-clamp-2 mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            {article.excerpt}
          </p>
        )}
        <div className="flex items-center gap-2 text-xs font-arabic" style={{ color: 'var(--color-text-muted)' }}>
          {showAuthor && article.author?.name && <span>{article.author.name}</span>}
          {article.publishedAt && (
            <time dateTime={article.publishedAt}>{getRelativeTime(article.publishedAt)}</time>
          )}
          {article.readingTimeMin && <span>· {article.readingTimeMin} د</span>}
        </div>
      </Link>
    </article>
  );
}
