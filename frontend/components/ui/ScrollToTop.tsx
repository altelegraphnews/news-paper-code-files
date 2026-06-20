'use client';

import { useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';
import { clsx } from 'clsx';

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      onClick={scrollToTop}
      className={clsx(
        'scroll-to-top',
        'fixed bottom-6 left-6 z-50',
        'w-11 h-11 rounded-full',
        'bg-primary dark:bg-primary-700 text-white',
        'flex items-center justify-center',
        'shadow-lg hover:shadow-xl',
        'hover:bg-primary-700 dark:hover:bg-primary-600',
        'transition-all duration-300',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        isVisible
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-4 pointer-events-none'
      )}
      aria-label="العودة إلى الأعلى"
      title="العودة إلى الأعلى"
    >
      <ChevronUp className="w-5 h-5" />
    </button>
  );
}
