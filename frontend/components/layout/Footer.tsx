import Link from 'next/link';
import { Facebook, Twitter, Youtube, Instagram, Mail, MapPin, Rss } from 'lucide-react';
import NewsletterForm from '@/components/ui/NewsletterForm';
import { fetchNavCategories } from '@/lib/api';
import { buildNavLinks, STATIC_NAV_LINKS } from '@/lib/nav';

const footerLinks = [
  { label: 'عن التلغراف', href: '/about' },
  { label: 'سياسة الخصوصية', href: '/privacy' },
  { label: 'شروط الاستخدام', href: '/terms' },
];

const socialLinks = [
  { label: 'فيسبوك', href: 'https://facebook.com/altilgraf', icon: Facebook },
  { label: 'تويتر / إكس', href: 'https://twitter.com/altilgraf', icon: Twitter },
  { label: 'يوتيوب', href: 'https://youtube.com/@altilgraf', icon: Youtube },
  { label: 'إنستغرام', href: 'https://instagram.com/altilgraf', icon: Instagram },
];

export default async function Footer() {
  const year = new Date().getFullYear();

  // Categories are fetched from the API so deleting one removes it here too.
  // Fall back to just the static pages if the backend is unreachable.
  let footerCategories = STATIC_NAV_LINKS;
  try {
    footerCategories = buildNavLinks(await fetchNavCategories());
  } catch {
    /* backend unavailable — show static links only */
  }

  return (
    <footer className="footer relative bg-ink text-paper mt-20 overflow-hidden" dir="rtl">
      {/* Morse top border */}
      <span aria-hidden="true" className="absolute top-0 inset-x-0 morse-line morse-line--animated opacity-50" />

      {/* Giant outlined watermark */}
      <span
        aria-hidden="true"
        className="watermark-text absolute -bottom-10 left-1/2 -translate-x-1/2 text-[22vw] leading-none whitespace-nowrap"
      >
        التلغراف
      </span>

      {/* Main footer content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link href="/" className="inline-block mb-5">
              <span className="gold-foil font-display text-4xl leading-none">التلغراف</span>
            </Link>
            <p className="text-sm font-body text-paper/65 leading-loose mb-6">
              التلغراف — مجلة ثقافية وأدبية تُعنى بالشعر والسرد والقراءات النقدية والفكر والترجمة. منبر مفتوح للكتّاب والمبدعين العرب.
            </p>

            {/* Social links */}
            <div className="flex items-center gap-3">
              {socialLinks.map(({ label, href, icon: Icon }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-9 h-9 rounded-full border border-white/15 hover:border-accent hover:bg-accent hover:text-ink text-paper/80 flex items-center justify-center transition-all duration-300 hover:-translate-y-1"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
              <a
                href="/feed.xml"
                aria-label="RSS"
                className="w-9 h-9 rounded-full border border-white/15 hover:border-accent hover:bg-accent hover:text-ink text-paper/80 flex items-center justify-center transition-all duration-300 hover:-translate-y-1"
              >
                <Rss className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Categories */}
          <div>
            <h3 className="font-heading font-bold text-lg mb-5 text-accent-300 flex items-center gap-3">
              الأقسام
              <span className="morse-line morse-line--subtle w-12" aria-hidden="true" />
            </h3>
            <ul className="space-y-2.5">
              {footerCategories.map((cat) => (
                <li key={cat.href}>
                  <Link
                    href={cat.href}
                    className="group text-sm font-arabic text-paper/65 hover:text-accent-300 transition-colors duration-200 flex items-center gap-2"
                  >
                    <span className="w-1 h-1 rounded-full bg-accent/50 flex-shrink-0 transition-transform duration-300 group-hover:scale-[1.75]" />
                    {cat.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="font-heading font-bold text-lg mb-5 text-accent-300 flex items-center gap-3">
              روابط سريعة
              <span className="morse-line morse-line--subtle w-12" aria-hidden="true" />
            </h3>
            <ul className="space-y-2.5">
              {footerLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="group text-sm font-arabic text-paper/65 hover:text-accent-300 transition-colors duration-200 flex items-center gap-2"
                  >
                    <span className="w-1 h-1 rounded-full bg-accent/50 flex-shrink-0 transition-transform duration-300 group-hover:scale-[1.75]" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-heading font-bold text-lg mb-5 text-accent-300 flex items-center gap-3">
              تواصل معنا
              <span className="morse-line morse-line--subtle w-12" aria-hidden="true" />
            </h3>
            <div className="space-y-3">
              <a
                href="mailto:info@altilgraf.com"
                className="flex items-start gap-3 text-sm font-arabic text-paper/65 hover:text-accent-300 transition-colors"
              >
                <Mail className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>info@altilgraf.com</span>
              </a>
              <div className="flex items-start gap-3 text-sm font-arabic text-paper/65">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>بغداد، العراق</span>
              </div>
            </div>

            {/* Newsletter mini */}
            <div className="mt-6">
              <p className="text-xs font-arabic text-paper/50 mb-2.5">اشترك في النشرة البريدية</p>
              <NewsletterForm variant="mini" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="relative border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs font-arabic text-paper/45 text-center sm:text-right">
            © {year} التلغراف. جميع الحقوق محفوظة. يُحظر إعادة نشر أي محتوى دون إذن.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-xs font-arabic text-paper/40 hover:text-accent-300 transition-colors">
              الخصوصية
            </Link>
            <Link href="/terms" className="text-xs font-arabic text-paper/40 hover:text-accent-300 transition-colors">
              الشروط
            </Link>
            <Link href="/sitemap.xml" className="text-xs font-arabic text-paper/40 hover:text-accent-300 transition-colors">
              خريطة الموقع
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
