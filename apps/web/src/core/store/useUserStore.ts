import { create } from 'zustand';
import type { UserProfile } from '@shared/types/user.types';
import { db } from '../db/db';

interface UserState {
  user: UserProfile | null;
  isLoading: boolean;
  loadUser: () => Promise<void>;
  setUser: (user: UserProfile) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  /** Increment the free-tier calculation counter (no-op for paid plans). */
  recordCalculation: () => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  isLoading: true,
  loadUser: async () => {
    set({ isLoading: true });
    const users = await db.users.toArray();
    const user = users[0] ?? null;
    set({ user, isLoading: false });
  },
  setUser: async (user) => {
    const stamped = { ...user, updatedAt: new Date() };
    await db.users.put(stamped);
    set({ user: stamped });
  },
  completeOnboarding: async () => {
    const { user } = get();
    if (!user) return;
    const updated = { ...user, onboardingComplete: true, updatedAt: new Date() };
    await db.users.put(updated);
    set({ user: updated });
  },
  recordCalculation: async () => {
    const { user } = get();
    if (!user) return;
    const plan = user.currentPlan ?? 'free';
    if (plan !== 'free') return;
    const updated = {
      ...user,
      freeCalculationsUsed: (user.freeCalculationsUsed ?? 0) + 1,
      updatedAt: new Date(),
    };
    await db.users.put(updated);
    set({ user: updated });
  },
}));
