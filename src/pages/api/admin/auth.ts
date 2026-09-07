import type { APIRoute } from 'astro';
import { verifyPassword, setAdminSession, clearAdminSession } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const action = formData.get('action');

  if (action === 'logout') {
    clearAdminSession(cookies);
    return redirect('/admin/login', 302);
  }

  const password = formData.get('password')?.toString() || '';

  if (verifyPassword(password)) {
    setAdminSession(cookies);
    return redirect('/admin', 302);
  }

  return redirect('/admin/login?error=invalid_password', 302);
};
