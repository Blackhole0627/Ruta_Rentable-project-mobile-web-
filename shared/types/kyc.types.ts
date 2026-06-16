/**
 * KYC (Know Your Customer) identity-verification model. Required by AML
 * regulation (Nicaragua's UAF) before a driver can hold an ACTIVE paid
 * subscription. Manual review: a driver submits personal data, risk answers and
 * document images/PDFs, an admin reviews them by eye and approves or rejects.
 *
 * Documents are NEVER stored as public URLs. On Supabase they live in a private
 * `kyc-docs` storage bucket (RLS: only the owner and admins can read) and the
 * row stores opaque storage *paths*; the admin reads them through short-lived
 * signed URLs. The offline mock stores compressed data URLs inline instead.
 */

/** Per-user verification state, denormalised onto the user profile for gating. */
export type KycStatus = 'none' | 'submitted' | 'verified' | 'rejected';

/** Whether the subject is a natural person or a legal entity. The company flow
 * is modelled now but only the individual path is collected in the current UI. */
export type KycSubjectType = 'individual' | 'company';

/** Personal data of an individual applicant. */
export interface KycPersonalData {
  fullName: string;
  /** ISO date (YYYY-MM-DD). */
  dateOfBirth: string;
  nationality: string;
  homeAddress: string;
  occupation: string;
  /** National ID (cédula) number. */
  idNumber: string;
}

/** Legal-entity data (collected later; modelled now so no migration is needed). */
export interface KycCompanyData {
  /** Registro Único del Contribuyente. */
  ruc: string;
  legalName: string;
  /** Name + ID of the legal representative. */
  legalRepName: string;
  legalRepIdNumber: string;
  /** Free-text description of beneficial owners (name, % ownership, ID). */
  beneficialOwners: string;
}

/** Short AML risk questionnaire (both subject types). */
export interface KycRiskAnswers {
  economicActivity: string;
  sourceOfFunds: string;
  /** Expected monthly transaction volume (free text or range). */
  expectedMonthlyVolume: string;
  /** Politically Exposed Person. */
  isPep: boolean;
}

/** The document slots. Each value is a storage path (Supabase) or data URL (mock). */
export type KycDocumentKey =
  | 'idFront'
  | 'idBack'
  | 'driverLicense'
  | 'proofOfAddress'
  | 'selfie' // optional
  // company-only (future)
  | 'articlesOfIncorporation'
  | 'legalRepId';

export type KycDocuments = Partial<Record<KycDocumentKey, string>>;

/** A document the driver is uploading (raw file + which slot it fills). */
export interface KycFileUpload {
  key: KycDocumentKey;
  file: File;
}

/** The data the driver fills in (everything except documents, which upload
 * separately so each backend can place them in private storage). */
export interface KycSubmissionInput {
  subjectType: KycSubjectType;
  personal?: KycPersonalData;
  company?: KycCompanyData;
  risk: KycRiskAnswers;
}

/** A full KYC submission as stored/returned. */
export interface KycSubmission extends KycSubmissionInput {
  id: string;
  userId: string;
  status: KycStatus;
  documents: KycDocuments;
  /** Reason given by the admin on rejection (shown to the driver). */
  rejectionReason?: string;
  submittedAt: string; // ISO datetime
  reviewedAt?: string; // ISO datetime
}

/** A submission as seen by the admin review queue (joined user info). */
export interface AdminKycRow extends KycSubmission {
  userName?: string;
  userEmail?: string;
}
