'use client';

import Link from 'next/link';
import { clsx } from 'clsx';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { toEasternArabic } from '@/lib/utils/arabicUtils';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  /** Callback mode — for client-side pagination */
  onPageChange?: (page: number) => void;
  /** Link mode — renders ?page=N links under this path (server pages) */
  basePath?: string;
  className?: string;
  showPageNumbers?: boolean;
  maxVisible?: number;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  basePath,
  className,
  showPageNumbers = true,
  maxVisible = 7,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const getVisiblePages = (): (number | 'ellipsis')[] => {
    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const half = Math.floor(maxVisible / 2);
    let start = Math.max(1, currentPage - half);
    const end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    const pages: (number | 'ellipsis')[] = [];

    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push('ellipsis');
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < totalPages) {
      if (end < totalPages - 1) pages.push('ellipsis');
      pages.push(totalPages);
    }

    return pages;
  };

  const pages = getVisiblePages();
  let ellipsisCount = 0;

  // basePath may already carry a query string (e.g. /search?q=…)
  const pageHref = (page: number) => {
    if (!basePath || page <= 1) return basePath || '#';
    return `${basePath}${basePath.includes('?') ? '&' : '?'}page=${page}`;
  };

  const navButtonClass = (disabled: boolean) =>
    clsx(
      'flex items-center justify-center w-10 h-10 rounded-sm font-arabic',
      'transition-colors duration-150',
      disabled
        ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed pointer-events-none'
        : 'text-primary dark:text-primary-300 hover:bg-primary hover:text-white dark:hover:bg-primary-700'
    );

  const pageButtonClass = (isActive: boolean) =>
    clsx(
      'w-10 h-10 flex items-center justify-center rounded-sm font-arabic font-semibold text-sm',
      'transition-colors duration-150',
      isActive
        ? 'bg-primary text-white shadow-sm dark:bg-accent dark:text-ink'
        : 'text-gray-700 dark:text-gray-300 hover:bg-primary/10 dark:hover:bg-primary-700/30'
    );

  return (
    <nav
      role="navigation"
      aria-label="التصفح بين الصفحات"
      className={clsx('flex items-center justify-center gap-1 flex-wrap', className)}
    >
      {/* Previous (appears on right for RTL) */}
      {basePath ? (
        <Link
          href={pageHref(Math.max(1, currentPage - 1))}
          aria-label="الصفحة السابقة"
          aria-disabled={currentPage <= 1}
          className={navButtonClass(currentPage <= 1)}
        >
          <ChevronRight className="w-5 h-5" />
        </Link>
      ) : (
        <button
          onClick={() => onPageChange?.(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="الصفحة السابقة"
          className={navButtonClass(currentPage <= 1)}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {showPageNumbers &&
        pages.map((page) => {
          if (page === 'ellipsis') {
            ellipsisCount++;
            return (
              <span
                key={`ellipsis-${ellipsisCount}`}
                className="w-10 h-10 flex items-center justify-center text-gray-400 dark:text-gray-500 font-arabic"
                aria-hidden="true"
              >
                ...
              </span>
            );
          }

          const isActive = page === currentPage;
          return basePath ? (
            <Link
              key={page}
              href={pageHref(page)}
              aria-label={`الصفحة ${toEasternArabic(page)}`}
              aria-current={isActive ? 'page' : undefined}
              className={pageButtonClass(isActive)}
            >
              {toEasternArabic(page)}
            </Link>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange?.(page)}
              aria-label={`الصفحة ${toEasternArabic(page)}`}
              aria-current={isActive ? 'page' : undefined}
              className={pageButtonClass(isActive)}
            >
              {toEasternArabic(page)}
            </button>
          );
        })}

      {/* Next (appears on left for RTL) */}
      {basePath ? (
        <Link
          href={pageHref(Math.min(totalPages, currentPage + 1))}
          aria-label="الصفحة التالية"
          aria-disabled={currentPage >= totalPages}
          className={navButtonClass(currentPage >= totalPages)}
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
      ) : (
        <button
          onClick={() => onPageChange?.(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="الصفحة التالية"
          className={navButtonClass(currentPage >= totalPages)}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
    </nav>
  );
}
