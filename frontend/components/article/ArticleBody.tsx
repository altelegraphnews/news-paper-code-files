import { mediaHtml } from '@/lib/media';

interface ArticleBodyProps {
  content: string;
  className?: string;
}

/**
 * Renders the article HTML with the design system's book-grade Arabic
 * typography (.prose-arabic in globals.css): lede sizing, gold-ruled
 * headings, ornamental blockquotes, morse hr, arabic-indic lists.
 *
 * Pictures in the body are raw <img> tags, so mediaHtml points each one at a
 * stored rendition sized for reading (and maps any Cloudinary URL an older
 * article still holds onto the same file on R2).
 */
export default function ArticleBody({ content, className = '' }: ArticleBodyProps) {
  return (
    <div
      id="article-body"
      className={`prose-arabic article-content max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: mediaHtml(content) }}
      dir="rtl"
    />
  );
}
