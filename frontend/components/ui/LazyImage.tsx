'use client';

import Image, { ImageProps } from 'next/image';
import { useState } from 'react';
import { clsx } from 'clsx';

interface LazyImageProps extends Omit<ImageProps, 'onLoad' | 'onError'> {
  fallbackSrc?: string;
  containerClassName?: string;
  showBlur?: boolean;
}

export default function LazyImage({
  src,
  alt,
  fallbackSrc = '/images/placeholder.jpg',
  containerClassName,
  showBlur = true,
  className,
  ...props
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setCurrentSrc(fallbackSrc);
    }
  };

  return (
    <div className={clsx('relative overflow-hidden', containerClassName)}>
      {showBlur && !isLoaded && (
        <div className="absolute inset-0 skeleton" />
      )}
      <Image
        src={currentSrc}
        alt={alt}
        onLoad={handleLoad}
        onError={handleError}
        className={clsx(
          'transition-opacity duration-500',
          isLoaded ? 'opacity-100' : 'opacity-0',
          className
        )}
        {...props}
      />
    </div>
  );
}

/**
 * Responsive article hero image.
 */
export function ArticleHeroImage({
  src,
  alt,
  caption,
  credit,
  priority = false,
}: {
  src: string;
  alt: string;
  caption?: string;
  credit?: string;
  priority?: boolean;
}) {
  return (
    <figure className="mb-8">
      <LazyImage
        src={src}
        alt={alt}
        width={1200}
        height={675}
        priority={priority}
        containerClassName="rounded-xl overflow-hidden aspect-video"
        className="object-cover w-full h-full"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 960px"
      />
      {(caption || credit) && (
        <figcaption className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center">
          {caption && <span>{caption}</span>}
          {caption && credit && <span className="mx-2">·</span>}
          {credit && <span className="italic">تصوير: {credit}</span>}
        </figcaption>
      )}
    </figure>
  );
}

/**
 * Avatar image with fallback initials.
 */
export function AvatarImage({
  src,
  alt,
  name,
  size = 'md',
  className,
}: {
  src?: string;
  alt: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const sizeMap = {
    sm: { px: 32, class: 'w-8 h-8 text-xs' },
    md: { px: 48, class: 'w-12 h-12 text-sm' },
    lg: { px: 64, class: 'w-16 h-16 text-base' },
    xl: { px: 96, class: 'w-24 h-24 text-xl' },
  };

  const { px, class: sizeClass } = sizeMap[size];

  if (!src) {
    const initials = name
      ? name
          .split(' ')
          .slice(0, 2)
          .map((w) => w[0])
          .join('')
      : '?';

    return (
      <div
        className={clsx(
          'rounded-full bg-primary text-white flex items-center justify-center font-heading font-bold flex-shrink-0',
          sizeClass,
          className
        )}
        aria-label={alt}
      >
        {initials}
      </div>
    );
  }

  return (
    <LazyImage
      src={src}
      alt={alt}
      width={px}
      height={px}
      containerClassName={clsx('rounded-full flex-shrink-0', sizeClass, className)}
      className="rounded-full object-cover w-full h-full"
    />
  );
}
