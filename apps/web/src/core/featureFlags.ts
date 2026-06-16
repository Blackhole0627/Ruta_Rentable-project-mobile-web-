/**
 * Build-time feature flags (read from Vite env). Lets us ship the SAME codebase
 * as different builds — e.g. a KYC and a non-KYC APK — without branching.
 */

/**
 * Identity verification (KYC). ON by default. Build a KYC-free APK with:
 *   VITE_KYC_ENABLED=false npm run build
 * When off: the driver KYC section + admin KYC nav disappear and paid plans
 * activate without the verification gate (original behaviour).
 */
export const KYC_ENABLED =
  (import.meta.env.VITE_KYC_ENABLED as string | undefined) !== 'false';
