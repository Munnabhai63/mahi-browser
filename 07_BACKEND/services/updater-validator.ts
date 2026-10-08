import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { UpdateState, UpdateChannel, UpdateReleaseManifest } from '../../10_CONFIG/shared/types/updater.js';

/**
 * Validates standard semantic versioning (e.g. 1.1.1, 1.2.0-beta.1).
 */
export function validateSemVer(version: string): boolean {
  if (!version || typeof version !== 'string') return false;
  const clean = version.trim().replace(/^v/, '');
  const semverRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
  return semverRegex.test(clean);
}

/**
 * Pure semver comparison utility.
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
 */
export function compareSemVer(v1: string, v2: string): number {
  const clean1 = (v1 || '0.0.0').trim().replace(/^v/, '');
  const clean2 = (v2 || '0.0.0').trim().replace(/^v/, '');

  const [main1, pre1] = clean1.split('-');
  const [main2, pre2] = clean2.split('-');

  const parts1 = main1.split('.').map((n) => parseInt(n, 10) || 0);
  const parts2 = main2.split('.').map((n) => parseInt(n, 10) || 0);
  const maxLen = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLen; i++) {
    const p1 = parts1[i] ?? 0;
    const p2 = parts2[i] ?? 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }

  // Pre-release comparison (e.g. 1.2.0 vs 1.2.0-beta.1)
  // Normal release has higher precedence than pre-release with same major.minor.patch
  if (!pre1 && pre2) return 1;
  if (pre1 && !pre2) return -1;
  if (pre1 && pre2) {
    if (pre1 > pre2) return 1;
    if (pre1 < pre2) return -1;
  }

  return 0;
}

/**
 * Determines if targetVersion represents a downgrade or identical version.
 */
export function isDowngradeOrSame(targetVersion: string, currentVersion: string): boolean {
  return compareSemVer(targetVersion, currentVersion) <= 0;
}

/**
 * Validates whether an updater state transition follows expected auto-updater lifecycle.
 */
export function isValidTransition(from: UpdateState, to: UpdateState): boolean {
  const validTransitions: Record<UpdateState, UpdateState[]> = {
    IDLE: ['CHECKING', 'ERROR'],
    CHECKING: ['AVAILABLE', 'NOT_AVAILABLE', 'DOWNLOADING', 'ERROR', 'IDLE'],
    AVAILABLE: ['DOWNLOADING', 'ERROR', 'IDLE'],
    DOWNLOADING: ['DOWNLOADED', 'ERROR', 'IDLE'],
    DOWNLOADED: ['INSTALLING', 'IDLE', 'ERROR'],
    INSTALLING: ['IDLE', 'ERROR'],
    NOT_AVAILABLE: ['CHECKING', 'IDLE'],
    ERROR: ['CHECKING', 'IDLE'],
  };
  return validTransitions[from]?.includes(to) ?? false;
}

/**
 * Validates update manifest against strict release security rules:
 * 1. Must have valid semver
 * 2. Target must not be a downgrade
 * 3. Channel filtering: Stable channel users cannot be served Beta manifests unless opted in
 * 4. Files array must contain valid binary URL, positive size, and checksum
 */
export function validateUpdateManifest(
  manifest: any,
  currentVersion: string,
  userChannel: UpdateChannel = 'STABLE'
): { valid: boolean; error?: string; validatedManifest?: UpdateReleaseManifest } {
  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, error: 'Manifest is empty or not a valid JSON object' };
  }

  if (!manifest.version || !validateSemVer(manifest.version)) {
    return { valid: false, error: `Invalid semantic version in manifest: "${manifest.version}"` };
  }

  // Downgrade protection
  if (isDowngradeOrSame(manifest.version, currentVersion)) {
    return {
      valid: false,
      error: `Downgrade or duplicate version blocked: target ${manifest.version} <= current ${currentVersion}`,
    };
  }

  // Channel protection
  const manifestChannel = (manifest.channel || 'STABLE').toUpperCase();
  if (userChannel === 'STABLE' && manifestChannel === 'BETA') {
    return {
      valid: false,
      error: 'Prerelease/Beta update blocked for user configured on STABLE channel',
    };
  }

  // Files verification
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    return { valid: false, error: 'Manifest contains no release files' };
  }

  const primaryFile = manifest.files.find((f: any) => f.url && (f.sha256 || f.sha512 || manifest.sha512 || manifest.sha256));
  if (!primaryFile) {
    return { valid: false, error: 'Manifest missing valid release artifact or cryptographic checksum' };
  }

  if (typeof primaryFile.size === 'number' && primaryFile.size <= 0) {
    return { valid: false, error: 'Manifest file size is invalid or zero' };
  }

  const validated: UpdateReleaseManifest = {
    version: manifest.version,
    releaseDate: manifest.releaseDate || new Date().toISOString(),
    channel: manifestChannel as UpdateChannel,
    releaseNotes: manifest.releaseNotes || manifest.notes || 'Routine performance improvements and security updates.',
    mandatory: Boolean(manifest.mandatory),
    minAppVersion: manifest.minAppVersion,
    sha256: manifest.sha256 || primaryFile.sha256,
    sha512: manifest.sha512 || primaryFile.sha512,
    files: manifest.files.map((f: any) => ({
      url: f.url,
      name: f.name || path.basename(f.url),
      size: f.size || 0,
      sha256: f.sha256 || manifest.sha256,
      sha512: f.sha512 || manifest.sha512,
      arch: f.arch || 'x64',
    })),
  };

  return { valid: true, validatedManifest: validated };
}

/**
 * Calculates cryptographic hash (SHA-256 or SHA-512) of a local file.
 */
export async function calculateFileHash(filePath: string, algorithm: 'sha256' | 'sha512' = 'sha256'): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      reject(new Error(`File not found: ${filePath}`));
      return;
    }

    const hash = crypto.createHash(algorithm);
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}

/**
 * Verifies file integrity against expected hash with timing-safe comparison.
 */
export async function verifyFileIntegrity(
  filePath: string,
  expectedHash: string,
  algorithm: 'sha256' | 'sha512' = 'sha256',
  expectedSize?: number
): Promise<{ verified: boolean; actualHash?: string; error?: string }> {
  try {
    if (!fs.existsSync(filePath)) {
      return { verified: false, error: 'File does not exist' };
    }

    const stats = fs.statSync(filePath);
    if (expectedSize !== undefined && expectedSize > 0 && stats.size !== expectedSize) {
      return {
        verified: false,
        error: `File size mismatch: expected ${expectedSize} bytes, got ${stats.size} bytes`,
      };
    }

    const actualHash = await calculateFileHash(filePath, algorithm);
    const cleanExpected = expectedHash.trim().toLowerCase();
    const cleanActual = actualHash.trim().toLowerCase();

    const bufExpected = Buffer.from(cleanExpected, 'utf8');
    const bufActual = Buffer.from(cleanActual, 'utf8');

    if (bufExpected.length !== bufActual.length || !crypto.timingSafeEqual(bufExpected, bufActual)) {
      return {
        verified: false,
        actualHash,
        error: `Cryptographic integrity verification failed. Checksum mismatch (${algorithm}).`,
      };
    }

    return { verified: true, actualHash };
  } catch (err: any) {
    return { verified: false, error: err.message };
  }
}
