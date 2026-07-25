import type { Metadata } from 'next';
import { Mail, MapPin, FileText, Image as ImageIcon, Type, Clock, Send } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Reveal from '@/components/ui/Reveal';

export const metadata: Metadata = {
  title: 'أرسل مقالك | التلغراف',
  description:
    'كيف ترسل مقالك إلى مجلة التلغراف الأدبية والثقافية عبر البريد الإلكتروني — أرسل عملك إلى submit@al-telegraph.com.',
};

const SUBMIT_EMAIL = 'submit@al-telegraph.com';

const STEPS = [
  {
    icon: FileText,
    title: 'اكتب مقالك',
    body: 'في ملف Word (‎.docx‎) أو مباشرةً في متن الرسالة — كما يحلو لك.',
  },
  {
    icon: Type,
    title: 'اجعل العنوان عنواناً',
    body: 'عنوان الرسالة (Subject) هو عنوان مقالك؛ نعتمده كما هو.',
  },
  {
    icon: ImageIcon,
    title: 'أرفق صورك',
    body: 'إن كانت لعملك صور، أرفقها بالرسالة، ونحن نتولّى إخراجها.',
  },
  {
    icon: Send,
    title: `أرسل إلى ${SUBMIT_EMAIL}`,
    body: 'تصلك رسالة تؤكّد الاستلام فور وصول مقالك إلينا.',
  },
];

const GUIDELINES = [
  'نرحّب بالمشاركات في أبواب: الشعر، السرد، القراءات النقدية، الفكر، الحوار، الترجمة.',
  'يُشترط أن تكون الأعمال المقدَّمة غير منشورة سابقاً في أيّ وسيلة إعلامية.',
  'يُستحسن أن يرافق العملَ نبذةٌ قصيرة عن الكاتب وصورةٌ شخصية.',
  'تُعلم هيئة التحرير أصحابَ الأعمال بقرارها خلال مدّةٍ أقصاها أربعة أسابيع من تاريخ الاستلام.',
];

export default function ContactPage() {
  return (
    <div className="container mx-auto px-4 max-w-3xl py-12" dir="rtl">
      <PageHeader
        kicker="خطوط التلغراف مفتوحة"
        title="أرسِل مقالك"
        subtitle="منبر التلغراف مفتوحٌ لكلمتك. أرسل عملك إلينا عبر البريد الإلكتروني، وتتولّى هيئة التحرير قراءته وإخراجه ونشره."
        crumbs={[{ label: 'أرسل مقالك' }]}
      />

      {/* Primary submission CTA */}
      <Reveal>
        <div
          className="relative rounded-sm border p-8 text-center mb-12 hover-lift"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <span className="absolute -top-px left-1/2 -translate-x-1/2 morse-line w-24" aria-hidden="true" />
          <span className="inline-flex w-12 h-12 rounded-full bg-accent/15 ring-1 ring-accent/40 items-center justify-center mb-4">
            <Mail className="w-5 h-5 text-accent-700 dark:text-accent-300" />
          </span>
          <p className="font-body text-base mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            أرسل مقالك إلى عنوان التلغراف:
          </p>
          <a
            href={`mailto:${SUBMIT_EMAIL}`}
            className="inline-block font-arabic text-xl sm:text-2xl font-bold text-accent-700 dark:text-accent-300 hover:text-accent transition-colors underline decoration-accent/40 underline-offset-8 hover:decoration-accent"
            dir="ltr"
          >
            {SUBMIT_EMAIL}
          </a>
          <p className="font-body text-sm mt-5 leading-loose" style={{ color: 'var(--color-text-muted)' }}>
            ملف Word أو نصّ في متن الرسالة — وعنوان الرسالة هو عنوان المقال.
          </p>
        </div>
      </Reveal>

      {/* How to submit — steps */}
      <Reveal>
        <h2
          className="font-heading font-bold text-2xl mb-7 flex items-center gap-4"
          style={{ color: 'var(--color-text-primary)' }}
        >
          كيف ترسل مقالك؟
          <span className="morse-line morse-line--subtle flex-1" aria-hidden="true" />
        </h2>
      </Reveal>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-14">
        {STEPS.map((step, i) => (
          <Reveal key={step.title} delay={i * 90}>
            <div
              className="relative h-full rounded-sm border p-6 pr-16 hover-lift"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              <span
                className="absolute top-6 right-5 w-9 h-9 rounded-full flex items-center justify-center font-heading font-bold text-sm"
                style={{ background: 'var(--color-surface-2)', color: 'var(--color-accent)', border: '1px solid var(--color-border)' }}
              >
                {i + 1}
              </span>
              <div className="flex items-center gap-2 mb-2">
                <step.icon className="w-4 h-4 text-accent-700 dark:text-accent-300" />
                <h3 className="font-heading font-bold text-base" style={{ color: 'var(--color-text-primary)' }} dir="rtl">
                  {step.title}
                </h3>
              </div>
              <p className="font-body text-sm leading-loose" style={{ color: 'var(--color-text-secondary)' }}>
                {step.body}
              </p>
            </div>
          </Reveal>
        ))}
      </div>

      {/* Guidelines */}
      <Reveal>
        <h2
          className="font-heading font-bold text-2xl mb-6 flex items-center gap-4"
          style={{ color: 'var(--color-text-primary)' }}
        >
          إرشادات التقديم
          <span className="morse-line morse-line--subtle flex-1" aria-hidden="true" />
        </h2>
        <ul className="space-y-4 mb-14">
          {GUIDELINES.map((line) => (
            <li key={line} className="flex gap-3 items-baseline">
              <span className="text-accent text-[0.6rem] flex-shrink-0" aria-hidden="true">◆</span>
              <span className="font-body leading-loose" style={{ color: 'var(--color-text-secondary)' }}>
                {line}
              </span>
            </li>
          ))}
        </ul>
      </Reveal>

      {/* Reply note + address */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Reveal>
          <div
            className="relative h-full rounded-sm border p-6 pt-7 hover-lift"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <span className="absolute -top-px right-6 morse-line w-16" aria-hidden="true" />
            <div className="flex items-center gap-3 mb-3">
              <span className="w-10 h-10 rounded-full bg-accent/15 ring-1 ring-accent/40 flex items-center justify-center">
                <Clock className="w-4 h-4 text-accent-700 dark:text-accent-300" />
              </span>
              <h2 className="font-heading font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>
                بعد الإرسال
              </h2>
            </div>
            <p className="font-body leading-loose text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              تصلك رسالةٌ تؤكّد وصول مقالك، ثمّ تُعلمك هيئة التحرير بقرار النشر خلال أربعة أسابيع.
            </p>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div
            className="relative h-full rounded-sm border p-6 pt-7 hover-lift"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <span className="absolute -top-px right-6 morse-line w-16" aria-hidden="true" />
            <div className="flex items-center gap-3 mb-3">
              <span className="w-10 h-10 rounded-full bg-accent/15 ring-1 ring-accent/40 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-accent-700 dark:text-accent-300" />
              </span>
              <h2 className="font-heading font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>
                العنوان
              </h2>
            </div>
            <p className="font-body leading-loose" style={{ color: 'var(--color-text-secondary)' }}>
              مجلة التلغراف الثقافية
              <br />
              بغداد، العراق
            </p>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
