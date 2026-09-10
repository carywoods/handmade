import type { APIRoute } from 'astro';
import { recordItemClick, getItemByAsin } from '../../lib/db';
import { formatAffiliateUrl, normalizeAsin, isValidAsin } from '../../lib/affiliate';

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
  const url = new URL(request.url);
  const rawAsin = url.searchParams.get('asin');

  if (!rawAsin) {
    return new Response(JSON.stringify({ error: 'Missing ASIN parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const cleanAsin = normalizeAsin(rawAsin);
  if (!cleanAsin) {
    return new Response(
      JSON.stringify({
        error: `Invalid ASIN format: "${rawAsin}". ASIN must be exactly 10 alphanumeric characters.`,
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const item = getItemByAsin(cleanAsin);
  const visitorId = cookies.get('imh_vid')?.value || url.searchParams.get('vid') || null;
  const referrer = request.headers.get('referer') || null;

  // Record outbound affiliate click in SQLite with visitor attribution
  recordItemClick(cleanAsin, item?.id || null, visitorId, referrer);

  // Redirect to Amazon with programmatic affiliate tag injected
  const destination = formatAffiliateUrl(cleanAsin);
  return redirect(destination, 302);
};
