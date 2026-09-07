import type { APIRoute } from 'astro';
import { recordPageView } from '../../lib/db';

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const path = data.path || '/';
    const referrer = data.referrer || null;
    const userAgent = request.headers.get('user-agent') || null;

    recordPageView(path, referrer, userAgent);

    return new Response(JSON.stringify({ success: true }), {
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
