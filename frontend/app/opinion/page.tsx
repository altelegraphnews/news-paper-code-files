import { redirect } from 'next/navigation';

// Legacy /opinion URL — redirect to the «فكر» section. The slug is Arabic:
// the old Latin '/category/fikr' target has 404'd since categories moved to
// Arabic slugs, so this redirect was landing crawlers on a dead page.
export default function OpinionPage() {
  redirect(`/category/${encodeURIComponent('فكر')}`);
}
