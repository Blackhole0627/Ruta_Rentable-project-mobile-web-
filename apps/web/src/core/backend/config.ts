/** Stage-2 backend configuration, read from Vite env at build time. */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

/** Emails that are granted the admin role in the mock backend (comma-separated). */
const RAW_ADMIN_EMAILS =
  (import.meta.env.VITE_ADMIN_EMAILS as string | undefined) ??
  'admin@rutarentable.com';

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
