import type { APIRoute } from 'astro';
import { recordPageView } from '../../lib/db';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const data = await request.json();
    const path = (data.path || '/').toString();
    const referrer = data.referrer ? data.referrer.toString() : null;
    const userAgent = request.headers.get('user-agent') || null;
    const screenWidth = typeof data.screenWidth === 'number' ? data.screenWidth : null;

    // Retrieve or establish anonymous visitor ID
    let visitorId = data.visitorId?.toString() || cookies.get('imh_vid')?.value;
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      cookies.set('imh_vid', visitorId, {
        path: '/',
        httpOnly: false,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365, // 1 year
      });
    }

    recordPageView({
      path,
      referrer,
      userAgent,
      visitorId,
      screenWidth,
    });

    return new Response(JSON.stringify({ success: true, visitorId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
