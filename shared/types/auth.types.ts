export type UserRole = 'driver' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  /** Epoch milliseconds when the session expires. */
  expiresAt: number;
}
