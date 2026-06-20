import Link from 'next/link';
import type { ReactNode } from 'react';

interface Crumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  /** Small calligraphic line above the title (e.g. قسم، وسم، البحث) */
  kicker?: string;
  subtitle?: string;
  /** Breadcrumb trail after الرئيسية */
  crumbs?: Crumb[];
  /** Small muted line under the subtitle (counts, etc.) */
  meta?: ReactNode;
  align?: 'start' | 'center';
  children?: ReactNode;
}

/**
 * Branded page header for section pages: breadcrumb with ◆ separators,
 * calligraphic kicker, headline with an animated morse rule, staggered
 * page-load rise.
 */
export default function PageHeader({
  title,
  kicker,
  subtitle,
  crumbs = [],
  meta,
  align = 'start',
  children,
}: PageHeaderProps) {
  const centered = align === 'center';

  return (
    <header className={`relative mb-10 ${centered ? 'text-center' : ''}`}>
      <nav
        className={`rise rise-1 flex items-center gap-2 text-xs font-arabic mb-7 flex-wrap ${centered ? 'justify-center' : ''}`}
        style={{ color: 'var(--color-text-muted)' }}
        aria-label="مسار التصفح"
      >
        <Link href="/" className="hover:text-accent transition-colors">
          الرئيسية
        </Link>
        {crumbs.map((crumb) => (
          <span key={crumb.label} className="flex items-center gap-2">
            <span className="text-accent" aria-hidden="true">◆</span>
            {crumb.href ? (
              <Link href={crumb.href} className="hover:text-accent transition-colors">
                {crumb.label}
              </Link>
            ) : (
              <span className="line-clamp-1 max-w-[16rem]" style={{ color: 'var(--color-text-secondary)' }}>
                {crumb.label}
              </span>
            )}
          </span>
        ))}
      </nav>

      {kicker && (
        <p className="rise rise-2 font-display text-lg text-accent-700 dark:text-accent-300 mb-2">
          {kicker}
        </p>
      )}

      <div className={`rise rise-3 flex items-center gap-5 ${centered ? 'justify-center' : ''}`}>
        <h1
          className="font-heading font-bold text-3xl md:text-4xl leading-snug"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {title}
        </h1>
        {!centered && (
          <span className="morse-line morse-line--animated flex-1 hidden sm:block" aria-hidden="true" />
        )}
      </div>

      {subtitle && (
        <p
          className={`rise rise-4 mt-3 text-lg font-body leading-loose max-w-2xl ${centered ? 'mx-auto' : ''}`}
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {subtitle}
        </p>
      )}

      {meta && (
        <div
          className={`rise rise-5 mt-3 text-sm font-arabic ${centered ? 'flex justify-center' : ''}`}
          style={{ color: 'var(--color-text-muted)' }}
        >
          {meta}
        </div>
      )}

      {children}
    </header>
  );
}
