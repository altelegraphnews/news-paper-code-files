interface ArticleBodyProps {
  content: string;
  className?: string;
}

/**
 * Renders the article HTML with the design system's book-grade Arabic
 * typography (.prose-arabic in globals.css): lede sizing, gold-ruled
 * headings, ornamental blockquotes, morse hr, arabic-indic lists.
 */
export default function ArticleBody({ content, className = '' }: ArticleBodyProps) {
  return (
    <div
      className={`prose-arabic article-content max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: content }}
      dir="rtl"
    />
  );
}
