export type LicenseDurationType =
  | '1_DAY'
  | '7_DAYS'
  | '30_DAYS'
  | '90_DAYS'
  | '1_YEAR'
  | 'LIFETIME'
  | 'CUSTOM';

export type LicenseStatus =
  | 'ACTIVE'
  | 'EXPIRED'
  | 'REVOKED'
  | 'SUSPENDED'
  | 'NOT_ACTIVATED';

export interface LicenseRecord {
  id: string;
  keyMasked: string; // e.g. "MAHI-****-****-A1B2"
  customerName: string;
  accountId?: string;
  status: LicenseStatus;
  durationType: LicenseDurationType;
  maxDevices: number;
  activeDevicesCount: number;
  startsAt: string;
  expiresAt: string | null; // null for lifetime
  createdAt: string;
  createdBy: string;
  revokedAt: string | null;
  lastValidationAt: string | null;
  notes?: string;
}

export interface ActivatedDevice {
  id: string;
  licenseId: string;
  deviceId: string;
  deviceName: string;
  ipAddress?: string;
  activatedAt: string;
  lastSeenAt: string;
  status: 'ACTIVE' | 'DEACTIVATED';
}

export interface CreateLicenseDTO {
  durationType: LicenseDurationType;
  customerName: string;
  accountId?: string;
  maxDevices?: number;
  startsAt?: string;
  expiresAt?: string; // required if CUSTOM
  notes?: string;
}

export interface CreateLicenseResponse {
  success: boolean;
  rawLicenseKey: string; // Displayed ONCE to owner upon creation
  license: LicenseRecord;
}

export interface ActivateLicenseDTO {
  licenseKey: string;
  accountId?: string;
  deviceName?: string;
}

export interface LicenseValidationResult {
  isValid: boolean;
  status: LicenseStatus;
  license?: LicenseRecord;
  message?: string;
  isOfflineGrace?: boolean;
  graceExpiresAt?: string;
}

export interface ExtendLicenseDTO {
  licenseId: string;
  additionalDays?: number;
  newExpiresAt?: string;
}

export type CommercialTier = 'FREE_TRIAL' | 'STARTER' | 'PRO' | 'ENTERPRISE';

export interface CryptographicLicensePayload {
  licenseId: string;
  customerName: string;
  customerEmail: string;
  tier: CommercialTier;
  maxProfiles: number;
  maxConcurrentRunning: number;
  hwid: string; // Hardware ID string or '*' for multi-device
  issuedAt: string;
  expiresAt: string; // ISO date string or 'LIFETIME'
}

export interface CryptographicLicenseToken {
  payload: CryptographicLicensePayload;
  signature: string; // Ed25519 hex signature
}

export interface LicenseValidationStatus {
  valid: boolean;
  tier: CommercialTier;
  maxProfiles: number;
  maxConcurrentRunning: number;
  currentProfilesCount: number;
  currentRunningCount: number;
  expiresAt: string;
  daysLeft: number;
  isLifetime: boolean;
  customerName: string;
  customerEmail: string;
  hwid: string;
  licenseKeyMasked: string;
  message: string;
}

export interface OnlineLicenseStatus {
  verified: boolean;
  revoked: boolean;
  graceExpired: boolean;
  offlineDaysLeft: number;
  statusText: string;
}

