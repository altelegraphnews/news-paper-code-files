'use client';

import { clsx } from 'clsx';

type BadgeVariant = 'primary' | 'accent' | 'breaking' | 'success' | 'warning' | 'muted';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
  children: React.ReactNode;
  pulse?: boolean;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  primary: 'bg-ink text-paper dark:bg-paper dark:text-ink',
  accent: 'bg-accent text-ink',
  breaking: 'bg-breaking text-white',
  success: 'bg-green-700 text-white',
  warning: 'bg-yellow-500 text-ink',
  muted: 'bg-primary-100 dark:bg-primary-800 text-primary-600 dark:text-primary-200',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-0.5',
  lg: 'text-sm px-3 py-1',
};

export function Badge({
  variant = 'primary',
  size = 'sm',
  className,
  children,
  pulse = false,
  dot = false,
}: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 font-arabic font-semibold rounded-sm',
        variantStyles[variant],
        sizeStyles[size],
        pulse && 'breaking-badge',
        className
      )}
    >
      {dot && (
        <span
          className={clsx(
            'w-1.5 h-1.5 rounded-full flex-shrink-0',
            pulse ? 'bg-white animate-ping' : 'bg-current opacity-75'
          )}
        />
      )}
      {children}
    </span>
  );
}

export function CategoryBadge({
  name,
  size = 'sm',
  className,
}: {
  name: string;
  size?: BadgeSize;
  className?: string;
}) {
  return (
    <Badge variant="primary" size={size} className={className}>
      {name}
    </Badge>
  );
}

export function BreakingBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="breaking"
      size="sm"
      pulse
      dot
      className={clsx('animate-pulse', className)}
    >
      عاجل
    </Badge>
  );
}

export function SponsoredBadge({ className }: { className?: string }) {
  return (
    <Badge variant="muted" size="sm" className={clsx('italic', className)}>
      إعلان
    </Badge>
  );
}

export function OpinionBadge({ className }: { className?: string }) {
  return (
    <Badge variant="accent" size="sm" className={className}>
      رأي
    </Badge>
  );
}

export default Badge;
