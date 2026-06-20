import type { Metadata } from 'next';
import Link from 'next/link';
import PageHeader from '@/components/layout/PageHeader';
import Reveal from '@/components/ui/Reveal';

export const metadata: Metadata = {
  title: 'هيئة التحرير | التلغراف',
  description: 'تعرّف على هيئة تحرير مجلة التلغراف الثقافية والأدبية.',
};

interface EditorMember {
  name: string;
  role: string;
  bio: string;
}

const EDITORIAL_BOARD: EditorMember[] = [
  {
    name: 'رئيس التحرير',
    role: 'رئيس التحرير',
    bio: 'يُشرف على التوجه التحريري العام للمجلة ويضمن الانسجام بين أقسامها المختلفة.',
  },
  {
    name: 'مدير التحرير',
    role: 'مدير التحرير',
    bio: 'يتولى الإشراف على المواد قبل النشر ويتابع الكتّاب والمحررين.',
  },
  {
    name: 'محرر الشعر والسرد',
    role: 'محرر',
    bio: 'مسؤول عن بابَي الشعر والسرد، ويتابع المشهد الإبداعي العربي.',
  },
  {
    name: 'محرر القراءات والفكر',
    role: 'محرر',
    bio: 'يُشرف على بابَي القراءات النقدية والفكر، وينسّق الملفات الثقافية.',
  },
  {
    name: 'محرر الترجمة',
    role: 'محرر',
    bio: 'يتولى الإشراف على باب الترجمة ومتابعة الأدب العالمي المترجم إلى العربية.',
  },
];

export default function EditorialBoardPage() {
  return (
    <div className="container mx-auto px-4 max-w-4xl py-12" dir="rtl">
      <PageHeader
        kicker="من يكتب البرقيات"
        title="هيئة التحرير"
        subtitle="يضمّ التلغراف نخبة من الكتّاب والمثقفين العرب الذين يعملون معاً على تقديم محتوى ثقافي وأدبي رصين وجريء."
        crumbs={[{ label: 'هيئة التحرير' }]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-14">
        {EDITORIAL_BOARD.map((member, i) => (
          <Reveal key={member.name} delay={(i % 2) * 110}>
            <div
              className="group relative h-full rounded-sm border p-6 pt-7 hover-lift transition-colors hover:border-accent/50"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              <span className="absolute -top-px right-6 morse-line w-16" aria-hidden="true" />
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-full bg-accent/15 ring-1 ring-accent/40 flex items-center justify-center flex-shrink-0 transition-shadow duration-300 group-hover:ring-2 group-hover:ring-accent/70">
                  <span className="font-display text-accent-700 dark:text-accent-300 text-2xl leading-none pb-1">
                    {member.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <h2
                    className="font-heading font-bold text-lg mb-1.5"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {member.name}
                  </h2>
                  <span className="inline-block text-xs font-arabic font-semibold text-accent-700 dark:text-accent-300 border border-accent/40 px-2 py-0.5 rounded-sm">
                    {member.role}
                  </span>
                  <p
                    className="text-sm font-body leading-loose mt-3"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {member.bio}
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <div className="relative overflow-hidden rounded-sm bg-ink px-8 py-12 text-center">
          <span aria-hidden="true" className="absolute inset-x-0 top-5 morse-line morse-line--animated opacity-20" />
          <span aria-hidden="true" className="absolute inset-x-0 bottom-5 morse-line morse-line--animated opacity-20" />
          <span
            aria-hidden="true"
            className="absolute -top-24 right-1/2 translate-x-1/2 w-96 h-48 rounded-full bg-accent/15 blur-3xl"
          />
          <div className="relative">
            <h2 className="font-heading font-bold text-2xl text-paper mb-3">
              للتواصل مع هيئة التحرير
            </h2>
            <p className="text-paper/65 font-body mb-7 max-w-md mx-auto">
              لأي استفسارات أو مراسلات تحريرية، خطوطنا مفتوحة دائماً.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <a href="mailto:info@altilgraf.com" className="btn-telegraph btn-telegraph--gold btn-sheen" dir="ltr">
                info@altilgraf.com
              </a>
              <Link
                href="/contact"
                className="text-sm font-arabic text-paper/70 hover:text-accent-300 transition-colors"
              >
                صفحة الاتصال الكاملة ←
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
