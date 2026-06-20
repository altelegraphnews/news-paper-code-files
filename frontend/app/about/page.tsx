import type { Metadata } from 'next';
import Link from 'next/link';
import PageHeader from '@/components/layout/PageHeader';
import Reveal from '@/components/ui/Reveal';

export const metadata: Metadata = {
  title: 'عن التلغراف | التلغراف',
  description: 'تعرّف على مجلة التلغراف الثقافية والأدبية — رسالتها وأهدافها وتاريخها.',
};

const SECTIONS: [title: string, slug: string, desc: string][] = [
  ['المدخل', 'madkhal', 'افتتاحيات ومقالات تأسيسية تفتح نوافذ على الموضوعات الكبرى'],
  ['شعر', 'shir', 'قصائد من مختلف أشكال الكتابة الشعرية'],
  ['سرد', 'sard', 'قصص قصيرة وروايات ومقاطع سردية'],
  ['قراءات', 'qiraat', 'مراجعات نقدية للأعمال الأدبية والفكرية'],
  ['فكر', 'fikr', 'مقالات في الفلسفة والفكر والعلوم الإنسانية'],
  ['حوار', 'hiwar', 'حوارات مع الكتّاب والمفكرين والمبدعين'],
  ['ترجمة', 'tarjama', 'نصوص مترجمة من الأدب العالمي'],
  ['إصدارات', 'isdaraat', 'عروض للكتب والمنشورات الجديدة'],
];

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 max-w-3xl py-12" dir="rtl">
      <PageHeader
        kicker="مَن نحن"
        title="عن التلغراف"
        subtitle="مجلة أدبية وثقافية تصدر على الشبكة"
        crumbs={[{ label: 'عن التلغراف' }]}
      />

      <div className="drop-cap prose-arabic">
        <p>
          التلغراف مجلة ثقافية وأدبية مستقلة، تُعنى بنشر الإبداع الأدبي العربي في أشكاله المختلفة: الشعر والسرد والمسرح، إلى جانب القراءات النقدية والمقالات الفكرية والحوارات مع المبدعين والترجمات الأدبية.
        </p>
        <p>
          انطلق التلغراف من رغبة صادقة في إتاحة مساحة أدبية رحبة تجمع الأصوات الجديدة بالأصوات الراسخة، وتُعلي من شأن الكتابة الأدبية الجادة في زمن تكاثر فيه الضجيج وقلّ فيه التأمل.
        </p>
        <p>
          تُؤمن مجلة التلغراف بأن الكلمة المكتوبة بعناية واجتهاد قادرة على صنع الفارق، وأن الأدب ليس ترفاً بل حاجة إنسانية جوهرية.
        </p>
      </div>

      <div className="ornament-break text-sm py-8" aria-hidden="true">✦</div>

      <Reveal>
        <h2
          className="font-heading font-bold text-2xl mb-6 flex items-center gap-4"
          style={{ color: 'var(--color-text-primary)' }}
        >
          أبوابنا
          <span className="morse-line morse-line--subtle flex-1" aria-hidden="true" />
        </h2>

        <ul className="space-y-1">
          {SECTIONS.map(([title, slug, desc], i) => (
            <li key={slug}>
              <Link
                href={`/category/${slug}`}
                className="group flex items-baseline gap-3 rounded-sm px-3 py-2.5 -mx-3 transition-colors hover:bg-accent/5"
              >
                <span className="text-accent text-[0.6rem] flex-shrink-0" aria-hidden="true">◆</span>
                <span className="font-heading font-bold text-lg text-accent-700 dark:text-accent-300 whitespace-nowrap">
                  <span className="headline-link">{title}</span>
                </span>
                <span className="font-body" style={{ color: 'var(--color-text-secondary)' }}>
                  {desc}
                </span>
                <span
                  className="mr-auto opacity-0 -translate-x-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 text-accent hidden sm:inline"
                  aria-hidden="true"
                >
                  ←
                </span>
              </Link>
              {i < SECTIONS.length - 1 && (
                <span className="block h-px bg-[color:var(--color-border)] opacity-60" aria-hidden="true" />
              )}
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal className="mt-12">
        <div className="relative overflow-hidden rounded-sm bg-ink px-8 py-10 text-center">
          <span aria-hidden="true" className="absolute inset-x-0 top-4 morse-line morse-line--animated opacity-20" />
          <span
            aria-hidden="true"
            className="absolute -top-24 right-1/2 translate-x-1/2 w-96 h-48 rounded-full bg-accent/15 blur-3xl"
          />
          <div className="relative">
            <h2 className="font-heading font-bold text-2xl text-paper mb-3">هل لديك ما تقوله؟</h2>
            <p className="text-paper/65 font-body mb-6 max-w-md mx-auto">
              نرحّب بمشاركاتك الأدبية والفكرية. أرسل عملك وسننظر فيه بعناية.
            </p>
            <Link href="/contact" className="btn-telegraph btn-telegraph--gold btn-sheen">
              تواصل معنا
            </Link>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
