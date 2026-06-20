'use client';

import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import {
  fetchArticles,
  fetchMostReadArticles,
  fetchFeaturedArticles,
  fetchBreakingArticles,
  fetchCategoryArticles,
  fetchRelatedArticles,
} from '../api';
import type { PaginatedArticles, Article } from '../types';

const ARTICLES_PER_PAGE = 12;

export function useArticles(params?: {
  category?: string;
  subcategory?: string;
  tag?: string;
  author?: string;
  featured?: boolean;
  breaking?: boolean;
  limit?: number;
}) {
  const key = params ? ['articles', JSON.stringify(params)] : 'articles';
  const { data, error, isLoading, mutate } = useSWR<PaginatedArticles>(
    key,
    () => fetchArticles({ limit: ARTICLES_PER_PAGE, ...params })
  );

  return {
    articles: data?.articles ?? [],
    total: data?.total ?? 0,
    totalPages: data?.totalPages ?? 0,
    isLoading,
    isError: !!error,
    mutate,
  };
}

export function useInfiniteArticles(params?: {
  category?: string;
  subcategory?: string;
  tag?: string;
  limit?: number;
}) {
  const limit = params?.limit || ARTICLES_PER_PAGE;

  const getKey = (pageIndex: number, previousPageData: PaginatedArticles | null) => {
    if (previousPageData && !previousPageData.articles.length) return null;
    return ['articles-infinite', pageIndex + 1, JSON.stringify(params)];
  };

  const { data, error, isLoading, size, setSize, isValidating } = useSWRInfinite<PaginatedArticles>(
    getKey,
    ([, page]) => fetchArticles({ page: page as number, limit, ...params })
  );

  const articles = data ? data.flatMap((d) => d.articles) : [];
  const total = data?.[0]?.total ?? 0;
  const isLoadingMore = isLoading || (size > 0 && data && typeof data[size - 1] === 'undefined');
  const isEmpty = data?.[0]?.articles.length === 0;
  const isReachingEnd = isEmpty || (data && data[data.length - 1]?.articles.length < limit);

  return {
    articles,
    total,
    isLoading,
    isError: !!error,
    isLoadingMore: !!isLoadingMore,
    isReachingEnd: !!isReachingEnd,
    isValidating,
    size,
    setSize,
  };
}

export function useMostReadArticles(limit = 5) {
  const { data, error, isLoading } = useSWR<Article[]>(
    ['most-read', limit],
    () => fetchMostReadArticles(limit),
    { revalidateOnFocus: false, dedupingInterval: 300000 } // 5 min
  );

  return {
    articles: data ?? [],
    isLoading,
    isError: !!error,
  };
}

export function useFeaturedArticles(limit = 5) {
  const { data, error, isLoading } = useSWR<Article[]>(
    ['featured', limit],
    () => fetchFeaturedArticles(limit),
    { revalidateOnFocus: false }
  );

  return {
    articles: data ?? [],
    isLoading,
    isError: !!error,
  };
}

export function useBreakingArticles(limit = 3) {
  const { data, error, isLoading } = useSWR<Article[]>(
    ['breaking', limit],
    () => fetchBreakingArticles(limit),
    { refreshInterval: 60000 } // Refresh every minute
  );

  return {
    articles: data ?? [],
    isLoading,
    isError: !!error,
  };
}

export function useCategoryArticles(
  slug: string,
  params?: { page?: number; limit?: number; subcategory?: string }
) {
  const key = slug ? ['category-articles', slug, JSON.stringify(params)] : null;
  const { data, error, isLoading } = useSWR<PaginatedArticles>(
    key,
    () => fetchCategoryArticles(slug, params)
  );

  return {
    articles: data?.articles ?? [],
    total: data?.total ?? 0,
    totalPages: data?.totalPages ?? 0,
    isLoading,
    isError: !!error,
  };
}

export function useRelatedArticles(articleId: string, limit = 4) {
  const { data, error, isLoading } = useSWR<Article[]>(
    articleId ? ['related', articleId, limit] : null,
    () => fetchRelatedArticles(articleId, limit),
    { revalidateOnFocus: false }
  );

  return {
    articles: data ?? [],
    isLoading,
    isError: !!error,
  };
}
