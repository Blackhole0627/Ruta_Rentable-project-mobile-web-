import { create } from 'zustand';
import type { AppNotification } from '@shared/types/notification.types';
import { getBackend } from '../backend';
import { useAuthStore } from './useAuthStore';

const backend = getBackend();

interface NotificationState {
  items: AppNotification[];
  unread: number;
  load: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],
  unread: 0,
  load: async () => {
    const session = useAuthStore.getState().session;
    if (!session) {
      set({ items: [], unread: 0 });
      return;
    }
    const items = await backend.listNotifications(session.user.id);
    set({ items, unread: items.filter((n) => !n.read).length });
  },
  markRead: async (id) => {
    await backend.markNotificationRead(id);
    const items = get().items.map((n) => (n.id === id ? { ...n, read: true } : n));
    set({ items, unread: items.filter((n) => !n.read).length });
  },
  markAllRead: async () => {
    const session = useAuthStore.getState().session;
    if (!session) return;
    await backend.markAllNotificationsRead(session.user.id);
    set({ items: get().items.map((n) => ({ ...n, read: true })), unread: 0 });
  },
  remove: async (id) => {
    await backend.deleteNotification(id);
    const items = get().items.filter((n) => n.id !== id);
    set({ items, unread: items.filter((n) => !n.read).length });
  },
}));
