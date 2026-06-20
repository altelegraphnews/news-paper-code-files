'use client';

import { useState } from 'react';
import { Send, Check } from 'lucide-react';

interface Props {
  variant?: 'hero' | 'mini';
}

export default function NewsletterForm({ variant = 'hero' }: Props) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
    setEmail('');
  };

  if (variant === 'mini') {
    return (
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="بريدك الإلكتروني"
          className="flex-1 min-w-0 px-3 py-2 rounded-sm text-sm font-arabic bg-white/5 border border-white/15 text-paper placeholder-white/35 focus:outline-none focus:border-accent transition-colors"
          dir="rtl"
          disabled={submitted}
        />
        <button
          type="submit"
          className="btn-sheen px-4 py-2 bg-accent hover:bg-accent-400 text-ink text-sm font-arabic font-semibold rounded-sm transition-colors"
        >
          {submitted ? <Check className="w-4 h-4" /> : 'اشترك'}
        </button>
      </form>
    );
  }

  return (
    <form
      className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
      onSubmit={handleSubmit}
    >
      {submitted ? (
        <p className="animate-fade-in flex items-center justify-center gap-2 text-accent-200 font-arabic font-medium py-3 mx-auto">
          <span className="w-6 h-6 rounded-full bg-accent text-ink flex items-center justify-center">
            <Check className="w-4 h-4" />
          </span>
          شكراً! تم تسجيل بريدك الإلكتروني
        </p>
      ) : (
        <>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="بريدك الإلكتروني"
            className="flex-1 px-4 py-3 rounded-sm bg-white/5 text-paper placeholder:text-white/40 border border-white/15 focus:outline-none focus:border-accent focus:bg-white/10 text-right font-arabic transition-all duration-300"
            required
          />
          {/* honeypot */}
          <input type="text" name="website" className="hidden" tabIndex={-1} aria-hidden />
          <button
            type="submit"
            className="btn-sheen group flex items-center justify-center gap-2 px-6 py-3 bg-accent text-ink font-arabic font-bold rounded-sm hover:bg-accent-400 hover:shadow-gold transition-all duration-300 whitespace-nowrap"
          >
            اشترك الآن
            <Send className="w-4 h-4 rtl-flip transition-transform duration-300 group-hover:-translate-x-1" />
          </button>
        </>
      )}
    </form>
  );
}
