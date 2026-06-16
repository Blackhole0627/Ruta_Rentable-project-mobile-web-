import { create } from 'zustand';
import type { AuthSession } from '@shared/types/auth.types';
import { getBackend } from '../backend';
import { db } from '../db/db';
import { useSyncStore } from './useSyncStore';
import { useSubscriptionStore } from './useSubscriptionStore';
import { useCooperativeStore } from './useCooperativeStore';
import { useNotificationStore } from './useNotificationStore';

type AuthStatus = 'unknown' | 'authenticated' | 'anonymous';

type OtpPurpose = 'login' | 'signup' | 'recovery';

interface AuthState {
  session: AuthSession | null;
  status: AuthStatus;
  isWorking: boolean;
  /** True when running on the offline mock backend (dev/demo). */
  isMock: boolean;
  /** Dev-only OTP code surfaced by the mock backend. */
  devCode: string | null;
  error: string | null;

  init: () => Promise<void>;
  requestOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, token: string, purpose?: OtpPurpose) => Promise<boolean>;
  signInWithPassword: (email: string, password: string) => Promise<boolean>;
  signUp: (name: string, email: string, password: string) => Promise<'done' | 'otp' | 'error'>;
  resendVerification: (email: string) => Promise<boolean>;
  updatePassword: (newPassword: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  recover: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  clearError: () => void;
}

const backend = getBackend();

let unwatchSession: (() => void) | null = null;

/** After authentication, run a sync and refresh derived stores (drivers only). */
async function syncAfterAuth(
  userId: string,
  role?: AuthSession['user']['role'],
  email?: string,
): Promise<void> {
  useSyncStore.getState().setUserId(userId);
  // A post-auth sync hiccup (RLS, offline, transient network) must NOT make
  // sign-in look like it failed: the session is already set, so swallow errors
  // here and let the next sync/focus catch up. Otherwise the caller's catch
  // returns false and the user is stranded on the login screen.
  try {
    if (email) await backend.ensureUserRow(userId, email);
    await backend.syncAdminRole();
    if (role === 'admin') return;
    await useSyncStore.getState().sync();
    refreshDerivedStores();
  } catch (err) {
    console.warn('[auth] post-auth sync failed (non-fatal):', err);
  }
}

/** Refresh plan/coop state — skipped for admin sessions (admin panel is separate). */
function refreshDerivedStores(role?: AuthSession['user']['role']): void {
  if (role === 'admin') return;
  void useSubscriptionStore.getState().load();
  void useCooperativeStore.getState().load();
  void useNotificationStore.getState().load();
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  status: 'unknown',
  isWorking: false,
  isMock: backend.isMock,
  devCode: null,
  error: null,

  init: async () => {
    const session = await backend.getSession();
    set({ session, status: session ? 'authenticated' : 'anonymous' });
    if (session) await syncAfterAuth(session.user.id, session.user.role, session.user.email);

    if (!unwatchSession) {
      let lastUserId = session?.user.id ?? null;
      unwatchSession = backend.watchSession(async (next) => {
        set({ session: next, status: next ? 'authenticated' : 'anonymous' });
        if (next) {
          if (next.user.id !== lastUserId) {
            lastUserId = next.user.id;
            await syncAfterAuth(next.user.id, next.user.role, next.user.email);
          }
          // Token refresh updates the session only — no background data reload.
        } else {
          lastUserId = null;
          useSyncStore.getState().setUserId(null);
          useNotificationStore.getState().stopRealtime();
        }
      });
    }
  },

  requestOtp: async (email) => {
    set({ isWorking: true, error: null, devCode: null });
    try {
      const { devCode } = await backend.requestOtp(email);
      set({ devCode: devCode ?? null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'No se pudo enviar el código' });
    } finally {
      set({ isWorking: false });
    }
  },

  verifyOtp: async (email, token, purpose = 'login') => {
    set({ isWorking: true, error: null });
    try {
      const session = await backend.verifyOtp(email, token, purpose);
      set({ session, status: 'authenticated', devCode: null });
      await syncAfterAuth(session.user.id, session.user.role, session.user.email);
      // Best-effort welcome email once a brand-new account is confirmed.
      if (purpose === 'signup') void backend.sendWelcomeEmail().catch(() => {});
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Código incorrecto' });
      return false;
    } finally {
      set({ isWorking: false });
    }
  },

  signInWithPassword: async (email, password) => {
    set({ isWorking: true, error: null });
    try {
      const session = await backend.signInWithPassword(email, password);
      set({ session, status: 'authenticated', devCode: null });
      await syncAfterAuth(session.user.id, session.user.role, session.user.email);
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Correo o contraseña incorrectos' });
      return false;
    } finally {
      set({ isWorking: false });
    }
  },

  signUp: async (name, email, password) => {
    set({ isWorking: true, error: null, devCode: null });
    try {
      const session = await backend.signUp(name, email, password);
      if (session) {
        set({ session, status: 'authenticated', devCode: null });
        await syncAfterAuth(session.user.id, session.user.role, session.user.email);
        return 'done';
      }
      return 'otp'; // email confirmation required → verify a code next
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'No se pudo crear la cuenta' });
      return 'error';
    } finally {
      set({ isWorking: false });
    }
  },

  resendVerification: async (email) => {
    set({ isWorking: true, error: null, devCode: null });
    try {
      const { devCode } = await backend.resendVerification(email);
      set({ devCode: devCode ?? null });
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'No se pudo reenviar el código' });
      return false;
    } finally {
      set({ isWorking: false });
    }
  },

  updatePassword: async (newPassword) => {
    set({ isWorking: true, error: null });
    try {
      await backend.updatePassword(newPassword);
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'No se pudo actualizar la contraseña' });
      return false;
    } finally {
      set({ isWorking: false });
    }
  },

  loginWithGoogle: async () => {
    set({ isWorking: true, error: null });
    try {
      const session = await backend.signInWithGoogle();
      if (session) {
        // Mock backend returns a session immediately.
        set({ session, status: 'authenticated', devCode: null });
        await syncAfterAuth(session.user.id, session.user.role, session.user.email);
        return true;
      }
      // Real backend redirects to Google; session is handled on return via init().
      return false;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'No se pudo entrar con Google' });
      return false;
    } finally {
      set({ isWorking: false });
    }
  },

  recover: async (email) => {
    set({ isWorking: true, error: null, devCode: null });
    try {
      const { devCode } = await backend.requestPasswordRecovery(email);
      set({ devCode: devCode ?? null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'No se pudo recuperar la cuenta' });
    } finally {
      set({ isWorking: false });
    }
  },

  signOut: async () => {
    await backend.signOut();
    useSyncStore.getState().setUserId(null);
    set({ session: null, status: 'anonymous' });
  },

  deleteAccount: async () => {
    set({ isWorking: true });
    try {
      await backend.deleteAccount();
      await db.delete();
      await db.open();
      useSyncStore.getState().setUserId(null);
      set({ session: null, status: 'anonymous' });
    } finally {
      set({ isWorking: false });
    }
  },

  clearError: () => set({ error: null }),
}));

export function isAuthenticated(): boolean {
  return useAuthStore.getState().status === 'authenticated';
}

export { backend };
