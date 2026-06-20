import type { Metadata } from 'next';
import { Mail, MapPin } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Reveal from '@/components/ui/Reveal';

export const metadata: Metadata = {
  title: 'اتصل بنا | التلغراف',
  description: 'تواصل مع هيئة تحرير مجلة التلغراف الثقافية والأدبية.',
};

const GUIDELINES = [
  'نرحّب بالمشاركات في أبواب: الشعر، السرد، القراءات النقدية، الفكر، الحوار، الترجمة.',
  'يُشترط أن تكون الأعمال المقدَّمة غير منشورة سابقاً في أي وسيلة إعلامية.',
  'يُرسل العمل بصيغة Word أو PDF، مرفقاً بنبذة قصيرة عن الكاتب.',
  'تُعلم هيئة التحرير أصحاب الأعمال خلال أربعة أسابيع من تاريخ الاستلام.',
];

export default function ContactPage() {
  return (
    <div className="container mx-auto px-4 max-w-3xl py-12" dir="rtl">
      <PageHeader
        kicker="خطوط التلغراف مفتوحة"
        title="اتصل بنا"
        subtitle="يسعدنا التواصل معك. سواء كنت كاتباً يودّ المشاركة، أو قارئاً لديه ملاحظة، أو مؤسسة ترغب في التعاون."
        crumbs={[{ label: 'اتصل بنا' }]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <Reveal>
          <div
            className="relative h-full rounded-sm border p-6 pt-7 hover-lift"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <span className="absolute -top-px right-6 morse-line w-16" aria-hidden="true" />
            <div className="flex items-center gap-3 mb-4">
              <span className="w-10 h-10 rounded-full bg-accent/15 ring-1 ring-accent/40 flex items-center justify-center">
                <Mail className="w-4 h-4 text-accent-700 dark:text-accent-300" />
              </span>
              <h2 className="font-heading font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>
                البريد الإلكتروني
              </h2>
            </div>
            <p className="text-sm font-body mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              للمراسلات العامة والمشاركات الأدبية:
            </p>
            <a
              href="mailto:info@altilgraf.com"
              className="inline-block font-arabic text-accent-700 dark:text-accent-300 hover:text-accent transition-colors underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
              dir="ltr"
            >
              info@altilgraf.com
            </a>
            <p className="text-sm font-body mt-5 mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              لتقديم المقالات والأعمال الإبداعية:
            </p>
            <a
              href="mailto:submissions@altilgraf.com"
              className="inline-block font-arabic text-accent-700 dark:text-accent-300 hover:text-accent transition-colors underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
              dir="ltr"
            >
              submissions@altilgraf.com
            </a>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div
            className="relative h-full rounded-sm border p-6 pt-7 hover-lift"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <span className="absolute -top-px right-6 morse-line w-16" aria-hidden="true" />
            <div className="flex items-center gap-3 mb-4">
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
