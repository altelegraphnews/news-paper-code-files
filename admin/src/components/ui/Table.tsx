import { ReactNode } from 'react'
import { clsx } from 'clsx'
import { ChevronUp, ChevronDown } from 'lucide-react'

interface Column<T> {
  key: string
  label: string
  sortable?: boolean
  width?: string
  render?: (row: T) => ReactNode
  className?: string
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyField: keyof T
  selectedIds?: string[]
  onToggleSelect?: (id: string) => void
  onSelectAll?: () => void
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onSort?: (key: string) => void
  emptyMessage?: string
  isLoading?: boolean
  className?: string
}

export function Table<T extends Record<string, unknown>>({
  columns, data, keyField, selectedIds, onToggleSelect, onSelectAll,
  sortBy, sortOrder, onSort, emptyMessage = 'لا توجد بيانات', isLoading, className,
}: TableProps<T>) {
  const allSelected = data.length > 0 && selectedIds?.length === data.length

  return (
    <div className={clsx('overflow-x-auto', className)}>
      <table className="w-full text-sm" dir="rtl">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            {onToggleSelect && (
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onSelectAll}
                  className="rounded border-gray-300 accent-gold-500 focus:ring-gold-500"
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                className={clsx(
                  'px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap',
                  col.sortable && 'cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none',
                  col.width,
                  col.className
                )}
                onClick={() => col.sortable && onSort?.(col.key)}
              >
                <div className="flex items-center justify-end gap-1">
                  {col.label}
                  {col.sortable && (
                    <span className="flex flex-col">
                      <ChevronUp
                        className={clsx('w-3 h-3 -mb-1',
                          sortBy === col.key && sortOrder === 'asc'
                            ? 'text-gold-600 dark:text-gold-300' : 'text-gray-300 dark:text-gray-600'
                        )}
                      />
                      <ChevronDown
                        className={clsx('w-3 h-3',
                          sortBy === col.key && sortOrder === 'desc'
                            ? 'text-gold-600 dark:text-gold-300' : 'text-gray-300 dark:text-gray-600'
                        )}
                      />
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {onToggleSelect && <td className="px-4 py-3" />}
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (onToggleSelect ? 1 : 0)}
                className="px-4 py-12 text-center text-sm text-gray-400 dark:text-gray-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => {
              const id = String(row[keyField])
              const isSelected = selectedIds?.includes(id) ?? false

              return (
                <tr
                  key={id}
                  className={clsx(
                    'transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30',
                    isSelected && 'bg-gold-50 dark:bg-gold-900/10'
                  )}
                >
                  {onToggleSelect && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(id)}
                        className="rounded border-gray-300 accent-gold-500 focus:ring-gold-500"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={clsx(
                        'px-4 py-3 text-sm text-gray-900 dark:text-gray-100',
                        col.className
                      )}
                    >
                      {col.render ? col.render(row) : String(row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
