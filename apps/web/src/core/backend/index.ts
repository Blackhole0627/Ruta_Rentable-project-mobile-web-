import type { BackendAdapter } from './types';
import { isBackendConfigured } from './config';
import { MockBackend } from './mockBackend';
import { SupabaseBackend } from './supabaseBackend';

let instance: BackendAdapter | null = null;

/** Returns the singleton backend: real Supabase when configured, else the mock. */
export function getBackend(): BackendAdapter {
  if (!instance) {
    instance = isBackendConfigured() ? new SupabaseBackend() : new MockBackend();
  }
  return instance;
}

export type { BackendAdapter, CloudSnapshot, DeletionRecord } from './types';
export { isBackendConfigured, isAdminEmail } from './config';
