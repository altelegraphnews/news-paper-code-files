import { forwardRef, InputHTMLAttributes, ReactNode } from 'react'
import { clsx } from 'clsx'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  wrapperClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, wrapperClassName, className, id, ...props }, ref) => {
    const inputId = id || label?.replace(/\s/g, '-')

    return (
      <div className={clsx('w-full', wrapperClassName)}>
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              {rightIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            dir="rtl"
            className={clsx(
              'w-full py-2 rounded-md border transition-colors text-sm',
              'bg-surface dark:bg-gray-800 text-gray-900 dark:text-gray-100',
              'placeholder-gray-400 dark:placeholder-gray-500',
              'focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent',
              'disabled:bg-gray-50 dark:disabled:bg-gray-700 disabled:cursor-not-allowed',
              rightIcon ? 'pr-10 pl-3' : 'px-3',
              leftIcon ? 'pl-10' : '',
              error
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-200 dark:border-gray-700',
              className
            )}
            {...props}
          />
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              {leftIcon}
            </div>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
        {hint && !error && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
