import type { AstroCookies } from 'astro';
import crypto from 'node:crypto';

const COOKIE_NAME = 'imh_admin_session';

function getAdminPassword(): string {
  // @ts-ignore
  return (typeof import.meta !== 'undefined' && import.meta.env?.ADMIN_PASSWORD) || process.env.ADMIN_PASSWORD || 'handmade-secret-2026';
}

function generateSessionToken(password: string): string {
  return crypto.createHmac('sha256', 'itsmadebyhand_salt_v1').update(password).digest('hex');
}

export function verifyPassword(inputPassword: string): boolean {
  const actualPassword = getAdminPassword();
  return inputPassword.trim() === actualPassword.trim();
}

export function isAdminAuthenticated(cookies: AstroCookies): boolean {
  const cookieVal = cookies.get(COOKIE_NAME)?.value;
  if (!cookieVal) return false;
  const validToken = generateSessionToken(getAdminPassword());
  return cookieVal === validToken;
}

export function setAdminSession(cookies: AstroCookies): void {
  const token = generateSessionToken(getAdminPassword());
  cookies.set(COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export function clearAdminSession(cookies: AstroCookies): void {
  cookies.delete(COOKIE_NAME, { path: '/' });
}
