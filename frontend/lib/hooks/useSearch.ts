'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { searchArticles } from '../api';
import type { Article, SearchResult } from '../types';

interface UseSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  results: Article[];
  fullResults: SearchResult | null;
  isLoading: boolean;
  isError: boolean;
  totalResults: number;
  search: (q: string, page?: number) => Promise<void>;
  clearSearch: () => void;
}

export function useSearch(debounceMs = 300): UseSearchReturn {
  const [query, setQueryState] = useState('');
  const [results, setResults] = useState<Article[]>([]);
  const [fullResults, setFullResults] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const search = useCallback(async (q: string, page = 1) => {
    if (!q.trim()) {
      setResults([]);
      setFullResults(null);
      setIsLoading(false);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setIsError(false);

    try {
      const data = await searchArticles(q.trim(), { page, limit: 10 });
      setFullResults(data);
      setResults(data.articles);
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setIsError(true);
        setResults([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setQuery = useCallback(
    (q: string) => {
      setQueryState(q);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (!q.trim()) {
        setResults([]);
        setFullResults(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      debounceTimerRef.current = setTimeout(() => {
        search(q);
      }, debounceMs);
    },
    [debounceMs, search]
  );

  const clearSearch = useCallback(() => {
    setQueryState('');
    setResults([]);
    setFullResults(null);
    setIsLoading(false);
    setIsError(false);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    query,
    setQuery,
    results,
    fullResults,
    isLoading,
    isError,
    totalResults: fullResults?.total ?? 0,
    search,
    clearSearch,
  };
}

/**
 * Hook for instant search preview (max 5 results).
 */
export function useInstantSearch(debounceMs = 300) {
  const { query, setQuery, results, isLoading, clearSearch } = useSearch(debounceMs);

  return {
    query,
    setQuery,
    previewResults: results.slice(0, 5),
    isLoading,
    clearSearch,
  };
}
