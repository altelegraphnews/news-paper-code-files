import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag, revalidatePath } from 'next/cache';

/**
 * On-demand cache revalidation, called by the backend after content changes
 * (e.g. reordering categories) so the site reflects them immediately instead
 * of waiting out the ISR window.
 *
 * POST /api/revalidate?secret=…&tag=nav
 * POST /api/revalidate?secret=…&path=/category/شعر
 */
export async function POST(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const secret = params.get('secret');
  if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ ok: false, message: 'unauthorized' }, { status: 401 });
  }

  const tag = params.get('tag');
  const path = params.get('path');
  if (tag) revalidateTag(tag);
  if (path) revalidatePath(path);
  if (!tag && !path) revalidateTag('nav');

  return NextResponse.json({ ok: true, revalidated: tag || path || 'nav' });
}
