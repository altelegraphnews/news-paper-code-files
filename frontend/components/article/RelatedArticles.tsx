import ArticleCard from './ArticleCard';
import { Article } from '@/lib/types';

interface RelatedArticlesProps {
  articles: Article[];
  title?: string;
}

export default function RelatedArticles({ articles, title = 'مقالات ذات صلة' }: RelatedArticlesProps) {
  if (!articles?.length) return null;

  return (
    <section className="py-8 border-t border-gray-100 dark:border-gray-800">
      <h2 className="font-heading font-bold text-2xl text-gray-900 dark:text-gray-100 mb-6">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {articles.slice(0, 3).map((article) => (
          <ArticleCard key={article._id} article={article} variant="standard" showExcerpt />
        ))}
      </div>
    </section>
  );
}
