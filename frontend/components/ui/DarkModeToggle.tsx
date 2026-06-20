'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { clsx } from 'clsx';

interface DarkModeToggleProps {
  variant?: 'icon' | 'dropdown';
  className?: string;
}

export default function DarkModeToggle({
  variant = 'icon',
  className,
}: DarkModeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={clsx(
          'w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse',
          className
        )}
      />
    );
  }

  if (variant === 'icon') {
    const isDark = resolvedTheme === 'dark';

    return (
      <button
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        className={clsx(
          'flex items-center justify-center w-9 h-9 rounded-lg',
          'text-gray-600 dark:text-gray-300',
          'hover:bg-gray-100 dark:hover:bg-gray-800',
          'transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          className
        )}
        aria-label={isDark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
        title={isDark ? 'الوضع الفاتح' : 'الوضع الداكن'}
      >
        {isDark ? (
          <Sun className="w-5 h-5" />
        ) : (
          <Moon className="w-5 h-5" />
        )}
      </button>
    );
  }

  // Dropdown variant
  const options = [
    { value: 'light', label: 'فاتح', icon: Sun },
    { value: 'dark', label: 'داكن', icon: Moon },
    { value: 'system', label: 'النظام', icon: Monitor },
  ];

  return (
    <div className={clsx('flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1', className)}>
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-heading font-medium',
            'transition-all duration-200',
            theme === value
              ? 'bg-white dark:bg-gray-700 text-primary dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          )}
          aria-pressed={theme === value}
        >
          <Icon className="w-4 h-4" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
