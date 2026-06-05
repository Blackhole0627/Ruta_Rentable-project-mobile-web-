import { create } from 'zustand';
import type {
  Cooperative,
  CoopMember,
  FleetReport,
  CooperativeParams,
  CoopInvite,
} from '@shared/types/cooperative.types';
import { getBackend } from '../backend';
import { useUserStore } from './useUserStore';

const backend = getBackend();

interface CooperativeState {
  coop: Cooperative | null;
  report: FleetReport | null;
  /** Pending invitations the driver can accept or reject. */
  invites: CoopInvite[];
  isLoading: boolean;
  error: string | null;
  /** True only for the cooperative admin (full management rights). */
  isAdmin: boolean;
  load: () => Promise<void>;
  create: (name: string) => Promise<void>;
  invite: (email: string) => Promise<CoopMember | null>;
  removeMember: (memberId: string) => Promise<void>;
  respondToInvite: (memberId: string, accept: boolean) => Promise<void>;
  leave: () => Promise<void>;
  updateParams: (params: CooperativeParams) => Promise<void>;
  payGroup: (amount: number) => Promise<void>;
}

export const useCooperativeStore = create<CooperativeState>((set, get) => ({
  coop: null,
  report: null,
  invites: [],
  isLoading: false,
  error: null,
  isAdmin: false,

  load: async () => {
    const user = useUserStore.getState().user;
    if (!user) {
      set({ coop: null, report: null, invites: [], isAdmin: false });
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const [coop, invites] = await Promise.all([
        backend.getMyCooperative(user.id),
        backend.listPendingInvites(user.id),
      ]);
      if (!coop) {
        set({ coop: null, report: null, invites, isAdmin: false, isLoading: false });
        return;
      }
      // Only the admin can read the whole fleet (RLS); members skip the report.
      const isAdmin = coop.adminId === user.id;
      const report = isAdmin ? await backend.getFleetReport(coop.id) : null;
      set({ coop, report, invites, isAdmin, isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Error al cargar la cooperativa.',
      });
    }
  },

  create: async (name) => {
    const user = useUserStore.getState().user;
    if (!user || !name.trim()) return;
    set({ error: null });
    try {
      await backend.createCooperative(user.id, name);
      await get().load();
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'No se pudo crear la cooperativa.',
      });
    }
  },

  invite: async (email) => {
    const { coop } = get();
    if (!coop) return null;
    const member = await backend.inviteDriver(coop.id, email);
    await get().load();
    return member;
  },

  removeMember: async (memberId) => {
    await backend.removeMember(memberId);
    await get().load();
  },

  respondToInvite: async (memberId, accept) => {
    await backend.respondToInvite(memberId, accept);
    await get().load();
  },

  leave: async () => {
    const user = useUserStore.getState().user;
    const { coop } = get();
    if (!user || !coop) return;
    await backend.leaveCooperative(user.id, coop.id);
    await get().load();
  },

  updateParams: async (params) => {
    const { coop } = get();
    if (!coop) return;
    await backend.updateCooperativeParams(coop.id, params);
    set({ coop: { ...coop, fleetParams: params } });
  },

  payGroup: async (amount) => {
    const { coop } = get();
    if (!coop) return;
    await backend.recordGroupPayment(coop.id, amount);
  },
}));
