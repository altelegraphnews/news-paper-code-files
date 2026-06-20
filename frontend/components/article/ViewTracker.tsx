'use client';

import { useEffect } from 'react';
import { API_URL } from '@/lib/api';

/**
 * Fires a real reader-view beacon once per browser session per article.
 * This is the single source of view counts — the page's server fetch is
 * ISR-cached and says nothing about actual readers.
 */
export default function ViewTracker({ articleId }: { articleId: string }) {
  useEffect(() => {
    if (!articleId) return;

    // One count per article per session — refreshes don't inflate the number
    const key = `viewed:${articleId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // sessionStorage unavailable (privacy mode) — count the view anyway
    }

    fetch(`${API_URL}/analytics/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'article_view', articleId }),
      keepalive: true,
    }).catch(() => {
      // analytics must never break reading
    });
  }, [articleId]);

  return null;
}
