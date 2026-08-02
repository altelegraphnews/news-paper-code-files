'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Dialog } from '@headlessui/react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

/**
 * Progressive enhancement for article galleries.
 *
 * ArticleBody stays a server component rendering plain HTML: every picture is
 * in the DOM and crawlable, the grid and the swipeable strip are pure CSS, and
 * all of it works with JavaScript off. This adds the parts that need a runtime
 * — arrows for the carousel and click-to-enlarge — without any of it having to
 * survive the backend sanitiser, which strips role, tabindex and <button>.
 *
 * Three rules hold this together:
 *  · Nothing renders until after mount, so a hydration mismatch is impossible.
 *  · Controls go in through createPortal, never appendChild — React strict mode
 *    double-invokes effects and an imperative injector would leave two copies.
 *  · Scrolling uses offsetLeft only. RTL scrollLeft sign conventions still
 *    differ between engines and are not worth betting on.
 */

interface Slide {
  src: string;
  alt: string;
  caption: string;
}

const CAROUSEL = '.content-gallery[data-layout="carousel"]';
const MOUNT_CLASS = 'gallery-controls-mount';

/** Idempotent: strict mode may run the effect twice, and this reuses the node. */
function controlsMount(gallery: HTMLElement): HTMLElement {
  const next = gallery.nextElementSibling;
  if (next instanceof HTMLElement && next.classList.contains(MOUNT_CLASS)) return next;
  const node = document.createElement('div');
  node.className = MOUNT_CLASS;
  gallery.after(node);
  return node;
}

function slidesOf(gallery: Element): Slide[] {
  return Array.from(gallery.querySelectorAll('figure')).map((figure) => {
    const img = figure.querySelector('img');
    return {
      // data-full is the big version. Falling back to src is what makes this
      // work on galleries published before the feature existed.
      src: img?.getAttribute('data-full') || img?.getAttribute('src') || '',
      alt: img?.getAttribute('alt') || '',
      caption: figure.querySelector('figcaption')?.textContent?.trim() || '',
    };
  });
}

export default function GalleryEnhancer({ articleId }: { articleId?: string }) {
  const [carousels, setCarousels] = useState<HTMLElement[]>([]);
  const [lightbox, setLightbox] = useState<{ slides: Slide[]; index: number } | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  /* Find the carousels — after mount, so the server render stays empty. */
  useEffect(() => {
    const root = document.getElementById('article-body');
    if (!root) return;
    const found = Array.from(root.querySelectorAll<HTMLElement>(CAROUSEL));
    setCarousels(found);
    return () => {
      found.forEach((gallery) => {
        const next = gallery.nextElementSibling;
        if (next instanceof HTMLElement && next.classList.contains(MOUNT_CLASS)) next.remove();
      });
      setCarousels([]);
    };
  }, [articleId]);

  /* Click-to-enlarge: one delegated listener, and the ARIA the sanitiser won't carry. */
  useEffect(() => {
    const root = document.getElementById('article-body');
    if (!root) return;

    const figures = Array.from(root.querySelectorAll<HTMLElement>('.content-gallery figure'));
    figures.forEach((figure) => {
      figure.setAttribute('role', 'button');
      figure.setAttribute('tabindex', '0');
      const alt = figure.querySelector('img')?.getAttribute('alt');
      figure.setAttribute('aria-label', alt ? `تكبير الصورة: ${alt}` : 'تكبير الصورة');
    });

    const open = (figure: HTMLElement) => {
      const gallery = figure.closest('.content-gallery');
      if (!gallery) return;
      const index = Array.from(gallery.querySelectorAll('figure')).indexOf(figure);
      opener.current = figure;
      setLightbox({ slides: slidesOf(gallery), index: Math.max(0, index) });
    };

    const figureFrom = (target: EventTarget | null) =>
      (target as HTMLElement)?.closest?.('.content-gallery figure') as HTMLElement | null;

    const onClick = (event: MouseEvent) => {
      const figure = figureFrom(event.target);
      if (figure) open(figure);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const figure = figureFrom(event.target);
      if (!figure) return;
      event.preventDefault();
      open(figure);
    };

    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKeyDown);
    return () => {
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKeyDown);
      figures.forEach((figure) => {
        figure.removeAttribute('role');
        figure.removeAttribute('tabindex');
        figure.removeAttribute('aria-label');
      });
    };
  }, [articleId]);

  const close = useCallback(() => {
    setLightbox(null);
    opener.current?.focus();
    opener.current = null;
  }, []);

  return (
    <>
      {carousels.map((gallery, i) =>
        createPortal(<CarouselControls gallery={gallery} />, controlsMount(gallery), `carousel-${i}`)
      )}
      {lightbox && (
        <Lightbox
          slides={lightbox.slides}
          index={lightbox.index}
          onIndex={(index) => setLightbox((prev) => (prev ? { ...prev, index } : prev))}
          onClose={close}
        />
      )}
    </>
  );
}

/* ── Carousel arrows ───────────────────────────────────────────────── */

function CarouselControls({ gallery }: { gallery: HTMLElement }) {
  const [state, setState] = useState({ atStart: true, atEnd: false, index: 0, total: 0 });

  useEffect(() => {
    const measure = () => {
      const slides = Array.from(gallery.querySelectorAll<HTMLElement>('figure'));
      const max = gallery.scrollWidth - gallery.clientWidth;
      // Absolute value, because RTL scrollLeft is negative in some engines.
      const progress = max > 0 ? Math.abs(gallery.scrollLeft) / max : 0;
      setState({
        atStart: progress <= 0.02,
        atEnd: progress >= 0.98,
        index: Math.round(progress * Math.max(0, slides.length - 1)),
        total: slides.length,
      });
    };

    measure();
    // The effect runs before lazy images have loaded, so one measurement is
    // never enough.
    const observer = new ResizeObserver(measure);
    observer.observe(gallery);
    gallery.addEventListener('scroll', measure, { passive: true });
    return () => {
      observer.disconnect();
      gallery.removeEventListener('scroll', measure);
    };
  }, [gallery]);

  const step = (direction: -1 | 1) => {
    const slides = Array.from(gallery.querySelectorAll<HTMLElement>('figure'));
    if (!slides.length) return;
    const target = slides[Math.min(slides.length - 1, Math.max(0, state.index + direction))];
    // Physical offset, consistent in every engine — unlike RTL scrollLeft.
    if (target) gallery.scrollTo({ left: target.offsetLeft - gallery.offsetLeft });
  };

  if (state.total < 2) return null;

  return (
    <div className="flex items-center justify-center gap-3 mt-2 mb-6">
      {/* RTL: the previous picture is to the right. */}
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={state.atStart}
        aria-label="الصورة السابقة"
        className="p-2 rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-accent hover:text-accent disabled:opacity-30 transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
      <span className="text-xs text-gray-400 font-arabic tabular-nums">
        {(state.index + 1).toLocaleString('ar-EG')} / {state.total.toLocaleString('ar-EG')}
      </span>
      <button
        type="button"
        onClick={() => step(1)}
        disabled={state.atEnd}
        aria-label="الصورة التالية"
        className="p-2 rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-accent hover:text-accent disabled:opacity-30 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ── Lightbox ──────────────────────────────────────────────────────── */

function Lightbox({
  slides, index, onIndex, onClose,
}: {
  slides: Slide[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const slide = slides[index];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // RTL: ArrowLeft advances, matching HeroCarousel.
      if (event.key === 'ArrowLeft') onIndex(Math.min(slides.length - 1, index + 1));
      if (event.key === 'ArrowRight') onIndex(Math.max(0, index - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, slides.length, onIndex]);

  if (!slide) return null;

  return (
    // Dialog gives us the focus trap, Escape and scroll lock for free.
    <Dialog open onClose={onClose} className="relative z-modal" dir="rtl">
      <div className="fixed inset-0 bg-black/90" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-8">
        <Dialog.Panel className="relative max-w-6xl w-full flex flex-col items-center">
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="absolute -top-2 left-0 sm:-top-10 p-2 rounded-full text-white/70 hover:text-accent-300 hover:bg-white/10 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <img
            src={slide.src}
            alt={slide.alt}
            className="max-h-[75vh] w-auto max-w-full object-contain rounded"
          />

          {slide.caption && (
            <p className="mt-4 text-sm text-white/75 font-arabic text-center max-w-2xl">
              {slide.caption}
            </p>
          )}

          {slides.length > 1 && (
            <div className="flex items-center gap-5 mt-5">
              <button
                type="button"
                onClick={() => onIndex(Math.max(0, index - 1))}
                disabled={index === 0}
                aria-label="الصورة السابقة"
                className="p-2 rounded-full text-white/70 hover:text-accent-300 hover:bg-white/10 disabled:opacity-25 transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
              <span aria-live="polite" className="text-sm text-white/60 font-arabic tabular-nums">
                {(index + 1).toLocaleString('ar-EG')} من {slides.length.toLocaleString('ar-EG')}
              </span>
              <button
                type="button"
                onClick={() => onIndex(Math.min(slides.length - 1, index + 1))}
                disabled={index === slides.length - 1}
                aria-label="الصورة التالية"
                className="p-2 rounded-full text-white/70 hover:text-accent-300 hover:bg-white/10 disabled:opacity-25 transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            </div>
          )}
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
