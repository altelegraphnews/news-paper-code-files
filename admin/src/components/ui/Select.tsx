import { forwardRef, SelectHTMLAttributes } from 'react'
import { clsx } from 'clsx'
import { ChevronDown } from 'lucide-react'

interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  options: SelectOption[]
  placeholder?: string
  wrapperClassName?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, placeholder, wrapperClassName, className, id, ...props }, ref) => {
    const selectId = id || label?.replace(/\s/g, '-')

    return (
      <div className={clsx('w-full', wrapperClassName)}>
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            dir="rtl"
            className={clsx(
              'w-full py-2 pr-3 pl-9 rounded-md border transition-colors text-sm appearance-none',
              'bg-surface dark:bg-gray-800 text-gray-900 dark:text-gray-100',
              'focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent',
              'disabled:bg-gray-50 dark:disabled:bg-gray-700 disabled:cursor-not-allowed',
              error
                ? 'border-red-500'
                : 'border-gray-200 dark:border-gray-700',
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
        {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
        {hint && !error && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'
