'use client';

import { useCallback, useEffect, useState } from 'react';
import { MessageSquare, Send, Loader2, CheckCircle2, AlertCircle, CornerUpRight, X } from 'lucide-react';
import { API_URL } from '@/lib/api';
import type { Comment } from '@/lib/types';
import { getRelativeTime } from '@/lib/utils/dateUtils';

interface CommentsProps {
  articleId: string;
  commentsEnabled?: boolean;
}

const inputClass =
  'w-full rounded-sm border px-4 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/50 transition-colors';
const inputStyle = {
  background: 'var(--color-surface)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text-primary)',
} as React.CSSProperties;
const labelClass = 'block font-arabic text-sm font-medium mb-1.5';
const labelStyle = { color: 'var(--color-text-primary)' } as React.CSSProperties;

const displayName = (c: Comment) => c.author?.name || c.guestName || 'زائر';

/** Total including replies — the API returns only approved ones. */
const countAll = (list: Comment[]) =>
  list.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0);

function Avatar({ comment }: { comment: Comment }) {
  const name = displayName(comment);
  const avatar = comment.author?.avatar;
  const url = typeof avatar === 'string' ? avatar : avatar?.url;
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={name}
      className="w-10 h-10 rounded-full object-cover flex-shrink-0 ring-1 ring-[color:var(--color-border)]"
    />
  ) : (
    <span
      className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-heading font-bold text-accent-700 dark:text-accent-300 bg-accent/15 ring-1 ring-accent/30"
      aria-hidden="true"
    >
      {name.charAt(0)}
    </span>
  );
}

function CommentItem({
  comment,
  onReply,
  isReply = false,
}: {
  comment: Comment;
  onReply?: (c: Comment) => void;
  isReply?: boolean;
}) {
  return (
    <article className={isReply ? 'pt-4' : 'py-5'}>
      <div className="flex gap-3">
        <Avatar comment={comment} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap mb-1">
            <span className="font-heading font-bold text-sm" style={{ color: 'var(--color-text-primary)' }}>
              {displayName(comment)}
            </span>
            {comment.author && (
              <span className="text-[11px] px-1.5 py-0.5 rounded-sm bg-accent/15 text-accent-700 dark:text-accent-300 font-arabic">
                من المجلة
              </span>
            )}
            <time className="text-xs" style={{ color: 'var(--color-text-muted)' }} dateTime={comment.createdAt}>
              {getRelativeTime(comment.createdAt)}
            </time>
          </div>
          <p
            className="font-body text-sm leading-relaxed whitespace-pre-line break-words"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {comment.content}
          </p>
          {/* The API nests replies one level deep, so only top-level comments
              can be replied to — a deeper reply would never be returned. */}
          {!isReply && onReply && (
            <button
              type="button"
              onClick={() => onReply(comment)}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-arabic text-accent-700 dark:text-accent-300 hover:text-accent transition-colors"
            >
              <CornerUpRight className="w-3.5 h-3.5" />
              ردّ
            </button>
          )}
        </div>
      </div>

      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-2 mr-6 ps-4 border-e-2 border-[color:var(--color-border)] space-y-1">
          {comment.replies.map((reply) => (
            <CommentItem key={reply._id} comment={reply} isReply />
          ))}
        </div>
      )}
    </article>
  );
}

export default function Comments({ articleId, commentsEnabled = true }: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [content, setContent] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(`${API_URL}/comments?articleId=${articleId}&limit=50`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error();
      setComments(Array.isArray(json.data) ? json.data : []);
    } catch {
      setLoadError('تعذّر تحميل التعليقات.');
    } finally {
      setLoading(false);
    }
  }, [articleId]);

  useEffect(() => { load(); }, [load]);

  // Restore the reader's name so they don't retype it on every article.
  useEffect(() => {
    try {
      setName(localStorage.getItem('altelegraph:commenter-name') || '');
      setEmail(localStorage.getItem('altelegraph:commenter-email') || '');
    } catch { /* private mode */ }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (website) { setStatus('sent'); return; } // bot filled the hidden field
    if (!name.trim()) { setError('يرجى كتابة اسمك.'); return; }
    if (content.trim().length < 2) { setError('التعليق قصير جدًا.'); return; }
    if (content.trim().length > 2000) { setError('التعليق طويل جدًا (الحد الأقصى ٢٠٠٠ حرف).'); return; }
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setError('البريد الإلكتروني غير صحيح.'); return; }

    setStatus('sending');
    try {
      const res = await fetch(`${API_URL}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article: articleId,
          content: content.trim(),
          guestName: name.trim(),
          ...(email ? { guestEmail: email.trim() } : {}),
          ...(replyTo ? { parent: replyTo._id } : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.message || 'تعذّر إرسال التعليق، يرجى المحاولة لاحقاً.');
      }
      try {
        localStorage.setItem('altelegraph:commenter-name', name.trim());
        if (email) localStorage.setItem('altelegraph:commenter-email', email.trim());
      } catch { /* private mode */ }
      setContent('');
      setReplyTo(null);
      setStatus('sent');
      // An editor's own comment is auto-approved and appears at once.
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ ما.');
      setStatus('idle');
    }
  };

  const total = countAll(comments);

  return (
    <section id="comments" className="mt-10 pt-8 border-t border-[color:var(--color-border)]" dir="rtl">
      <h2
        className="font-heading font-bold text-xl mb-6 flex items-center gap-3"
        style={{ color: 'var(--color-text-primary)' }}
      >
        <MessageSquare className="w-5 h-5 text-accent" />
        التعليقات
        {total > 0 && (
          <span className="text-sm font-normal" style={{ color: 'var(--color-text-muted)' }}>
            ({total.toLocaleString('ar')})
          </span>
        )}
        <span className="morse-line morse-line--subtle flex-1" aria-hidden="true" />
      </h2>

      {/* ── list ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm font-arabic" style={{ color: 'var(--color-text-muted)' }}>
          <Loader2 className="w-4 h-4 animate-spin" />
          جارٍ تحميل التعليقات…
        </div>
      ) : loadError ? (
        <p className="py-6 text-sm font-arabic" style={{ color: 'var(--color-text-muted)' }}>{loadError}</p>
      ) : comments.length === 0 ? (
        <p className="py-6 text-sm font-arabic" style={{ color: 'var(--color-text-muted)' }}>
          لا توجد تعليقات بعد — كن أوّل من يشارك رأيه.
        </p>
      ) : (
        <div className="divide-y divide-[color:var(--color-border)] mb-8">
          {comments.map((c) => (
            <CommentItem key={c._id} comment={c} onReply={commentsEnabled ? setReplyTo : undefined} />
          ))}
        </div>
      )}

      {/* ── form ─────────────────────────────────────────────────────── */}
      {!commentsEnabled ? (
        <p
          className="rounded-sm border p-4 text-sm font-arabic"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
        >
          التعليقات مغلقة على هذه المادة.
        </p>
      ) : status === 'sent' ? (
        <div
          className="relative rounded-sm border p-6 text-center"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <span className="absolute -top-px left-1/2 -translate-x-1/2 morse-line w-24" aria-hidden="true" />
          <CheckCircle2 className="w-8 h-8 text-accent mx-auto mb-3" />
          <p className="font-arabic font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
            وصل تعليقك، شكراً لك
          </p>
          <p className="font-arabic text-sm" style={{ color: 'var(--color-text-muted)' }}>
            يظهر بعد مراجعته من هيئة التحرير.
          </p>
          <button
            type="button"
            onClick={() => setStatus('idle')}
            className="mt-4 text-sm font-arabic text-accent-700 dark:text-accent-300 hover:text-accent transition-colors"
          >
            كتابة تعليق آخر
          </button>
        </div>
      ) : (
        <form
          onSubmit={submit}
          className="relative rounded-sm border p-5 pt-6"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <span className="absolute -top-px right-6 morse-line w-20" aria-hidden="true" />

          <h3 className="font-heading font-bold text-base mb-4" style={{ color: 'var(--color-text-primary)' }}>
            شارك برأيك
          </h3>

          {replyTo && (
            <div
              className="flex items-center justify-between gap-3 mb-4 px-3 py-2 rounded-sm text-sm font-arabic"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)' }}
            >
              <span className="min-w-0 truncate">
                ردّاً على <strong>{displayName(replyTo)}</strong>
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                aria-label="إلغاء الردّ"
                className="flex-shrink-0 hover:text-accent transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 mb-4">
            <div>
              <label htmlFor="c-name" className={labelClass} style={labelStyle}>
                الاسم <span className="text-accent">*</span>
              </label>
              <input
                id="c-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                style={inputStyle}
                maxLength={100}
                required
                dir="rtl"
              />
            </div>
            <div>
              <label htmlFor="c-email" className={labelClass} style={labelStyle}>
                البريد الإلكتروني <span style={{ color: 'var(--color-text-muted)' }}>(اختياري، لا يُنشر)</span>
              </label>
              <input
                id="c-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                style={inputStyle}
                dir="ltr"
              />
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="c-body" className={labelClass} style={labelStyle}>
              التعليق <span className="text-accent">*</span>
            </label>
            <textarea
              id="c-body"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              maxLength={2000}
              required
              className={`${inputClass} resize-y`}
              style={inputStyle}
              dir="rtl"
              placeholder="اكتب تعليقك هنا…"
            />
            <div className="mt-1 text-xs font-arabic text-left" style={{ color: 'var(--color-text-muted)' }}>
              {content.length}/٢٠٠٠
            </div>
          </div>

          {/* Honeypot — hidden from readers, catches naive bots */}
          <input
            type="text"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute opacity-0 pointer-events-none -z-10 h-0 w-0"
          />

          {error && (
            <p className="flex items-start gap-2 mb-4 text-sm font-arabic text-red-700 dark:text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="font-arabic text-xs" style={{ color: 'var(--color-text-muted)' }}>
              تُراجَع التعليقات قبل نشرها.
            </p>
            <button
              type="submit"
              disabled={status === 'sending'}
              className="btn-sheen inline-flex items-center gap-2 px-5 py-2.5 rounded-sm bg-accent hover:bg-accent-400 text-ink font-arabic font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {status === 'sending' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {status === 'sending' ? 'جارٍ الإرسال…' : 'إرسال التعليق'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
