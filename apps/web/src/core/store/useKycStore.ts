import { create } from 'zustand';
import type {
  KycSubmission,
  KycSubmissionInput,
  KycFileUpload,
} from '@shared/types/kyc.types';
import { getBackend } from '../backend';
import { useUserStore } from './useUserStore';
import { useSubscriptionStore } from './useSubscriptionStore';

const backend = getBackend();

interface KycState {
  /** The driver's current/most-recent KYC submission, if any. */
  submission: KycSubmission | null;
  isLoading: boolean;
  /** Fetch the driver's submission from the backend. */
  load: () => Promise<void>;
  /** Submit (or re-submit after rejection) the KYC application. */
  submit: (input: KycSubmissionInput, files: KycFileUpload[]) => Promise<void>;
  /** Resolve a stored document ref to a viewable (signed) URL. */
  documentUrl: (ref: string) => Promise<string>;
}

export const useKycStore = create<KycState>((set) => ({
  submission: null,
  isLoading: false,
  load: async () => {
    const user = useUserStore.getState().user;
    if (!user) {
      set({ submission: null });
      return;
    }
    set({ isLoading: true });
    const submission = await backend.getKyc(user.id).catch(() => null);
    set({ submission, isLoading: false });
  },
  submit: async (input, files) => {
    const submission = await backend.submitKyc(input, files);
    set({ submission });
    // Reflect the new 'submitted' state locally and refresh plan gating.
    const user = useUserStore.getState().user;
    if (user) {
      await useUserStore
        .getState()
        .setUser({ ...user, kycStatus: 'submitted', updatedAt: new Date() });
    }
    await useSubscriptionStore.getState().load();
  },
  documentUrl: (ref) => backend.getKycDocumentUrl(ref),
}));
