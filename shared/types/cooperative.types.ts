export type CoopMemberStatus = 'invited' | 'active';

export interface CooperativeParams {
  gasolinePerLiter?: number;
  desiredMargin?: number; // decimal
}

export interface Cooperative {
  id: string;
  name: string;
  adminId: string; // user id of the cooperative admin
  createdAt: string;
  fleetParams?: CooperativeParams;
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
