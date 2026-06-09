/** Stage-2 backend configuration, read from Vite env at build time. */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

/**
 * Google OAuth *Web* client ID — public (not the secret). Used by the native
 * Google Sign-In plugin to mint an ID token that Supabase then verifies. Same
 * value configured in Supabase → Auth → Providers → Google.
 */
export const GOOGLE_WEB_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined) ??
  '331595080324-b0fjr0uc189t99bu8sgqd0pjhud0cgtt.apps.googleusercontent.com';

/** Emails that are granted the admin role in the mock backend (comma-separated). */
const RAW_ADMIN_EMAILS =
  (import.meta.env.VITE_ADMIN_EMAILS as string | undefined) ??
  'blackhole45808@gmail.com';

export const ADMIN_EMAILS = RAW_ADMIN_EMAILS.split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/** True only when real, non-placeholder Supabase credentials are present. */
export function isBackendConfigured(): boolean {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  if (SUPABASE_URL.includes('your-project')) return false;
  if (SUPABASE_ANON_KEY.includes('your-anon-key')) return false;
  return true;
}

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
