'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { fetchTickers } from '@/lib/api';
import type { Ticker } from '@/lib/types';

const TICKER_SPEED_PX_PER_S = 40;

function TickerItems({ tickers, repeat }: { tickers: Ticker[]; repeat: number }) {
  return (
    <>
      {Array.from({ length: repeat }).flatMap((_, r) =>
        tickers.map((ticker) => (
          <span key={`${ticker._id}-${r}`} className="flex items-center gap-12">
            {ticker.url ? (
              <Link
                href={ticker.url}
                className="text-sm font-arabic whitespace-nowrap text-paper/90 hover:text-accent-300 transition-colors"
                tabIndex={-1}
              >
                {ticker.text}
              </Link>
            ) : (
              <span className="text-sm font-arabic whitespace-nowrap text-paper/90">
                {ticker.text}
              </span>
            )}
            <span className="text-accent-400 text-[0.55rem] tracking-[0.35em]" aria-hidden="true">
              — ▪ —
            </span>
          </span>
        ))
      )}
    </>
  );
}

export default function NewsTicker() {
  const { data: tickers } = useSWR<Ticker[]>(
    'tickers',
    fetchTickers,
    {
      refreshInterval: 120000,
      revalidateOnFocus: false,
      onError: () => {},
    }
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const halfRef = useRef<HTMLDivElement>(null);
  const halfWidthRef = useRef(0);
  const pausedRef = useRef(false);
  const [isPaused, setIsPaused] = useState(false);
  // How many copies of the list each half of the tape needs to cover the screen
  const [repeat, setRepeat] = useState(2);

  const setPaused = (value: boolean) => {
    pausedRef.current = value;
    setIsPaused(value);
  };

  // Fallback tickers for when API is unavailable
  const displayTickers: Ticker[] =
    tickers && tickers.length > 0
      ? tickers
      : [
          { _id: '1', text: 'مرحباً بكم في مجلة التلغراف الأدبية والثقافية', isActive: true, order: 1 },
          { _id: '2', text: 'شعر وسرد وقراءات نقدية وفكر وحوار وترجمة', isActive: true, order: 2 },
          { _id: '3', text: 'التلغراف - منبر للكتّاب والمبدعين العرب', isActive: true, order: 3 },
        ];

  const activeTickers = displayTickers.filter((t) => t.isActive);
  const tickersKey = activeTickers.map((t) => t._id).join(',');

  // Measure: how many copies are needed to span the container, and the
  // exact (fractional) width of one half of the tape.
  useEffect(() => {
    const recalc = () => {
      const container = containerRef.current;
      const measure = measureRef.current;
      const half = halfRef.current;
      if (!container || !measure) return;
      const baseWidth = measure.getBoundingClientRect().width;
      const containerWidth = container.offsetWidth;
      if (baseWidth > 0 && containerWidth > 0) {
        setRepeat(Math.max(1, Math.ceil(containerWidth / baseWidth)));
      }
      if (half) {
        // ResizeObserver reports layout size, unaffected by our transform
        halfWidthRef.current = half.getBoundingClientRect().width;
      }
    };

    recalc();
    const observer = new ResizeObserver(recalc);
    if (containerRef.current) observer.observe(containerRef.current);
    if (measureRef.current) observer.observe(measureRef.current);
    if (halfRef.current) observer.observe(halfRef.current);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickersKey, repeat]);

  // Drive the tape with requestAnimationFrame and an exact modulo wrap —
  // no CSS-keyframe percentage rounding, so the seam never snaps.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;

    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    let raf = 0;
    let last = performance.now();
    let offset = 0;

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const width = halfWidthRef.current;
      if (!pausedRef.current && width > 0) {
        // Moves rightward (RTL reading flow); wraps exactly at one half-width
        offset = (offset + TICKER_SPEED_PX_PER_S * dt) % width;
        strip.style.transform = `translate3d(${offset}px, 0, 0)`;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [tickersKey]);

  if (activeTickers.length === 0) return null;

  return (
    <div
      className="news-ticker fixed top-0 left-0 right-0 z-navbar bg-ink text-paper flex items-center overflow-hidden select-none border-b border-white/5"
      style={{ height: 'var(--ticker-height)' }}
      role="region"
      aria-label="آخر البرقيات"
      aria-live="polite"
    >
      {/* Transmission label — a telegraph key on air */}
      <div className="flex-shrink-0 flex items-center gap-2.5 px-4 h-full z-10 relative bg-gradient-to-l from-breaking-700 to-breaking-900">
        <span className="w-2 h-2 rounded-full bg-paper transmit-dot" />
        <span className="font-arabic font-semibold text-sm whitespace-nowrap text-paper">
          برقيات
        </span>
        <span
          aria-hidden="true"
          className="hidden md:block text-[0.55rem] tracking-[0.2em] text-paper/50 font-mono -mb-0.5"
        >
          ▪ ▪▪ —
        </span>
      </div>

      {/* Scrolling tape */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative h-full flex items-center"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        {/* Fade edges */}
        <span aria-hidden="true" className="absolute inset-y-0 right-0 w-10 z-10 bg-gradient-to-l from-ink to-transparent pointer-events-none" />
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-10 z-10 bg-gradient-to-r from-ink to-transparent pointer-events-none" />

        {/* Invisible single copy used to measure the base list width */}
        <div
          ref={measureRef}
          aria-hidden="true"
          className="absolute invisible pointer-events-none flex items-center gap-12 whitespace-nowrap"
        >
          <TickerItems tickers={activeTickers} repeat={1} />
        </div>

        <div
          ref={stripRef}
          className="ticker-content flex items-center"
          aria-atomic="false"
        >
          {/* Two identical equal-width halves — JS shifts by exactly one half
              for a seamless loop. The trailing gap of each half lives in its
              padding so the halves' widths stay equal. */}
          <div ref={halfRef} className="flex items-center gap-12 pl-12">
            <TickerItems tickers={activeTickers} repeat={repeat} />
          </div>
          <div className="flex items-center gap-12 pl-12" aria-hidden="true">
            <TickerItems tickers={activeTickers} repeat={repeat} />
          </div>
        </div>
      </div>

      {/* Pause indicator */}
      {isPaused && (
        <div
          className="flex-shrink-0 px-3 text-xs text-paper/40 font-arabic hidden sm:block"
          aria-hidden="true"
        >
          ⏸
        </div>
      )}
    </div>
  );
}
