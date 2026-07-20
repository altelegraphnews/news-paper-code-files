'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Article } from '@/lib/types';
import { getRelativeTime } from '@/lib/utils/dateUtils';

interface HeroCarouselProps {
  slides: Article[];
  /** Time each slide holds before advancing, in ms */
  interval?: number;
  className?: string;
}

const articleUrl = (article: Article) =>
  `/article/${article.category?.slug || 'uncategorized'}/${article.slug}`;

const ARABIC_NUMERALS = ['١', '٢', '٣', '٤', '٥', '٦', '٧'];

/**
 * The homepage hero: cross-fades through the articles chosen in the admin
 * panel (homepage:heroSlides, up to 7).
 *
 * Every slide is rendered into the DOM so the whole set is crawlable and
 * navigable without JS — the carousel only layers fading and autoplay on top.
 * Autoplay pauses on hover, on keyboard focus, and while the tab is hidden,
 * and never starts at all under prefers-reduced-motion.
 */
export default function HeroCarousel({ slides, interval = 6500, className = '' }: HeroCarouselProps) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const count = slides.length;
  const goTo = useCallback((i: number) => setActive(((i % count) + count) % count), [count]);
  const next = useCallback(() => goTo(active + 1), [goTo, active]);
  const prev = useCallback(() => goTo(active - 1), [goTo, active]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Don't burn timers on a backgrounded tab.
  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (count < 2 || paused || reducedMotion) return;
    const id = window.setTimeout(() => setActive((i) => (i + 1) % count), interval);
    return () => window.clearTimeout(id);
  }, [active, count, paused, reducedMotion, interval]);

  // RTL: the left arrow key moves forward through the deck.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); next(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); prev(); }
  };

  if (!count) return null;

  const isCarousel = count > 1;

  return (
    <div
      ref={rootRef}
      className={`hero-carousel relative overflow-hidden rounded-sm ${className}`}
      onMouseEnter={() => isCarousel && setPaused(true)}
      onMouseLeave={() => isCarousel && setPaused(document.hidden)}
      onFocusCapture={() => isCarousel && setPaused(true)}
      onBlurCapture={(e) => {
        if (isCarousel && !e.currentTarget.contains(e.relatedTarget as Node)) setPaused(document.hidden);
      }}
      onKeyDown={isCarousel ? onKeyDown : undefined}
      role={isCarousel ? 'region' : undefined}
      aria-roledescription={isCarousel ? 'carousel' : undefined}
      aria-label={isCarousel ? 'أبرز المقالات' : undefined}
    >
      {slides.map((article, i) => {
        const isActive = i === active;
        return (
          <article
            key={article._id}
            className={`hero-slide group frame-gold ${isActive ? 'is-active' : ''}`}
            aria-hidden={!isActive}
            role={isCarousel ? 'group' : undefined}
            aria-roledescription={isCarousel ? 'slide' : undefined}
            aria-label={isCarousel ? `${i + 1} من ${count}` : undefined}
          >
            <Link href={articleUrl(article)} className="block h-full" tabIndex={isActive ? 0 : -1}>
              <div className="relative h-full min-h-[inherit]">
                {article.ogImage?.url ? (
                  <Image
                    src={article.ogImage.url}
                    alt={article.ogImage.alt || article.title}
                    fill
                    className="object-cover img-zoom img-tone"
                    priority={i === 0}
                    sizes="(max-width: 1024px) 100vw, 66vw"
                  />
                ) : (
                  <div className="w-full h-full absolute inset-0 bg-gradient-to-br from-ink via-primary-900 to-primary-800" />
                )}
                {/* Ink veil */}
                <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
              </div>

              {/* Keyed on the slide index so the staggered rise replays on each change */}
              <div
                key={isActive ? `on-${i}` : `off-${i}`}
                className="absolute bottom-0 right-0 left-0 p-5 md:p-9 pb-14 md:pb-16"
              >
                <div className={`${isActive ? 'rise rise-1' : ''} flex items-center gap-2.5 mb-4`}>
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

                <h2 className={`${isActive ? 'rise rise-2' : ''} text-2xl md:text-4xl lg:text-[2.75rem] font-heading font-bold text-paper leading-[1.5] mb-4 line-clamp-3 [text-shadow:0_2px_24px_rgba(0,0,0,0.5)]`}>
                  <span className="headline-link">{article.title}</span>
                </h2>

                {article.excerpt && (
                  <p className={`${isActive ? 'rise rise-3' : ''} text-paper/75 font-body text-base md:text-lg line-clamp-2 mb-5 hidden md:block max-w-3xl`}>
                    {article.excerpt}
                  </p>
                )}

                <div className={`${isActive ? 'rise rise-4' : ''} flex items-center gap-3 text-paper/60 text-xs font-arabic`}>
                  {article.author?.name && (
                    <span className="font-medium text-accent-200">{article.author.name}</span>
                  )}
                  {article.publishedAt && (
                    <time dateTime={article.publishedAt}>{getRelativeTime(article.publishedAt)}</time>
                  )}
                  {article.readingTimeMin && <span>{article.readingTimeMin} دقائق للقراءة</span>}
                </div>
              </div>
            </Link>
          </article>
        );
      })}

      {isCarousel && (
        // Bottom control bar: prev/next flank the tick indicators. Sits in the
        // band the caption's bottom padding reserves, so it never overlaps the
        // headline. RTL flex order: prev (→) lands on the right, next (←) on
        // the left, ticks stretch between.
        <div className="hero-controls" role="group" aria-label="التنقل بين المقالات">
          <button
            type="button"
            onClick={prev}
            aria-label="المقال السابق"
            className="hero-nav"
          >
            <span aria-hidden="true">→</span>
          </button>

          {/* Telegraph-tape indicator: one tick per slide, the active one fills
              as its turn elapses */}
          <div className="hero-ticks" role="tablist" aria-label="اختر مقالاً">
            {slides.map((article, i) => (
              <button
                key={article._id}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-label={`${ARABIC_NUMERALS[i] || i + 1} — ${article.title}`}
                onClick={() => goTo(i)}
                className={`hero-tick ${i === active ? 'is-active' : ''}`}
              >
                {/* Keyed on `active` so the fill restarts with each slide;
                    pausing freezes it in place rather than resetting it. */}
                <span
                  key={`fill-${active}`}
                  className="hero-tick__fill"
                  style={
                    i === active
                      ? {
                          animationDuration: `${interval}ms`,
                          animationPlayState: paused ? 'paused' : 'running',
                          ...(reducedMotion ? { animation: 'none', transform: 'scaleX(1)' } : null),
                        }
                      : undefined
                  }
                />
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={next}
            aria-label="المقال التالي"
            className="hero-nav"
          >
            <span aria-hidden="true">←</span>
          </button>
        </div>
      )}
    </div>
  );
}
