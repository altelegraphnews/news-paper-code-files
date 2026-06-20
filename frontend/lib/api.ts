import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type {
  Article,
  Author,
  Category,
  Comment,
  CommentFormData,
  HomepageConfig,
  PaginatedArticles,
  SearchResult,
  Ticker,
  ApiResponse,
} from './types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
    return Promise.reject(error);
  }
);

// Homepage
export const fetchHomepage = async (): Promise<HomepageConfig> => {
  const response = await apiClient.get<ApiResponse<HomepageConfig>>('/homepage');
  return response.data.data;
};

// Articles
export const fetchArticles = async (params?: {
  page?: number;
  limit?: number;
  category?: string;
  tag?: string;
  author?: string;
  status?: string;
  isFeatured?: boolean;
  isBreaking?: boolean;
}): Promise<PaginatedArticles> => {
  const response = await apiClient.get<ApiResponse<PaginatedArticles>>('/articles', { params });
  return response.data.data;
};

// Article is fetched by slug via GET /articles/:slug
export const fetchArticleBySlug = async (slug: string): Promise<Article> => {
  const response = await apiClient.get<ApiResponse<Article>>(`/articles/${slug}`);
  return response.data.data;
};

export const fetchFeaturedArticles = async (limit = 5): Promise<Article[]> => {
  const response = await apiClient.get<ApiResponse<Article[]>>('/articles/featured', { params: { limit } });
  return response.data.data;
};

export const fetchBreakingArticles = async (limit = 3): Promise<Article[]> => {
  const response = await apiClient.get<ApiResponse<Article[]>>('/articles/breaking', { params: { limit } });
  return response.data.data;
};

export const fetchRelatedArticles = async (articleId: string, limit = 4): Promise<Article[]> => {
  const response = await apiClient.get<ApiResponse<Article[]>>('/search/recommendations', {
    params: { articleId, limit },
  });
  return response.data.data;
};

export const fetchMostReadArticles = async (limit = 5): Promise<Article[]> => {
  const response = await apiClient.get<ApiResponse<Article[]>>('/articles', {
    params: { limit, status: 'published', sort: '-views.total' },
  });
  return response.data.data;
};

// View count is incremented server-side on GET /articles/:slug, no separate call needed.
// This is kept for explicit client-side tracking via the analytics event endpoint.
export const trackArticleView = async (articleId: string): Promise<void> => {
  try {
    await apiClient.post('/analytics/event', { type: 'article_view', articleId });
  } catch { /* non-critical */ }
};

// Categories — backend exposes GET /categories/:slug (not /categories/slug/:slug)
export const fetchCategories = async (): Promise<Category[]> => {
  const response = await apiClient.get<ApiResponse<Category[]>>('/categories');
  return response.data.data;
};

export const fetchNavCategories = async (): Promise<Category[]> => {
  const response = await apiClient.get<ApiResponse<Category[]>>('/categories/nav');
  return response.data.data;
};

export const fetchCategoryBySlug = async (slug: string): Promise<Category> => {
  const response = await apiClient.get<ApiResponse<Category>>(`/categories/${slug}`);
  return response.data.data;
};

export const fetchCategoryArticles = async (
  slug: string,
  params?: { page?: number; limit?: number }
): Promise<PaginatedArticles> => {
  // Backend doesn't have a /categories/:slug/articles route.
  // First get the category to get its _id, then query articles.
  const catRes = await apiClient.get<ApiResponse<Category>>(`/categories/${slug}`);
  const catId = catRes.data.data._id;
  const response = await apiClient.get<ApiResponse<PaginatedArticles>>('/articles', {
    params: { category: catId, status: 'published', ...params },
  });
  return response.data.data;
};

// Authors — resolved via /users/by-slug/:slug
export const fetchAuthorBySlug = async (slug: string): Promise<Author> => {
  const response = await apiClient.get<ApiResponse<Author>>(`/users/by-slug/${slug}`);
  return response.data.data;
};

export const fetchAuthorArticles = async (
  authorId: string,
  params?: { page?: number; limit?: number }
): Promise<PaginatedArticles> => {
  const response = await apiClient.get<ApiResponse<PaginatedArticles>>('/articles', {
    params: { author: authorId, status: 'published', ...params },
  });
  return response.data.data;
};

// Tags — GET /tags?q=keyword
export const fetchTags = async (q?: string): Promise<string[]> => {
  const response = await apiClient.get<ApiResponse<string[]>>('/tags', { params: { q } });
  return response.data.data;
};

export const fetchTagArticles = async (
  tag: string,
  params?: { page?: number; limit?: number }
): Promise<PaginatedArticles> => {
  const response = await apiClient.get<ApiResponse<PaginatedArticles>>('/articles', {
    params: { tag, status: 'published', ...params },
  });
  return response.data.data;
};

// Search
export const searchArticles = async (
  query: string,
  params?: { page?: number; limit?: number; category?: string }
): Promise<SearchResult> => {
  const response = await apiClient.get<ApiResponse<SearchResult>>('/search', {
    params: { q: query, ...params },
  });
  return response.data.data;
};

// Tickers
export const fetchTickers = async (): Promise<Ticker[]> => {
  const response = await apiClient.get<ApiResponse<Ticker[]>>('/tickers');
  return response.data.data;
};

// Comments — GET /comments?articleId=:id
export const fetchComments = async (articleId: string): Promise<Comment[]> => {
  const response = await apiClient.get<ApiResponse<Comment[]>>('/comments', {
    params: { articleId },
  });
  return response.data.data;
};

export const postComment = async (data: CommentFormData): Promise<Comment> => {
  const response = await apiClient.post<ApiResponse<Comment>>('/comments', data);
  return response.data.data;
};

export default apiClient;
