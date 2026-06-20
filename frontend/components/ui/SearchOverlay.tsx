'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, X, Clock, TrendingUp } from 'lucide-react';
import { clsx } from 'clsx';
import { useInstantSearch } from '@/lib/hooks/useSearch';
import { getRelativeTime } from '@/lib/utils/dateUtils';
import { CategoryBadge } from './Badge';
import LazyImage from './LazyImage';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const popularSearches = ['السياسة', 'الاقتصاد', 'الرياضة', 'ثقافة', 'تقنية'];

export default function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { query, setQuery, previewResults, isLoading, clearSearch } = useInstantSearch(300);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      clearSearch();
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, clearSearch]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
      if (e.key === 'Enter' && isOpen && query.trim()) {
        handleFullSearch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, query]);

  const handleFullSearch = () => {
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="search-overlay fixed inset-0 z-overlay bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="البحث"
    >
      <div className="bg-white dark:bg-surface-dark shadow-2xl max-w-3xl mx-auto mt-16 rounded-2xl overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 p-5 border-b border-gray-100 dark:border-gray-800">
          <Search className="w-6 h-6 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن الأخبار والمقالات..."
            className={clsx(
              'flex-1 text-xl font-arabic bg-transparent border-none outline-none',
              'text-gray-900 dark:text-white placeholder-gray-400',
              'rtl text-right'
            )}
            dir="rtl"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="مسح البحث"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="إغلاق البحث"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {/* Loading */}
          {isLoading && (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4 animate-pulse">
                  <div className="skeleton w-20 h-14 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-4 rounded w-full" />
                    <div className="skeleton h-4 rounded w-3/4" />
                    <div className="skeleton h-3 rounded w-24" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Search Results */}
          {!isLoading && query && previewResults.length > 0 && (
            <div className="p-3">
              <p className="text-xs text-gray-400 font-heading px-3 py-2">
                نتائج البحث عن &quot;{query}&quot;
              </p>
              {previewResults.map((article) => (
                <Link
                  key={article._id}
                  href={`/article/${article.category.slug}/${article.slug}`}
                  onClick={onClose}
                  className="flex items-start gap-4 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
                >
                  <div className="w-20 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-800">
                    <LazyImage
                      src={article.ogImage?.url || '/images/placeholder.jpg'}
                      alt={article.ogImage?.alt || article.title}
                      width={80}
                      height={56}
                      className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CategoryBadge name={article.category.name} className="mb-1" />
                    <h4 className="font-heading font-semibold text-sm text-gray-900 dark:text-white line-clamp-2 group-hover:text-primary dark:group-hover:text-accent transition-colors">
                      {article.title}
                    </h4>
                    <p className="text-xs text-gray-400 mt-1">
                      {getRelativeTime(article.publishedAt)}
                    </p>
                  </div>
                </Link>
              ))}

              {/* Full search CTA */}
              <button
                onClick={handleFullSearch}
                className="w-full mt-2 p-3 rounded-xl bg-primary/5 dark:bg-primary/20 hover:bg-primary/10 dark:hover:bg-primary/30 text-primary dark:text-accent font-heading font-semibold text-sm transition-colors text-center"
              >
                عرض جميع نتائج &quot;{query}&quot;
              </button>
            </div>
          )}

          {/* No results */}
          {!isLoading && query && previewResults.length === 0 && (
            <div className="p-8 text-center">
              <Search className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="font-heading text-gray-500 dark:text-gray-400">
                لا توجد نتائج لـ &quot;{query}&quot;
              </p>
              <p className="text-sm text-gray-400 mt-1">
                جرب كلمات بحث مختلفة
              </p>
            </div>
          )}

          {/* Empty state - show popular searches */}
          {!query && (
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-accent" />
                <span className="text-sm font-heading font-semibold text-gray-600 dark:text-gray-400">
                  الأكثر بحثاً
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {popularSearches.map((term) => (
                  <button
                    key={term}
                    onClick={() => setQuery(term)}
                    className="px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-heading hover:bg-primary hover:text-white dark:hover:bg-primary-700 transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>

              <p className="text-xs text-gray-400 mt-6 text-center font-heading">
                اضغط <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-300 font-mono text-xs">Enter</kbd> للبحث الكامل
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
