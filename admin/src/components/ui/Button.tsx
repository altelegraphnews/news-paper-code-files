import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react'
import { clsx } from 'clsx'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'gold' | 'secondary' | 'danger' | 'ghost' | 'outline'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  isLoading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

const variantClasses = {
  primary: 'bg-ink-900 text-gray-50 hover:bg-ink-700 focus:ring-gold-500 border border-ink-900 dark:bg-gold-500 dark:text-ink-950 dark:border-gold-600 dark:hover:bg-gold-400',
  gold: 'bg-gold-500 text-ink-950 font-semibold hover:bg-gold-400 focus:ring-gold-500 border border-gold-600',
  secondary: 'bg-surface text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gold-300 focus:ring-gold-400 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 dark:hover:bg-gray-700',
  danger: 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 focus:ring-red-500 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
  ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 focus:ring-gold-400 dark:text-gray-400 dark:hover:bg-gray-800 border border-transparent',
  outline: 'bg-transparent text-gold-700 border border-gold-500 hover:bg-gold-50 focus:ring-gold-500 dark:text-gold-300 dark:border-gold-400 dark:hover:bg-gold-900/20',
}

const sizeClasses = {
  xs: 'px-2 py-1 text-xs gap-1',
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', isLoading, leftIcon, rightIcon, children, className, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={clsx(
          'inline-flex items-center justify-center rounded-md font-medium transition-all duration-150',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    )
  }
)

Button.displayName = 'Button'
