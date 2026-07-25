import type { Metadata } from 'next';
import PageHeader from '@/components/layout/PageHeader';
import Reveal from '@/components/ui/Reveal';
import SubmitForm from '@/components/submit/SubmitForm';

export const metadata: Metadata = {
  title: 'أرسل مقالك | التلغراف',
  description:
    'أرسل مقالك إلى مجلة التلغراف الأدبية والثقافية مباشرةً عبر النموذج، أو بالبريد إلى submit@al-telegraph.com.',
};

const SUBMIT_EMAIL = 'submit@al-telegraph.com';

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
        subtitle="منبر التلغراف مفتوحٌ لكلمتك. املأ النموذج أدناه وأرسل عملك مباشرةً، وتتولّى هيئة التحرير قراءته وإخراجه ونشره."
        crumbs={[{ label: 'أرسل مقالك' }]}
      />

      {/* The submission form */}
      <Reveal>
        <SubmitForm />
      </Reveal>

      {/* Email fallback */}
      <Reveal>
        <p className="text-center font-body text-sm mt-6 mb-14" style={{ color: 'var(--color-text-muted)' }}>
          تفضّل البريد الإلكتروني؟ أرسل مقالك إلى{' '}
          <a
            href={`mailto:${SUBMIT_EMAIL}`}
            className="font-arabic text-accent-700 dark:text-accent-300 hover:text-accent underline decoration-accent/40 underline-offset-4"
            dir="ltr"
          >
            {SUBMIT_EMAIL}
          </a>
        </p>
      </Reveal>

      {/* Guidelines */}
      <Reveal>
        <h2
          className="font-heading font-bold text-2xl mb-6 flex items-center gap-4"
          style={{ color: 'var(--color-text-primary)' }}
        >
          إرشادات التقديم
          <span className="morse-line morse-line--subtle flex-1" aria-hidden="true" />
        </h2>
        <ul className="space-y-4">
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
    </div>
  );
}
