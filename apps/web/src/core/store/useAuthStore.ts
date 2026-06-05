import { create } from 'zustand';
import type { AuthSession } from '@shared/types/auth.types';
import { getBackend } from '../backend';
import { db } from '../db/db';
import { useSyncStore } from './useSyncStore';

type AuthStatus = 'unknown' | 'authenticated' | 'anonymous';

interface AuthState {
  session: AuthSession | null;
  status: AuthStatus;
  isWorking: boolean;
  /** Dev-only OTP code surfaced by the mock backend. */
  devCode: string | null;
  error: string | null;

  init: () => Promise<void>;
  requestOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<boolean>;
  signInWithPassword: (email: string, password: string) => Promise<boolean>;
  signUp: (name: string, email: string, password: string) => Promise<'done' | 'otp' | 'error'>;
  loginWithGoogle: () => Promise<boolean>;
  recover: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  clearError: () => void;
}

const backend = getBackend();

/** After authentication, run a sync and refresh derived stores. */
async function syncAfterAuth(userId: string): Promise<void> {
  useSyncStore.getState().setUserId(userId);
  await useSyncStore.getState().sync();
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  status: 'unknown',
  isWorking: false,
  devCode: null,
  error: null,

  init: async () => {
    const session = await backend.getSession();
    set({ session, status: session ? 'authenticated' : 'anonymous' });
    if (session) await syncAfterAuth(session.user.id);
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

  verifyOtp: async (email, token) => {
    set({ isWorking: true, error: null });
    try {
      const session = await backend.verifyOtp(email, token);
      set({ session, status: 'authenticated', devCode: null });
      await syncAfterAuth(session.user.id);
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
      await syncAfterAuth(session.user.id);
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Correo o contraseña incorrectos' });
      return false;
    } finally {
      set({ isWorking: false });
    }
  },

  signUp: async (name, email, password) => {
    set({ isWorking: true, error: null });
    try {
      const session = await backend.signUp(name, email, password);
      if (session) {
        set({ session, status: 'authenticated', devCode: null });
        await syncAfterAuth(session.user.id);
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

  loginWithGoogle: async () => {
    set({ isWorking: true, error: null });
    try {
      const session = await backend.signInWithGoogle();
      if (session) {
        // Mock backend returns a session immediately.
        set({ session, status: 'authenticated', devCode: null });
        await syncAfterAuth(session.user.id);
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
