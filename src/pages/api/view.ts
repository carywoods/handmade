import type { APIRoute } from 'astro';
import { recordPageView } from '../../lib/db';
import { resolveGeoLocation } from '../../lib/geo';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const data = await request.json();
    const path = (data.path || '/').toString();
    const referrer = data.referrer ? data.referrer.toString() : null;
    const userAgent = request.headers.get('user-agent') || null;
    const screenWidth = typeof data.screenWidth === 'number' ? data.screenWidth : null;
    const timeZone = data.timeZone?.toString() || null;
    const language = data.language?.toString() || request.headers.get('accept-language') || null;
    const utmSource = data.utmSource?.toString() || null;
    const utmMedium = data.utmMedium?.toString() || null;
    const utmCampaign = data.utmCampaign?.toString() || null;

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

    // Resolve geographic origin from headers, client timezone, or browser language
    const geo = resolveGeoLocation({
      headers: request.headers,
      timeZone,
      language,
    });

    recordPageView({
      path,
      referrer,
      userAgent,
      visitorId,
      screenWidth,
      countryCode: geo.countryCode,
      countryName: geo.countryName,
      utmSource,
      utmMedium,
      utmCampaign,
    });

    return new Response(JSON.stringify({ success: true, visitorId, country: geo.countryCode }), {
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
