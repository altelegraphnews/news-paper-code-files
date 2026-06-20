'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

type RevealVariant = 'up' | 'fade' | 'start';

interface RevealProps {
  children: ReactNode;
  /** 'up' rises from below (default), 'fade' only fades, 'start' slides in from the reading start */
  variant?: RevealVariant;
  /** Stagger delay in ms */
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'aside' | 'li' | 'span';
}

/**
 * Reveals children with a soft rise/fade once they scroll into view.
 * The hidden initial state is applied only when JS is available
 * (html.js gate in globals.css), so content never disappears without it.
 */
export default function Reveal({
  children,
  variant = 'up',
  delay = 0,
  className,
  as: Tag = 'div',
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      data-reveal={variant === 'up' ? '' : variant}
      className={`${visible ? 'is-visible' : ''}${className ? ` ${className}` : ''}`}
      style={delay ? ({ '--reveal-delay': `${delay}ms` } as CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
