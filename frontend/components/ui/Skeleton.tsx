'use client';

import { clsx } from 'clsx';

interface SkeletonProps {
  className?: string;
  lines?: number;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton rounded', className)} />;
}

export function SkeletonText({ lines = 3, className }: SkeletonProps) {
  return (
    <div className={clsx('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={clsx(
            'skeleton h-4 rounded',
            i === lines - 1 ? 'w-3/4' : 'w-full'
          )}
        />
      ))}
    </div>
  );
}

export function ArticleCardSkeleton({ variant = 'standard' }: { variant?: string }) {
  if (variant === 'horizontal') {
    return (
      <div className="flex gap-4 p-4 bg-white dark:bg-surface-dark rounded-xl">
        <div className="skeleton rounded-lg flex-shrink-0 w-28 h-20" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-16 rounded" />
          <div className="skeleton h-5 rounded w-full" />
          <div className="skeleton h-5 rounded w-4/5" />
          <div className="skeleton h-3 w-24 rounded" />
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="skeleton rounded-lg flex-shrink-0 w-16 h-12" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 rounded w-full" />
          <div className="skeleton h-4 rounded w-3/4" />
          <div className="skeleton h-3 w-20 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-surface-dark rounded-xl overflow-hidden shadow-card">
      <div className="skeleton aspect-video w-full" />
      <div className="p-4 space-y-3">
        <div className="skeleton h-4 w-20 rounded" />
        <div className="skeleton h-5 rounded w-full" />
        <div className="skeleton h-5 rounded w-4/5" />
        <div className="skeleton h-4 rounded w-3/4" />
        <div className="flex items-center gap-2">
          <div className="skeleton w-6 h-6 rounded-full" />
          <div className="skeleton h-3 w-24 rounded" />
          <div className="skeleton h-3 w-16 rounded mr-auto" />
        </div>
      </div>
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="relative bg-gray-200 dark:bg-gray-800 rounded-2xl overflow-hidden">
      <div className="skeleton aspect-[16/7] w-full" />
      <div className="absolute bottom-0 right-0 left-0 p-8 space-y-4">
        <div className="skeleton h-5 w-24 rounded" />
        <div className="skeleton h-8 w-3/4 rounded" />
        <div className="skeleton h-8 w-1/2 rounded" />
        <div className="skeleton h-4 w-full max-w-md rounded" />
        <div className="flex gap-3 items-center">
          <div className="skeleton w-8 h-8 rounded-full" />
          <div className="skeleton h-4 w-28 rounded" />
        </div>
      </div>
    </div>
  );
}

export function ArticlePageSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <div className="skeleton h-4 w-16 rounded" />
        <div className="skeleton h-4 w-4 rounded" />
        <div className="skeleton h-4 w-24 rounded" />
        <div className="skeleton h-4 w-4 rounded" />
        <div className="skeleton h-4 w-36 rounded" />
      </div>

      {/* Category */}
      <div className="skeleton h-6 w-20 rounded" />

      {/* Title */}
      <div className="space-y-3">
        <div className="skeleton h-10 w-full rounded" />
        <div className="skeleton h-10 w-4/5 rounded" />
      </div>

      {/* Subtitle */}
      <div className="skeleton h-6 w-3/4 rounded" />

      {/* Author + date */}
      <div className="flex items-center gap-4">
        <div className="skeleton w-12 h-12 rounded-full" />
        <div className="space-y-2">
          <div className="skeleton h-4 w-32 rounded" />
          <div className="skeleton h-3 w-24 rounded" />
        </div>
      </div>

      {/* Hero image */}
      <div className="skeleton aspect-video w-full rounded-xl" />

      {/* Content */}
      <div className="space-y-4 mt-6">
        <SkeletonText lines={5} />
        <div className="skeleton h-40 w-full rounded-xl" />
        <SkeletonText lines={4} />
        <SkeletonText lines={3} />
      </div>
    </div>
  );
}

export function CategoryRowSkeleton() {
  return (
    <section className="py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="skeleton h-7 w-32 rounded" />
        <div className="skeleton h-5 w-24 rounded" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <ArticleCardSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-surface-dark rounded-xl p-4 space-y-4">
        <div className="skeleton h-6 w-28 rounded" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="skeleton w-6 h-6 rounded" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 w-2/3 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
