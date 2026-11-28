import { getDatabase } from '../../06_DATABASE/connection.js';
import type { SoftwareVersionRecord, CommercialRole } from '../../10_CONFIG/shared/types/commercial.js';
import { logCommercialAudit } from './commercial-audit-service.js';

export const CURRENT_SOFTWARE_VERSION = '2.0.0';

interface SqliteSoftwareVersionRow {
  id: string;
  version: string;
  release_notes: string;
  min_supported_version: string;
  download_url_setup: string | null;
  download_url_portable: string | null;
  is_mandatory: number;
  released_at: string;
}

export function getSoftwareVersions(): SoftwareVersionRecord[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM software_versions ORDER BY released_at DESC').all() as SqliteSoftwareVersionRow[];

  if (rows.length === 0) {
    const defaultVersion: SoftwareVersionRecord = {
      id: 'ver_2.0.0',
      version: '2.0.0',
      releaseNotes: 'MAHI Browser Commercial Release with User & Admin Control Architecture.',
      minSupportedVersion: '1.0.0',
      downloadUrlSetup: '/download/setup',
      downloadUrlPortable: '/download/portable',
      isMandatory: false,
      releasedAt: new Date().toISOString(),
    };

    db.prepare(`
      INSERT OR REPLACE INTO software_versions (
        id, version, release_notes, min_supported_version, download_url_setup, download_url_portable, is_mandatory, released_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      defaultVersion.id,
      defaultVersion.version,
      defaultVersion.releaseNotes,
      defaultVersion.minSupportedVersion,
      defaultVersion.downloadUrlSetup,
      defaultVersion.downloadUrlPortable,
      defaultVersion.isMandatory ? 1 : 0,
      defaultVersion.releasedAt
    );

    return [defaultVersion];
  }

  return rows.map((r) => ({
    id: r.id,
    version: r.version,
    releaseNotes: r.release_notes,
    minSupportedVersion: r.min_supported_version,
    downloadUrlSetup: r.download_url_setup || undefined,
    downloadUrlPortable: r.download_url_portable || undefined,
    isMandatory: Boolean(r.is_mandatory),
    releasedAt: r.released_at,
  }));
}

export function publishSoftwareVersion(
  dto: {
    version: string;
    releaseNotes: string;
    minSupportedVersion?: string;
    downloadUrlSetup?: string;
    downloadUrlPortable?: string;
    isMandatory?: boolean;
  },
  actor: { id: string; name: string; role: CommercialRole }
): SoftwareVersionRecord {
  const db = getDatabase();
  const id = `ver_${dto.version}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR REPLACE INTO software_versions (
      id, version, release_notes, min_supported_version, download_url_setup, download_url_portable, is_mandatory, released_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    dto.version.trim(),
    dto.releaseNotes.trim(),
    dto.minSupportedVersion?.trim() || '1.0.0',
    dto.downloadUrlSetup || null,
    dto.downloadUrlPortable || null,
    dto.isMandatory ? 1 : 0,
    now
  );

  logCommercialAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: 'VERSION_PUBLISHED',
    targetType: 'SOFTWARE_VERSION',
    targetId: dto.version,
    details: `Published software release v${dto.version} (Mandatory: ${Boolean(dto.isMandatory)})`,
    result: 'SUCCESS',
  });

  return {
    id,
    version: dto.version,
    releaseNotes: dto.releaseNotes,
    minSupportedVersion: dto.minSupportedVersion || '1.0.0',
    downloadUrlSetup: dto.downloadUrlSetup,
    downloadUrlPortable: dto.downloadUrlPortable,
    isMandatory: Boolean(dto.isMandatory),
    releasedAt: now,
  };
}

export function checkVersionCompatibility(clientVersion: string): {
  isCompatible: boolean;
  currentLatest: string;
  hasUpdate: boolean;
  isMandatoryUpdate: boolean;
  releaseNotes?: string;
} {
  const versions = getSoftwareVersions();
  const latest = versions[0];

  if (!latest) {
    return {
      isCompatible: true,
      currentLatest: CURRENT_SOFTWARE_VERSION,
      hasUpdate: false,
      isMandatoryUpdate: false,
    };
  }

  const isBelowMin = compareSemver(clientVersion, latest.minSupportedVersion) < 0;
  const hasUpdate = compareSemver(clientVersion, latest.version) < 0;

  return {
    isCompatible: !isBelowMin,
    currentLatest: latest.version,
    hasUpdate,
    isMandatoryUpdate: isBelowMin || latest.isMandatory,
    releaseNotes: latest.releaseNotes,
  };
}

function compareSemver(a: string, b: string): number {
  const pa = (a || '0.0.0').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = (b || '0.0.0').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}
