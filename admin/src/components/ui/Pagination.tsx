import { clsx } from 'clsx'
import { ChevronRight, ChevronLeft } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  totalItems?: number
  pageSize?: number
}

export function Pagination({ currentPage, totalPages, onPageChange, totalItems, pageSize }: PaginationProps) {
  if (totalPages <= 1) return null

  const getPages = (): (number | '...')[] => {
    const pages: (number | '...')[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 3) pages.push('...')
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i)
      }
      if (currentPage < totalPages - 2) pages.push('...')
      pages.push(totalPages)
    }
    return pages
  }

  return (
    <div className="flex items-center justify-between" dir="rtl">
      {totalItems !== undefined && pageSize !== undefined && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          عرض{' '}
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {Math.min((currentPage - 1) * pageSize + 1, totalItems)}
          </span>{' '}
          إلى{' '}
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {Math.min(currentPage * pageSize, totalItems)}
          </span>{' '}
          من{' '}
          <span className="font-medium text-gray-700 dark:text-gray-300">{totalItems}</span>{' '}
          نتيجة
        </p>
      )}

      <div className="flex items-center gap-1">
        {/* Previous */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={clsx(
            'p-2 rounded-md text-sm transition-colors',
            currentPage === 1
              ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 hover:text-gold-700 dark:hover:bg-gray-700 dark:hover:text-gold-300'
          )}
          title="الصفحة السابقة"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {getPages().map((page, idx) =>
          page === '...' ? (
            <span key={`dots-${idx}`} className="px-2 text-gray-400">
              …
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page as number)}
              className={clsx(
                'min-w-[2rem] h-8 rounded-md text-sm font-medium transition-colors',
                page === currentPage
                  ? 'bg-ink-900 text-gray-50 dark:bg-gold-500 dark:text-ink-950'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 hover:text-gold-700 dark:hover:bg-gray-700 dark:hover:text-gold-300'
              )}
            >
              {page}
            </button>
          )
        )}

        {/* Next */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={clsx(
            'p-2 rounded-md text-sm transition-colors',
            currentPage === totalPages
              ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 hover:text-gold-700 dark:hover:bg-gray-700 dark:hover:text-gold-300'
          )}
          title="الصفحة التالية"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
