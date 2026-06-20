import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'الصفحة غير موجودة | التلغراف',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="min-h-[65vh] flex flex-col items-center justify-center px-4 py-16 text-center">
      <p className="rise rise-1 font-display text-accent-700 dark:text-accent-300 text-xl mb-1">
        برقية مفقودة
      </p>

      <span
        className="rise rise-2 gold-foil font-display text-[7rem] md:text-[9rem] leading-none select-none mb-6"
        aria-hidden="true"
      >
        ٤٠٤
      </span>

      {/* Telegraph wire with a traveling signal that never arrives */}
      <div className="rise rise-3 wire w-full max-w-md mb-8" aria-hidden="true" />

      <h1
        className="rise rise-3 font-heading font-bold text-2xl md:text-3xl mb-3"
        style={{ color: 'var(--color-text-primary)' }}
      >
        هذه البرقية لم تصل إلى وجهتها
      </h1>
      <p
        className="rise rise-4 font-body text-lg max-w-md mb-10 leading-loose"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        الصفحة التي تبحث عنها غير موجودة، أو ربما انقطع سلك التلغراف في مكان ما على الطريق.
      </p>

      <div className="rise rise-5 flex items-center gap-4 flex-wrap justify-center">
        <Link href="/" className="btn-telegraph btn-telegraph--gold btn-sheen">
          العودة للرئيسية
        </Link>
        <Link href="/search" className="btn-telegraph btn-telegraph--outline">
          البحث في الموقع
        </Link>
      </div>

      <p
        className="rise rise-6 mt-12 text-[0.6rem] tracking-[0.45em] text-accent/50 font-mono"
        aria-hidden="true"
      >
        ▪ ▪▪ — ▪ · — ▪▪ · ▪ —
      </p>
    </div>
  );
}
