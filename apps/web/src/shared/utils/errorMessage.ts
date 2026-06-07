/**
 * Extract a human-readable message from any thrown value.
 *
 * Supabase/PostgREST rejects with a plain object ({ message, details, hint,
 * code }) that is NOT an `Error` instance, so `err instanceof Error` discards
 * the real reason. This handles those shapes too, so RLS / FK / constraint
 * failures surface instead of a generic fallback.
 */
export function errMessage(err: unknown, fallback = 'Ocurrió un error.'): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const e = err as { message?: unknown; details?: unknown; hint?: unknown };
    const parts = [e.message, e.details, e.hint]
      .filter((p): p is string => typeof p === 'string' && p.length > 0);
    if (parts.length) return parts.join(' — ');
  }
  return fallback;
}
