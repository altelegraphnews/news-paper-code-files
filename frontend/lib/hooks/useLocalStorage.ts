'use client';

import { useState, useEffect, useCallback } from 'react';

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        console.error(`Error saving to localStorage key "${key}":`, error);
      }
    },
    [key, storedValue]
  );

  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  // Sync across tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(JSON.parse(e.newValue) as T);
        } catch {
          // Ignore
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [storedValue, setValue, removeValue];
}

/**
 * Hook to track reading history.
 */
export function useReadingHistory() {
  const [history, setHistory, clearHistory] = useLocalStorage<string[]>(
    'reading_history',
    []
  );

  const addToHistory = useCallback(
    (articleId: string) => {
      setHistory((prev) => {
        const filtered = prev.filter((id) => id !== articleId);
        return [articleId, ...filtered].slice(0, 50); // Keep last 50
      });
    },
    [setHistory]
  );

  const isRead = useCallback(
    (articleId: string) => history.includes(articleId),
    [history]
  );

  return { history, addToHistory, isRead, clearHistory };
}

/**
 * Hook to track bookmarked articles.
 */
export function useBookmarks() {
  const [bookmarks, setBookmarks, clearBookmarks] = useLocalStorage<string[]>(
    'bookmarks',
    []
  );

  const toggleBookmark = useCallback(
    (articleId: string) => {
      setBookmarks((prev) => {
        if (prev.includes(articleId)) {
          return prev.filter((id) => id !== articleId);
        }
        return [...prev, articleId];
      });
    },
    [setBookmarks]
  );

  const isBookmarked = useCallback(
    (articleId: string) => bookmarks.includes(articleId),
    [bookmarks]
  );

  return { bookmarks, toggleBookmark, isBookmarked, clearBookmarks };
}
