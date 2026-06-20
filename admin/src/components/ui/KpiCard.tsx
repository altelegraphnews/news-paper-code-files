import { ReactNode } from 'react'
import { clsx } from 'clsx'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Skeleton } from './Skeleton'
import { formatNumberShort } from '../../utils/dateUtils'

interface KpiCardProps {
  title: string
  value: number | string
  icon: ReactNode
  trend?: number // percentage change
  trendLabel?: string
  color?: 'red' | 'blue' | 'green' | 'purple' | 'orange' | 'gold' | 'ink'
  isLoading?: boolean
  suffix?: string
}

const colorClasses = {
  gold:   { bg: '', icon: 'text-gold-600 dark:text-gold-300',     iconBg: 'bg-gold-100 dark:bg-gold-900/30' },
  ink:    { bg: '', icon: 'text-ink-600 dark:text-ink-300',       iconBg: 'bg-ink-100 dark:bg-ink-800/60' },
  red:    { bg: '', icon: 'text-red-600 dark:text-red-400',       iconBg: 'bg-red-100 dark:bg-red-900/30' },
  blue:   { bg: '', icon: 'text-blue-600 dark:text-blue-400',     iconBg: 'bg-blue-100 dark:bg-blue-900/30' },
  green:  { bg: '', icon: 'text-green-600 dark:text-green-400',   iconBg: 'bg-green-100 dark:bg-green-900/30' },
  purple: { bg: '', icon: 'text-purple-600 dark:text-purple-400', iconBg: 'bg-purple-100 dark:bg-purple-900/30' },
  orange: { bg: '', icon: 'text-orange-600 dark:text-orange-400', iconBg: 'bg-orange-100 dark:bg-orange-900/30' },
}

export function KpiCard({ title, value, icon, trend, trendLabel, color = 'gold', isLoading, suffix }: KpiCardProps) {
  const colors = colorClasses[color]

  if (isLoading) {
    return (
      <div className="card p-5 space-y-3">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    )
  }

  const displayValue = typeof value === 'number' ? formatNumberShort(value) : value

  return (
    <div className={clsx('card p-5 relative overflow-hidden hover-lift', colors.bg)}>
      <div className="absolute top-0 right-0 left-0 h-0.5 morse-line morse-line--subtle" />
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{title}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {displayValue}
            {suffix && <span className="text-base font-normal text-gray-500 mr-1">{suffix}</span>}
          </p>
          {trend !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              {trend > 0 ? (
                <TrendingUp className="w-3.5 h-3.5 text-green-500" />
              ) : trend < 0 ? (
                <TrendingDown className="w-3.5 h-3.5 text-red-500" />
              ) : (
                <Minus className="w-3.5 h-3.5 text-gray-400" />
              )}
              <span
                className={clsx(
                  'text-xs font-medium',
                  trend > 0 ? 'text-green-600 dark:text-green-400' :
                  trend < 0 ? 'text-red-600 dark:text-red-400' :
                  'text-gray-500'
                )}
              >
                {trend > 0 ? '+' : ''}{trend}%
              </span>
              {trendLabel && (
                <span className="text-xs text-gray-400">{trendLabel}</span>
              )}
            </div>
          )}
        </div>
        <div className={clsx('flex-shrink-0 w-11 h-11 rounded-md flex items-center justify-center', colors.iconBg)}>
          <div className={clsx('w-5 h-5', colors.icon)}>
            {icon}
          </div>
        </div>
      </div>
    </div>
  )
}
