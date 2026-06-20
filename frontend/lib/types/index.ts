export interface Article {
  _id: string;
  title: string;
  subtitle?: string;
  slug: string;
  excerpt?: string;
  content?: string;
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };
  ogImage: {
    url: string;
    alt: string;
    caption?: string;
    credit?: string;
  };
  category: Category;
  subcategory?: Category;
  tags: string[];
  author: Author;
  status: 'draft' | 'pending' | 'scheduled' | 'published' | 'archived';
  isFeatured: boolean;
  isBreaking: boolean;
  isSponsored: boolean;
  publishedAt: string;
  updatedAt: string;
  views: {
    total: number;
  };
  readingTimeMin: number;
  commentsEnabled: boolean;
  commentsCount: number;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parent?: string;
  subcategories?: Category[];
  articleCount?: number;
  color?: string;
}

export interface Author {
  _id: string;
  name: string;
  authorSlug: string;
  avatar?: string;
  bio?: string;
  email?: string;
  social?: {
    twitter?: string;
    facebook?: string;
    instagram?: string;
  };
  articleCount?: number;
  joinedAt?: string;
}

export interface Comment {
  _id: string;
  articleId: string;
  parentId?: string;
  author: {
    name: string;
    email?: string;
    avatar?: string;
  };
  content: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  replies?: Comment[];
  likesCount?: number;
}

export interface Ticker {
  _id: string;
  text: string;
  url?: string;
  isActive: boolean;
  order: number;
}

export interface HomepageConfig {
  hero: Article | null;
  featured: Article[];
  latest: Article[];
  breaking: Article[];
  categories: Category[];
  categoryRows: CategorySection[];
  opinion: Article[];
  mostRead: Article[];
  tickers: Ticker[];
  generatedAt?: string;
}

export interface CategorySection {
  category: Category;
  articles: Article[];
}

export interface MediaItem {
  _id: string;
  title: string;
  type: 'video' | 'podcast' | 'infographic' | 'gallery';
  thumbnail: string;
  url?: string;
  duration?: string;
  publishedAt: string;
}

export interface SearchResult {
  articles: Article[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  query: string;
}

export interface PaginatedArticles {
  articles: Article[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface NewsletterSubscription {
  email: string;
  name?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface SocialShareData {
  url: string;
  title: string;
  description?: string;
  image?: string;
}

export interface SEOData {
  title: string;
  description: string;
  keywords?: string[];
  ogImage?: string;
  ogType?: string;
  canonical?: string;
  publishedAt?: string;
  updatedAt?: string;
  author?: string;
  category?: string;
}

export interface NavItem {
  label: string;
  href: string;
  subcategories?: NavSubItem[];
}

export interface NavSubItem {
  label: string;
  href: string;
  description?: string;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ArticleCardVariant {
  variant: 'hero' | 'featured' | 'standard' | 'compact' | 'horizontal';
}

export interface CommentFormData {
  name: string;
  email: string;
  content: string;
  parentId?: string;
  honeypot?: string;
}

export interface NewsletterFormData {
  email: string;
  name?: string;
  honeypot?: string;
}
