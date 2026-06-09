export type CoopMemberStatus = 'invited' | 'active';

export interface CooperativeParams {
  gasolinePerLiter?: number;
  desiredMargin?: number; // decimal
}

/** Max drivers (incl. the admin) a single cooperative can hold. */
export const MAX_COOP_DRIVERS = 20;

export interface Cooperative {
  id: string;
  name: string;
  adminId: string; // user id of the cooperative admin
  createdAt: string;
  fleetParams?: CooperativeParams;
  /** True when the admin has an active Cooperativa subscription — the whole
   * fleet is premium while this holds. Derived; set by the backend on read. */
  subscriptionActive?: boolean;
}

export interface CoopMember {
  id: string;
  coopId: string;
  email: string;
  userId?: string; // resolved when that user has an account
  status: CoopMemberStatus;
  invitedAt: string;
}

export interface FleetDriverSummary {
  memberId: string;
  userId?: string;
  email: string;
  name: string;
  status: CoopMemberStatus;
  tripsCount: number;
  totalProfit: number;
  avgMargin: number;
  profitable: boolean;
}

export interface FleetReport {
  coop: Cooperative;
  totalProfit: number;
  totalTrips: number;
  profitableDrivers: number;
  unprofitableDrivers: number;
  drivers: FleetDriverSummary[];
}

export interface FleetAnnouncement {
  id: string;
  coopId: string;
  message: string;
  createdAt: string; // ISO datetime
}

/** A pending invitation a driver can accept or reject. */
export interface CoopInvite {
  member: CoopMember;
  coop: Cooperative;
}
