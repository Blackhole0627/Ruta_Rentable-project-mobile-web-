export type NotificationKind = 'invite' | 'announcement' | 'system';

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  kind: NotificationKind;
  /** Optional in-app route to open when tapped. */
  link?: string;
  read: boolean;
  createdAt: string; // ISO datetime
}
