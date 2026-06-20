'use client';

import { useEffect, useRef, useState, RefObject } from 'react';

interface UseIntersectionOptions extends IntersectionObserverInit {
  freezeOnceVisible?: boolean;
}

export function useIntersection<T extends Element>(
  options?: UseIntersectionOptions
): [RefObject<T>, boolean, IntersectionObserverEntry | undefined] {
  const { threshold = 0, root = null, rootMargin = '0%', freezeOnceVisible = false } =
    options ?? {};

  const elementRef = useRef<T>(null);
  const [entry, setEntry] = useState<IntersectionObserverEntry>();

  const frozen = entry?.isIntersecting && freezeOnceVisible;

  const updateEntry = ([entry]: IntersectionObserverEntry[]): void => {
    setEntry(entry);
  };

  useEffect(() => {
    const node = elementRef?.current;
    const hasIOSupport = !!window.IntersectionObserver;

    if (!hasIOSupport || frozen || !node) return;

    const observerParams = { threshold, root, rootMargin };
    const observer = new IntersectionObserver(updateEntry, observerParams);

    observer.observe(node);

    return () => observer.disconnect();
  }, [elementRef?.current, JSON.stringify(threshold), root, rootMargin, frozen]);

  return [elementRef, !!entry?.isIntersecting, entry];
}

/**
 * Hook to detect when element has scrolled past the viewport top.
 */
export function useScrolled(threshold = 50) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > threshold);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  return isScrolled;
}

/**
 * Hook for scroll progress percentage (0-100).
 */
export function useScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      setProgress(Math.min(100, Math.max(0, scrollPercent)));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return progress;
}
