'use client';

import { useRef, useState } from 'react';
import { API_URL } from '@/lib/api';
import { Send, Paperclip, Image as ImageIcon, CheckCircle2, Loader2, X } from 'lucide-react';

const inputClass =
  'w-full rounded-sm border px-4 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/50 transition-colors';
const inputStyle = {
  background: 'var(--color-surface)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text-primary)',
} as React.CSSProperties;

const labelClass = 'block font-arabic text-sm font-medium mb-1.5';
const labelStyle = { color: 'var(--color-text-primary)' } as React.CSSProperties;

export default function SubmitForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [docx, setDocx] = useState<File | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [website, setWebsite] = useState(''); // honeypot
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const docxRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setName(''); setEmail(''); setTitle(''); setBody(''); setDocx(null); setImages([]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setError('يرجى إدخال بريد إلكتروني صحيح.'); return; }
    if (!title && !body && !docx) { setError('يرجى كتابة المقال أو إرفاق ملف Word.'); return; }

    const fd = new FormData();
    fd.append('name', name);
    fd.append('email', email);
    fd.append('title', title);
    fd.append('body', body);
    fd.append('website', website);
    if (docx) fd.append('docx', docx);
    images.forEach((img) => fd.append('images', img));

    setStatus('sending');
    try {
      const res = await fetch(`${API_URL}/submissions/form`, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.message || 'تعذّر إرسال المقال، يرجى المحاولة لاحقاً.');
      setStatus('success');
      reset();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ ما.');
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div
        className="relative rounded-sm border p-8 text-center"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <span className="absolute -top-px left-1/2 -translate-x-1/2 morse-line w-24" aria-hidden="true" />
        <span className="inline-flex w-14 h-14 rounded-full bg-accent/15 ring-1 ring-accent/40 items-center justify-center mb-4">
          <CheckCircle2 className="w-6 h-6 text-accent-700 dark:text-accent-300" />
        </span>
        <h3 className="font-heading font-bold text-xl mb-2" style={{ color: 'var(--color-text-primary)' }}>
          تسلَّمنا مقالك بكلّ تقدير
        </h3>
        <p className="font-body leading-loose text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          وصلَتْنا مساهمتك، وستصلك رسالةٌ على بريدك تؤكّد الاستلام.
          <br />
          تُعلمك هيئة التحرير بقرارها خلال يومٍ إلى أربعة أيام.
        </p>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="mt-6 font-arabic text-sm text-accent-700 dark:text-accent-300 hover:text-accent underline decoration-accent/40 underline-offset-4"
        >
          إرسال مقال آخر
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="relative rounded-sm border p-6 sm:p-8"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <span className="absolute -top-px right-8 morse-line w-20" aria-hidden="true" />

      {/* Honeypot — hidden from users */}
      <input
        type="text" tabIndex={-1} autoComplete="off" value={website}
        onChange={(e) => setWebsite(e.target.value)}
        // Clipped rather than pushed off-screen. `left: -9999px` made the
        // document ~10,000px wide, and `overflow-x: hidden` lives only on
        // `body`, never `html` — which does not contain it on mobile. Safari
        // then sized the layout viewport to the document and zoomed out to fit,
        // so the whole page rendered tiny and mis-scaled. This hides the input
        // without giving it any position outside the page.
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          clipPath: 'inset(50%)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
        aria-hidden="true"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} style={labelStyle}>الاسم</label>
          <input className={inputClass} style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمك كما يظهر في التوقيع" />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>البريد الإلكتروني <span className="text-accent">*</span></label>
          <input type="email" dir="ltr" className={inputClass} style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
      </div>

      <div className="mt-4">
        <label className={labelClass} style={labelStyle}>عنوان المقال</label>
        <input className={inputClass} style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان مقالك" />
      </div>

      <div className="mt-4">
        <label className={labelClass} style={labelStyle}>نصّ المقال</label>
        <textarea
          className={`${inputClass} resize-y min-h-[180px] leading-loose`}
          style={inputStyle}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="اكتب مقالك هنا… أو أرفق ملف Word في الأسفل."
          rows={9}
        />
      </div>

      {/* Attachments */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        <div>
          <label className={labelClass} style={labelStyle}>أو ارفع ملف Word (‎.docx‎)</label>
          <input ref={docxRef} type="file" accept=".docx" className="hidden" onChange={(e) => setDocx(e.target.files?.[0] || null)} />
          <button
            type="button" onClick={() => docxRef.current?.click()}
            className="w-full rounded-sm border border-dashed px-4 py-2.5 text-sm font-body flex items-center gap-2 hover:border-accent/50 transition-colors"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            <Paperclip className="w-4 h-4 text-accent-700 dark:text-accent-300 flex-shrink-0" />
            <span className="truncate">{docx ? docx.name : 'اختر ملف Word'}</span>
            {docx && <X className="w-3.5 h-3.5 mr-auto flex-shrink-0" onClick={(e) => { e.stopPropagation(); setDocx(null); }} />}
          </button>
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>صور (اختياري)</label>
          <input ref={imgRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => setImages(Array.from(e.target.files || []).slice(0, 6))} />
          <button
            type="button" onClick={() => imgRef.current?.click()}
            className="w-full rounded-sm border border-dashed px-4 py-2.5 text-sm font-body flex items-center gap-2 hover:border-accent/50 transition-colors"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            <ImageIcon className="w-4 h-4 text-accent-700 dark:text-accent-300 flex-shrink-0" />
            <span className="truncate">{images.length ? `${images.length} صورة مختارة` : 'اختر صوراً'}</span>
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm font-body" style={{ color: 'var(--color-danger, #9e2b25)' }}>{error}</p>
      )}

      <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
        <p className="text-xs font-body" style={{ color: 'var(--color-text-muted)' }}>
          بإرسالك المقال تُقرّ بأنه من تأليفك.
        </p>
        <button
          type="submit"
          disabled={status === 'sending'}
          className="inline-flex items-center gap-2 rounded-sm px-6 py-2.5 font-arabic font-bold text-sm text-white transition-colors disabled:opacity-60"
          style={{ background: 'var(--color-accent)' }}
        >
          {status === 'sending' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {status === 'sending' ? 'جارِ الإرسال…' : 'أرسِل المقال'}
        </button>
      </div>
    </form>
  );
}
