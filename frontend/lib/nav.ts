import type { Category } from './types';

export interface NavLink {
  label: string;
  href: string;
}

// Static pages that are NOT MongoDB categories — they always appear in the nav,
// rendered after the dynamic categories.
export const STATIC_NAV_LINKS: NavLink[] = [
  { label: 'اتصل بنا', href: '/contact' },
  { label: 'الكاتب', href: '/author' },
  { label: 'هيئة التحرير', href: '/editorial-board' },
];

// Build the full nav link list from API categories + static pages.
// Categories come from GET /categories/nav, so deleting a category in the
// dashboard removes it here automatically.
export function buildNavLinks(categories: Category[] = []): NavLink[] {
  const categoryLinks: NavLink[] = categories.map((c) => ({
    label: c.name,
    href: `/category/${c.slug}`,
  }));
  return [...categoryLinks, ...STATIC_NAV_LINKS];
}
