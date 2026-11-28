/**
 * Authoritative licensing barrel for commercial activation, validation, and lifecycle state.
 *
 * Module Boundary Contract:
 * - `04_LICENSING/license-engine.ts`: Commercial license key generation, database persistence
 *   (`licenses`, `license_devices`), multi-device seat activation, offline 72-hour HMAC cache,
 *   and admin revocation/extension.
 * - `08_SECURITY/license-service.ts`: Machine HWID fingerprinting, RSA-SHA256 public-key
 *   verification of `MAHI-...` offline license keys, and shared offline-key discovery helpers.
 * - `08_SECURITY/license-status-service.ts`: Background online revocation polling and signed
 *   7-day status cache daemon.
 */
export {
  normalizeLicenseKey,
  hashLicenseKey,
  generateLicenseKey,
  calculateExpiryDate,
  evaluateServerStatus,
  createLicense,
  getLicenses,
  getLicenseById,
  extendLicense,
  revokeLicense,
  activateLicense,
  validateCurrentLicense,
  getLicenseDevices,
  deactivateDevice,
} from './license-engine.js';

export type {
  LicenseRecord,
  LicenseDurationType,
  LicenseStatus,
  CreateLicenseDTO,
  CreateLicenseResponse,
  ActivatedDevice,
  LicenseValidationResult,
  ExtendLicenseDTO,
} from '../10_CONFIG/shared/types/license.js';
