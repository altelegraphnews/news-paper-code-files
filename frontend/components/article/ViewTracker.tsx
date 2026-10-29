'use client';

import { useEffect } from 'react';
import { API_URL } from '@/lib/api';

/**
 * An anonymous id for this browser, so the dashboard can count visitors as
 * well as views. A random string kept in this site's own storage: no name, no
 * IP, nothing shared with any other site, and clearing site data starts a new
 * one. Sent as the event's sessionId.
 */
const visitorId = (): string | undefined => {
  try {
    let id = localStorage.getItem('ate_vid');
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem('ate_vid', id);
    }
    return id;
  } catch {
    // Storage blocked — the view still counts, just not as a visitor
    return undefined;
  }
};

/**
 * Fires a real reader-view beacon once per browser session per article.
 * This is the single source of view counts — the page's server fetch is
 * ISR-cached and says nothing about actual readers.
 *
 * Sent with credentials so the API can recognise the newsroom's own browsers
 * (session cookie or the staff marker dropped at dashboard login) and leave
 * their reading out of the count. Readers carry no such cookie and are
 * unaffected.
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
      body: JSON.stringify({ type: 'article_view', articleId, sessionId: visitorId() }),
      credentials: 'include',
      keepalive: true,
    }).catch(() => {
      // analytics must never break reading
    });
  }, [articleId]);

  return null;
}
