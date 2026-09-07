import type { APIRoute } from 'astro';
import { recordItemClick, getItemByAsin } from '../../lib/db';
import { formatAffiliateUrl } from '../../lib/affiliate';

export const GET: APIRoute = async ({ request, redirect }) => {
  const url = new URL(request.url);
  const asin = url.searchParams.get('asin');

  if (!asin) {
    return new Response('Missing ASIN parameter', { status: 400 });
  }

  const cleanAsin = asin.trim().toUpperCase();
  const item = getItemByAsin(cleanAsin);

  // Record outbound click in SQLite
  recordItemClick(cleanAsin, item?.id || null);

  // Redirect to Amazon with affiliate tag injected
  const destination = formatAffiliateUrl(cleanAsin);
  return redirect(destination, 302);
};
