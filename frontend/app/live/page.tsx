import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'بث مباشر | التلغراف',
  description: 'تغطيات مباشرة وأحداث آنية من مجلة التلغراف.',
};

export default function LivePage() {
  return (
    <div className="container mx-auto px-4 max-w-4xl py-12" dir="rtl">
      <nav
        className="rise rise-1 flex items-center justify-center gap-2 text-xs font-arabic mb-10"
        style={{ color: 'var(--color-text-muted)' }}
        aria-label="مسار التصفح"
      >
        <Link href="/" className="hover:text-accent transition-colors">الرئيسية</Link>
        <span className="text-accent" aria-hidden="true">◆</span>
        <span style={{ color: 'var(--color-text-secondary)' }}>مباشر</span>
      </nav>

      <div className="flex flex-col items-center text-center gap-5 py-14">
        {/* Idle transmitter lamp */}
        <span className="rise rise-2 relative flex w-4 h-4" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full rounded-full bg-breaking-500 opacity-60 animate-ping" />
          <span className="relative inline-flex rounded-full w-4 h-4 bg-breaking transmit-dot" />
        </span>

        <p className="rise rise-2 font-display text-accent-700 dark:text-accent-300 text-lg">
          محطة الإرسال في وضع الانتظار
        </p>

        <h1
          className="rise rise-3 font-heading font-bold text-3xl"
          style={{ color: 'var(--color-text-primary)' }}
        >
          لا توجد تغطيات مباشرة حالياً
        </h1>

        <div className="rise rise-4 wire w-full max-w-sm my-2" aria-hidden="true" />

        <p
          className="rise rise-4 font-body text-lg max-w-md leading-loose"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          تابع هذه الصفحة للاطلاع على التغطيات الأدبية والثقافية الحية حين تُنشر.
        </p>

        <Link href="/" className="rise rise-5 btn-telegraph btn-telegraph--gold btn-sheen mt-3">
          العودة للرئيسية
        </Link>
      </div>
    </div>
  );
}
