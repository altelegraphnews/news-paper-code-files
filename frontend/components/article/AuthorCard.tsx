import Image from 'next/image';
import Link from 'next/link';
import { Author } from '@/lib/types';

interface AuthorCardProps {
  author: Author;
  publishedAt?: string;
  readingTimeMin?: number;
  className?: string;
}

export default function AuthorCard({ author, publishedAt, readingTimeMin, className = '' }: AuthorCardProps) {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <Link href={`/author/${author.authorSlug || author._id}`}>
        <div className="relative w-12 h-12 rounded-full overflow-hidden bg-primary/10 flex-shrink-0">
          {author.avatar ? (
            <Image
              src={author.avatar}
              alt={author.name}
              fill
              className="object-cover"
              sizes="48px"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-primary font-heading font-bold text-xl">
              {author.name?.charAt(0) || 'ك'}
            </span>
          )}
        </div>
      </Link>
      <div className="flex-1 min-w-0">
        <Link
          href={`/author/${author.authorSlug || author._id}`}
          className="font-heading font-semibold text-gray-900 dark:text-gray-100 hover:text-accent transition-colors block"
        >
          {author.name}
        </Link>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
          {publishedAt && (
            <time dateTime={publishedAt}>
              {new Intl.DateTimeFormat('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(publishedAt))}
            </time>
          )}
          {readingTimeMin && readingTimeMin > 0 && (
            <>
              <span>·</span>
              <span>{readingTimeMin} دقائق للقراءة</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
