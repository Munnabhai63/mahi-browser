import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import * as electron from 'electron';
import {
  ExportProfileOptions,
  BulkExportOptions,
  ImportProfileOptions,
  ImportProfilePreview,
  CrossPlatformImportDTO,
  CrossPlatformImportResult,
  MahiProfileArchiveData,
} from '../../10_CONFIG/shared/types/archive.js';
import { Profile } from '../../10_CONFIG/shared/types/profile.js';
import { getProfileById, createProfile, getProfileStoragePath } from './profile-service.js';
import { getCookies, importCookies } from './cookie-service.js';
import { getHistory } from './history-service.js';
import { getExtensions, installExtension } from './extension-service.js';
import { createProxy } from './proxy-service.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';
import { encryptData, decryptData, deriveKeyFromPassword } from '../../08_SECURITY/encryption.js';
import { logActivity } from '../../07_BACKEND/services/audit-service.js';


interface RawArchiveFileStructure {
  magic: 'MAHI_PROFILE_ARCHIVE';
  version: '1.0';
  isEncrypted: boolean;
  saltHex?: string;
  payload: string; // Base64 JSON or encrypted ciphertext
}

function getDefaultExportDir(): string {
  try {
    const electronObj = electron as any;
    const app = electronObj?.app || electronObj?.default?.app;
    if (app && typeof app.getPath === 'function') {
      const p = app.getPath('downloads');
      if (p && fs.existsSync(p)) return p;
    }
  } catch {}
  return os.tmpdir();
}

const EXCLUDED_DIRS = new Set([
  'cache',
  'code cache',
  'gpucache',
  'dawncache',
  'dawngraphitecache',
  'dawnwebgpucache',
  'service worker',
  'shared dictionary',
  'fonts_config',
  'blob_storage',
  'cachestorage',
  'scriptcache',
  'crashpad',
  '.tmp'
]);

/**
 * Strict parity check for paths excluded from cloud profile synchronization (Section 6).
 * Excludes browser caches (Cache, Code Cache, GPUCache, Crashpad, Service Worker/CacheStorage, etc.),
 * temporary files (.tmp, .lock, .journal), and Chromium runtime singletons.
 */
export function isPathExcludedFromSync(relPath: string): boolean {
  if (!relPath || typeof relPath !== 'string') return true;

  // Path traversal guard
  if (
    relPath.includes('..') ||
    relPath.startsWith('/') ||
    relPath.startsWith('\\') ||
    /^[a-zA-Z]:/.test(relPath)
  ) {
    return true;
  }

  const normalized = relPath.replace(/\\/g, '/');
  const lower = normalized.toLowerCase();
  const segments = lower.split('/').filter(Boolean);

  // Excluded directories per Section 6 & chromium session hygiene
  const excludedSegmentNames = new Set([
    'cache',
    'code cache',
    'gpucache',
    'crashpad',
    'dawncache',
    'dawngraphitecache',
    'dawnwebgpucache',
    'blob_storage',
    'scriptcache',
    'shared dictionary',
    'fonts_config',
    'cachestorage',
    '.tmp'
  ]);

  for (const seg of segments) {
    if (excludedSegmentNames.has(seg)) {
      return true;
    }
  }

  // Check multi-segment patterns like service worker/cachestorage
  if (lower.includes('service worker/cachestorage') || lower.includes('service worker/cache')) {
    return true;
  }

  const fileName = segments[segments.length - 1] || '';
  if (
    fileName.endsWith('.tmp') ||
    fileName.endsWith('.lock') ||
    fileName === 'lock' ||
    fileName.endsWith('.journal') ||
    fileName.startsWith('singleton') || // SingletonLock, SingletonCookie, SingletonSocket
    fileName === '.ds_store' ||
    fileName === 'thumbs.db'
  ) {
    return true;
  }

  return false;
}

/**
 * Splits a relative path into POSIX ustar prefix (up to 155 bytes) and name (up to 100 bytes).
 * Searches backwards across '/' boundaries. Returns null if it cannot fit within ustar limits.
 */
function splitUstarPath(relPath: string): { prefix: string; name: string } | null {
  const totalBytes = Buffer.byteLength(relPath, 'utf8');
  if (totalBytes <= 100) {
    return { prefix: '', name: relPath };
  }

  // Find a '/' boundary where prefix <= 155 bytes and name <= 100 bytes
  let slashIdx = relPath.lastIndexOf('/');
  while (slashIdx !== -1) {
    const candidatePrefix = relPath.substring(0, slashIdx);
    const candidateName = relPath.substring(slashIdx + 1);

    const prefixBytes = Buffer.byteLength(candidatePrefix, 'utf8');
    const nameBytes = Buffer.byteLength(candidateName, 'utf8');

    if (prefixBytes <= 155 && nameBytes <= 100) {
      return { prefix: candidatePrefix, name: candidateName };
    }

    if (prefixBytes <= 155 && nameBytes > 100) {
      break;
    }

    slashIdx = relPath.lastIndexOf('/', slashIdx - 1);
  }

  return null;
}

/**
 * Creates a standard 512-byte POSIX ustar tar header block.
 */
function createTarHeader(
  name: string,
  size: number,
  mode = 0o644,
  mtime = Math.floor(Date.now() / 1000),
  typeflag = '0',
  prefix = ''
): Buffer {
  const header = Buffer.alloc(512, 0);

  // 0-99: name
  header.write(name, 0, 100, 'utf8');

  // 100-107: mode (8 bytes octal)
  header.write(mode.toString(8).padStart(6, '0') + ' \0', 100, 8, 'ascii');

  // 108-115: uid
  header.write('000000 \0', 108, 8, 'ascii');

  // 116-123: gid
  header.write('000000 \0', 116, 8, 'ascii');

  // 124-135: size (12 bytes octal)
  const sizeOctal = size.toString(8).padStart(11, '0') + ' ';
  header.write(sizeOctal, 124, 12, 'ascii');

  // 136-147: mtime (12 bytes octal)
  const mtimeOctal = mtime.toString(8).padStart(11, '0') + ' ';
  header.write(mtimeOctal, 136, 12, 'ascii');

  // 148-155: chksum (initialized to 8 spaces)
  header.write('        ', 148, 8, 'ascii');

  // 156: typeflag
  header.write(typeflag, 156, 1, 'ascii');

  // 257-262: magic (ustar\0)
  header.write('ustar\0', 257, 6, 'ascii');

  // 263-264: version (00)
  header.write('00', 263, 2, 'ascii');

  // 265-296: uname
  header.write('mahi', 265, 32, 'utf8');

  // 297-328: gname
  header.write('mahi', 297, 32, 'utf8');

  // 345-499: prefix
  if (prefix) {
    header.write(prefix, 345, 155, 'utf8');
  }

  // Calculate checksum: sum of all 512 bytes with chksum field as spaces
  let sum = 0;
  for (let i = 0; i < 512; i++) {
    sum += header[i];
  }

  // Write checksum: 6 octal digits + null + space
  const chksumOctal = sum.toString(8).padStart(6, '0') + '\0 ';
  header.write(chksumOctal, 148, 8, 'ascii');

  return header;
}

/**
 * Creates GNU @LongLink tar blocks (header + padded data) for paths exceeding POSIX ustar limits.
 */
function createGnuLongLinkBlocks(relPath: string): Buffer[] {
  const pathBuf = Buffer.from(relPath + '\0', 'utf8');
  const longLinkHeader = createTarHeader('././@LongLink', pathBuf.length, 0o644, 0, 'L');
  const pad = (512 - (pathBuf.length % 512)) % 512;
  const blocks = [longLinkHeader, pathBuf];
  if (pad > 0) {
    blocks.push(Buffer.alloc(pad, 0));
  }
  return blocks;
}

/**
 * Packs profile storage and configuration into a pure-Node POSIX ustar session.tar.gz archive.
 * Strictly excludes cache bloat (Section 6) and embeds profile configuration.
 */
export async function packProfileSessionTarGz(
  profileId: string,
  outputTarGzPath?: string
): Promise<{ sizeBytes: number; fileCount: number; buffer: Buffer }> {
  const profile = getProfileById(profileId);
  const baseDir = getProfileStoragePath(profileId);

  const chunks: Buffer[] = [];
  let fileCount = 0;

  // 1. Pack profile metadata as profile.json entry
  if (profile) {
    const metaJson = JSON.stringify({
      formatVersion: '2.0',
      profileId: profile.id,
      name: profile.name,
      description: profile.description,
      browserEngine: profile.settings?.browser?.engine || 'chromium',
      fingerprint: profile.settings?.fingerprint,
      settings: profile.settings,
      tags: profile.tags,
      folder: profile.folder,
      notes: profile.notes,
      exportedAt: new Date().toISOString(),
    }, null, 2);

    const metaBuf = Buffer.from(metaJson, 'utf8');
    const header = createTarHeader('profile.json', metaBuf.length);
    chunks.push(header);
    chunks.push(metaBuf);
    const pad = (512 - (metaBuf.length % 512)) % 512;
    if (pad > 0) chunks.push(Buffer.alloc(pad, 0));
    fileCount++;
  }

  // 2. Scan and pack profile storage files (excluding cache bloat per Section 6)
  if (fs.existsSync(baseDir)) {
    function scanDir(currentDir: string) {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

        if (isPathExcludedFromSync(relPath)) {
          continue;
        }

        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile()) {
          try {
            const stat = fs.statSync(fullPath);
            const content = fs.readFileSync(fullPath);

            const ustar = splitUstarPath(relPath);
            if (!ustar) {
              // Path exceeds POSIX ustar prefix/name limits: emit GNU @LongLink
              const longLinkBlocks = createGnuLongLinkBlocks(relPath);
              for (const b of longLinkBlocks) chunks.push(b);
              const header = createTarHeader(relPath.substring(0, 100), stat.size, 0o644, Math.floor(stat.mtimeMs / 1000), '0', '');
              chunks.push(header);
            } else {
              const header = createTarHeader(ustar.name, stat.size, 0o644, Math.floor(stat.mtimeMs / 1000), '0', ustar.prefix);
              chunks.push(header);
            }

            chunks.push(content);
            const pad = (512 - (content.length % 512)) % 512;
            if (pad > 0) chunks.push(Buffer.alloc(pad, 0));
            fileCount++;
          } catch (readErr) {
            console.warn(`[ArchiveService] Skip unreadable file ${relPath}:`, readErr);
          }
        }
      }
    }

    try {
      scanDir(baseDir);
    } catch (scanErr) {
      console.warn(`[ArchiveService] Error scanning directory ${baseDir}:`, scanErr);
    }
  }

  // 3. Tar end of archive marker (two 512-byte zero blocks = 1024 bytes)
  chunks.push(Buffer.alloc(1024, 0));

  const tarBuffer = Buffer.concat(chunks);
  const compressedGzip = zlib.gzipSync(tarBuffer, { level: 6 });

  if (outputTarGzPath) {
    const parent = path.dirname(outputTarGzPath);
    if (!fs.existsSync(parent)) {
      fs.mkdirSync(parent, { recursive: true });
    }
    fs.writeFileSync(outputTarGzPath, compressedGzip);
  }

  return {
    sizeBytes: compressedGzip.length,
    fileCount,
    buffer: compressedGzip,
  };
}

/**
 * Unpacks a session.tar.gz archive into target profile storage directory with strict
 * path-traversal sanitization and gzip magic validation. Supports POSIX ustar and GNU @LongLink.
 */
export async function unpackProfileSessionTarGz(
  tarGzBufferOrPath: Buffer | string,
  targetProfileId: string
): Promise<{ fileCount: number; bytesExtracted: number; profileMetadata?: any }> {
  let rawBuffer: Buffer;
  if (typeof tarGzBufferOrPath === 'string') {
    if (!fs.existsSync(tarGzBufferOrPath)) {
      throw new Error(`FILE_NOT_FOUND: Archive file not found at ${tarGzBufferOrPath}`);
    }
    rawBuffer = fs.readFileSync(tarGzBufferOrPath);
  } else {
    rawBuffer = tarGzBufferOrPath;
  }

  // 1. Verify GZIP Magic Bytes (0x1f 0x8b)
  if (rawBuffer.length < 2 || rawBuffer[0] !== 0x1f || rawBuffer[1] !== 0x8b) {
    throw new Error('INVALID_GZIP_MAGIC: Archive does not start with gzip magic bytes 0x1f 0x8b');
  }

  const tarBuf = zlib.gunzipSync(rawBuffer);
  const targetDir = getProfileStoragePath(targetProfileId);
  fs.mkdirSync(targetDir, { recursive: true });

  let offset = 0;
  let fileCount = 0;
  let bytesExtracted = 0;
  let profileMetadata: any = null;
  let pendingLongPath: string | null = null;

  while (offset + 512 <= tarBuf.length) {
    const headerBuf = tarBuf.subarray(offset, offset + 512);

    // Check if end of archive (zero block)
    let isZero = true;
    for (let i = 0; i < 512; i++) {
      if (headerBuf[i] !== 0) {
        isZero = false;
        break;
      }
    }
    if (isZero) {
      break; // End of tar archive
    }

    // Parse size
    const sizeStr = headerBuf.toString('ascii', 124, 136).replace(/\0.*$/, '').trim();
    const fileSize = parseInt(sizeStr, 8) || 0;

    // Parse typeflag
    const typeflag = headerBuf[156];

    // Handle GNU @LongLink (typeflag 'L' = 76)
    if (typeflag === 76) {
      offset += 512;
      if (offset + fileSize > tarBuf.length) {
        throw new Error('CORRUPT_TAR_ARCHIVE: Truncated @LongLink stream encountered.');
      }
      const longLinkData = tarBuf.subarray(offset, offset + fileSize);
      pendingLongPath = longLinkData.toString('utf8').replace(/\0.*$/, '').trim();
      const pad = (512 - (fileSize % 512)) % 512;
      offset += fileSize + pad;
      continue;
    }

    // Extract filename
    let relPath: string;
    if (pendingLongPath) {
      relPath = pendingLongPath;
      pendingLongPath = null;
    } else {
      let name = headerBuf.toString('utf8', 0, 100).replace(/\0.*$/, '').trim();
      let prefix = headerBuf.toString('utf8', 345, 500).replace(/\0.*$/, '').trim();
      relPath = prefix ? `${prefix}/${name}` : name;
    }

    relPath = relPath.replace(/\\/g, '/').replace(/^\/+/, '');

    // Strict path traversal security check
    if (
      relPath.includes('..') ||
      relPath.startsWith('/') ||
      relPath.startsWith('\\') ||
      /^[a-zA-Z]:/.test(relPath) ||
      path.isAbsolute(relPath) ||
      relPath.includes('\0')
    ) {
      throw new Error(`SECURITY_ALERT_PATH_TRAVERSAL: Illegal archive entry path detected: "${relPath}"`);
    }

    const isDir = typeflag === 53; // '5'

    offset += 512;

    if (isDir) {
      const outDirPath = path.join(targetDir, relPath);
      fs.mkdirSync(outDirPath, { recursive: true });
    } else {
      if (offset + fileSize > tarBuf.length) {
        throw new Error('CORRUPT_TAR_ARCHIVE: Truncated tar stream encountered.');
      }
      const fileData = tarBuf.subarray(offset, offset + fileSize);
      const outFilePath = path.join(targetDir, relPath);
      const parentDir = path.dirname(outFilePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(outFilePath, fileData);
      fileCount++;
      bytesExtracted += fileSize;

      if (relPath === 'profile.json') {
        try {
          profileMetadata = JSON.parse(fileData.toString('utf8'));
        } catch {}
      }

      // Advance past data and 512-byte padding
      const pad = (512 - (fileSize % 512)) % 512;
      offset += fileSize + pad;
    }
  }

  return {
    fileCount,
    bytesExtracted,
    profileMetadata: profileMetadata || undefined,
  };
}

export function collectEssentialStorageFiles(profileId: string): Record<string, string> {
  const baseDir = getProfileStoragePath(profileId);
  const filesMap: Record<string, string> = {};

  if (!fs.existsSync(baseDir)) return filesMap;

  let totalBytes = 0;
  const MAX_STORAGE_BYTES = 180 * 1024 * 1024; // 180MB

  function scan(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      const lowerName = entry.name.toLowerCase();

      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(lowerName)) {
          continue; // Exclude browser caches
        }
        scan(fullPath);
      } else if (entry.isFile()) {
        if (lowerName.endsWith('.tmp') || lowerName.endsWith('.lock')) {
          continue;
        }
        try {
          const stat = fs.statSync(fullPath);
          if (totalBytes + stat.size > MAX_STORAGE_BYTES) {
            continue;
          }
          const content = fs.readFileSync(fullPath);
          totalBytes += stat.size;
          filesMap[relPath] = content.toString('base64');
        } catch {}
      }
    }
  }

  try {
    scan(baseDir);
  } catch {}

  return filesMap;
}

export function restoreStorageFiles(profileId: string, filesMap: Record<string, string>): void {
  const baseDir = getProfileStoragePath(profileId);
  for (const [relPath, b64Data] of Object.entries(filesMap)) {
    try {
      const targetPath = path.join(baseDir, relPath);
      const parentDir = path.dirname(targetPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(targetPath, Buffer.from(b64Data, 'base64'));
    } catch (err) {
      console.warn(`[ArchiveService] Failed to restore file ${relPath}:`, err);
    }
  }
}

export function exportProfileToArchive(options: ExportProfileOptions): { success: boolean; filePath: string } {
  const profile = getProfileById(options.profileId);
  if (!profile) {
    throw new Error(`Profile ${options.profileId} not found`);
  }

  const archiveData: MahiProfileArchiveData = {
    formatVersion: '1.0',
    exportedAt: new Date().toISOString(),
    appVersion: '1.0.0',
    profile,
  };

  if (options.includeCookies) {
    archiveData.cookies = getCookies({ profileId: profile.id });
  }

  if (options.includeHistory) {
    archiveData.history = getHistory({ profileId: profile.id });
  }

  if (options.includeExtensions) {
    archiveData.extensions = getExtensions(profile.id);
  }

  if (options.includeStorage) {
    archiveData.storageFiles = collectEssentialStorageFiles(profile.id);
  }

  const jsonStr = JSON.stringify(archiveData);
  let fileStructure: RawArchiveFileStructure;

  if (options.password && options.password.trim().length > 0) {
    const salt = crypto.randomBytes(16);
    const derivedKey = deriveKeyFromPassword(options.password, salt);
    const encryptedPayload = encryptData(jsonStr, derivedKey);

    fileStructure = {
      magic: 'MAHI_PROFILE_ARCHIVE',
      version: '1.0',
      isEncrypted: true,
      saltHex: salt.toString('hex'),
      payload: encryptedPayload,
    };
  } else {
    // Unencrypted or master-encrypted
    const encryptedPayload = encryptData(jsonStr);
    fileStructure = {
      magic: 'MAHI_PROFILE_ARCHIVE',
      version: '1.0',
      isEncrypted: false,
      payload: encryptedPayload,
    };
  }

  const targetPath = options.targetFilePath || path.join(getDefaultExportDir(), `${profile.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.mahi-profile`);
  const parentDir = path.dirname(targetPath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  fs.writeFileSync(targetPath, JSON.stringify(fileStructure, null, 2), 'utf8');

  logActivity('PROFILE', 'SUCCESS', 'Export Profile', `Exported profile "${profile.name}" to archive`, profile.id, profile.name);

  return { success: true, filePath: targetPath };
}

export function previewProfileArchive(filePath: string, password?: string): ImportProfilePreview {
  if (!fs.existsSync(filePath)) {
    return {
      valid: false,
      formatVersion: '',
      exportedAt: '',
      profileName: '',
      folder: '',
      tags: [],
      cookieCount: 0,
      historyCount: 0,
      extensionCount: 0,
      browserEngine: '',
      isEncrypted: false,
      errorMessage: `File not found at ${filePath}`,
    };
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const fileStructure: RawArchiveFileStructure = JSON.parse(raw);

    if (fileStructure.magic !== 'MAHI_PROFILE_ARCHIVE') {
      return {
        valid: false,
        formatVersion: '',
        exportedAt: '',
        profileName: '',
        folder: '',
        tags: [],
        cookieCount: 0,
        historyCount: 0,
        extensionCount: 0,
        browserEngine: '',
        isEncrypted: false,
        errorMessage: 'Invalid archive format. Missing Mahi header.',
      };
    }

    let jsonStr: string;
    if (fileStructure.isEncrypted) {
      if (!password) {
        return {
          valid: true,
          formatVersion: fileStructure.version,
          exportedAt: '',
          profileName: '',
          folder: '',
          tags: [],
          cookieCount: 0,
          historyCount: 0,
          extensionCount: 0,
          browserEngine: '',
          isEncrypted: true,
          errorMessage: 'Password required to decrypt profile archive',
        };
      }

      const salt = Buffer.from(fileStructure.saltHex!, 'hex');
      const derivedKey = deriveKeyFromPassword(password, salt);
      try {
        jsonStr = decryptData(fileStructure.payload, derivedKey);
      } catch {
        return {
          valid: false,
          formatVersion: fileStructure.version,
          exportedAt: '',
          profileName: '',
          folder: '',
          tags: [],
          cookieCount: 0,
          historyCount: 0,
          extensionCount: 0,
          browserEngine: '',
          isEncrypted: true,
          errorMessage: 'Incorrect password for profile archive',
        };
      }
    } else {
      try {
        jsonStr = decryptData(fileStructure.payload);
      } catch {
        jsonStr = Buffer.from(fileStructure.payload, 'base64').toString('utf8');
      }
    }

    const archiveData: MahiProfileArchiveData = JSON.parse(jsonStr);
    return {
      valid: true,
      formatVersion: archiveData.formatVersion,
      exportedAt: archiveData.exportedAt,
      profileName: archiveData.profile.name,
      folder: archiveData.profile.folder,
      tags: archiveData.profile.tags,
      cookieCount: archiveData.cookies?.length || 0,
      historyCount: archiveData.history?.length || 0,
      extensionCount: archiveData.extensions?.length || 0,
      browserEngine: archiveData.profile.settings?.browser?.engine || 'chrome',
      isEncrypted: fileStructure.isEncrypted,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      formatVersion: '',
      exportedAt: '',
      profileName: '',
      folder: '',
      tags: [],
      cookieCount: 0,
      historyCount: 0,
      extensionCount: 0,
      browserEngine: '',
      isEncrypted: false,
      errorMessage: `Failed to read archive: ${msg}`,
    };
  }
}

export function importProfileFromArchive(options: ImportProfileOptions) {
  const preview = previewProfileArchive(options.sourceFilePath, options.password);
  if (!preview.valid) {
    throw new Error(preview.errorMessage || 'Invalid archive');
  }

  const raw = fs.readFileSync(options.sourceFilePath, 'utf8');
  const fileStructure: RawArchiveFileStructure = JSON.parse(raw);

  let jsonStr: string;
  if (fileStructure.isEncrypted) {
    const salt = Buffer.from(fileStructure.saltHex!, 'hex');
    const derivedKey = deriveKeyFromPassword(options.password!, salt);
    jsonStr = decryptData(fileStructure.payload, derivedKey);
  } else {
    try {
      jsonStr = decryptData(fileStructure.payload);
    } catch {
      jsonStr = Buffer.from(fileStructure.payload, 'base64').toString('utf8');
    }
  }

  const archiveData: MahiProfileArchiveData = JSON.parse(jsonStr);
  const orig = archiveData.profile;

  const profileName = options.overrideName || `${orig.name} (Imported)`;
  const folder = options.targetFolder || orig.folder || 'General';

  const newProfile = createProfile({
    name: profileName,
    description: orig.description,
    folder,
    tags: orig.tags,
    notes: orig.notes,
    ownerId: options.ownerId || orig.ownerId,
    settings: orig.settings,
  });

  // Import cookies if present
  if (archiveData.cookies && archiveData.cookies.length > 0) {
    importCookies(newProfile.id, JSON.stringify(archiveData.cookies));
  }

  // Import extensions if present
  if (archiveData.extensions && archiveData.extensions.length > 0) {
    for (const ext of archiveData.extensions) {
      try {
        installExtension({
          profileId: newProfile.id,
          sourcePath: ext.sourcePath,
          name: ext.name,
        });
      } catch {
        // ignore
      }
    }
  }

  // Import storage files if present (preferences, cookies, localStorage, etc.)
  if (archiveData.storageFiles && Object.keys(archiveData.storageFiles).length > 0) {
    restoreStorageFiles(newProfile.id, archiveData.storageFiles);
  }

  logActivity('PROFILE', 'SUCCESS', 'Import Profile', `Imported profile archive into "${profileName}"`, newProfile.id, profileName);

  return getProfileById(newProfile.id)!;
}

/**
 * Formats all cookies of a profile into standard Netscape HTTP Cookie file format (.txt)
 */
export function exportNetscapeCookies(profileId: string): string {
  const profile = getProfileById(profileId);
  if (!profile) throw new Error(`Profile ${profileId} not found`);

  const cookies = getCookies({ profileId });
  const lines: string[] = [
    '# Netscape HTTP Cookie File',
    '# http://curl.haxx.se/rfc/cookie_spec.html',
    '# This file was generated by MAHI BROWSER',
    `# Profile: ${profile.name} (Exported at ${new Date().toISOString()})`,
    '',
  ];

  for (const c of cookies) {
    const domain = c.domain.startsWith('.') ? c.domain : `.${c.domain}`;
    const includeSubdomains = domain.startsWith('.') ? 'TRUE' : 'FALSE';
    const path = c.path || '/';
    const isSecure = c.secure ? 'TRUE' : 'FALSE';
    const expiry = c.expires ? Math.floor(new Date(c.expires).getTime() / 1000) : 0;
    lines.push(`${domain}\t${includeSubdomains}\t${path}\t${isSecure}\t${expiry}\t${c.name}\t${c.value}`);
  }

  logActivity('COOKIES', 'SUCCESS', 'Export Netscape Cookies', `Exported ${cookies.length} Netscape cookies for "${profile.name}"`, profile.id, profile.name);
  return lines.join('\n');
}

/**
 * Exports multiple profiles into a single compressed .mahi-backup archive
 */
export function exportBulkProfilesToArchive(options: BulkExportOptions): { success: boolean; filePath: string; profileCount: number } {
  const archives: MahiProfileArchiveData[] = [];

  for (const pid of options.profileIds) {
    const profile = getProfileById(pid);
    if (!profile) continue;

    const data: MahiProfileArchiveData = {
      formatVersion: '1.0',
      exportedAt: new Date().toISOString(),
      appVersion: '1.0.0',
      profile,
    };

    if (options.includeCookies) {
      data.cookies = getCookies({ profileId: profile.id });
    }
    if (options.includeHistory) {
      data.history = getHistory({ profileId: profile.id });
    }
    if (options.includeExtensions) {
      data.extensions = getExtensions(profile.id);
    }
    archives.push(data);
  }

  const jsonStr = JSON.stringify({
    magic: 'MAHI_BULK_BACKUP',
    version: '1.0',
    exportedAt: new Date().toISOString(),
    profilesCount: archives.length,
    profiles: archives,
  });

  let fileStructure: RawArchiveFileStructure;
  if (options.password && options.password.trim().length > 0) {
    const salt = crypto.randomBytes(16);
    const derivedKey = deriveKeyFromPassword(options.password, salt);
    const encryptedPayload = encryptData(jsonStr, derivedKey);
    fileStructure = {
      magic: 'MAHI_PROFILE_ARCHIVE',
      version: '1.0',
      isEncrypted: true,
      saltHex: salt.toString('hex'),
      payload: encryptedPayload,
    };
  } else {
    const encryptedPayload = encryptData(jsonStr);
    fileStructure = {
      magic: 'MAHI_PROFILE_ARCHIVE',
      version: '1.0',
      isEncrypted: false,
      payload: encryptedPayload,
    };
  }

  const targetPath = options.targetFilePath || path.join(getDefaultExportDir(), `MAHI_Backup_${Date.now()}.mahi-backup`);
  const parentDir = path.dirname(targetPath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  fs.writeFileSync(targetPath, JSON.stringify(fileStructure, null, 2), 'utf8');
  logActivity('PROFILE', 'SUCCESS', 'Bulk Export', `Exported ${archives.length} profiles to backup archive`, undefined, 'Bulk Archive');

  return { success: true, filePath: targetPath, profileCount: archives.length };
}

/**
 * Imports profiles from external platforms (Dolphin Anty, AdsPower, GoLogin, Generic JSON)
 */
export function importCrossPlatformProfiles(dto: CrossPlatformImportDTO): CrossPlatformImportResult {
  const { platform, jsonData, targetFolder = 'Imported' } = dto;
  const importedProfiles: Profile[] = [];
  const errors: string[] = [];

  let parsed: any;
  try {
    parsed = JSON.parse(jsonData);
  } catch (err: any) {
    return { success: false, importedCount: 0, profiles: [], errors: [`Invalid JSON: ${err.message}`] };
  }

  const items = Array.isArray(parsed) ? parsed : [parsed];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const name = item.name || item.title || item.profile_name || `Imported-${platform}-${i + 1}`;
      const userAgent = item.userAgent || item.user_agent || item.ua || undefined;
      const tags: string[] = Array.isArray(item.tags) ? item.tags : [platform.toLowerCase()];
      const cookies = item.cookies || item.cookie || [];

      // Create defaults
      const settings = getDefaultProfileSettings();
      if (userAgent) {
        settings.browser.userAgent = userAgent;
      }

      if (item.proxy) {
        // Map proxy if present
        const pHost = item.proxy.host || item.proxy.ip || item.proxy.server;
        const pPort = parseInt(String(item.proxy.port), 10);
        if (pHost && !isNaN(pPort)) {
          try {
            const createdProxy = createProxy({
              name: `${name} Proxy`,
              host: pHost,
              port: pPort,
              protocol: (item.proxy.type || item.proxy.protocol || 'http').toLowerCase() as any,
              username: item.proxy.username || item.proxy.login,
              password: item.proxy.password || item.proxy.pass,
            });
            settings.network.directConnection = false;
            settings.network.proxyId = createdProxy.id;
          } catch {}
        }
      }

      const newProfile = createProfile({
        name,
        folder: targetFolder,
        tags,
        notes: `Imported from ${platform} on ${new Date().toLocaleDateString()}`,
        settings,
      });

      if (cookies && (Array.isArray(cookies) || typeof cookies === 'string')) {
        const cookieStr = typeof cookies === 'string' ? cookies : JSON.stringify(cookies);
        try {
          importCookies(newProfile.id, cookieStr);
        } catch {}
      }

      importedProfiles.push(newProfile);
    } catch (itemErr: any) {
      errors.push(`Item ${i + 1} (${item.name || 'unnamed'}): ${itemErr.message}`);
    }
  }

  logActivity('PROFILE', importedProfiles.length > 0 ? 'SUCCESS' : 'ERROR', 'Cross-Platform Import', `Imported ${importedProfiles.length} profiles from ${platform}`, undefined, platform);

  return {
    success: importedProfiles.length > 0,
    importedCount: importedProfiles.length,
    profiles: importedProfiles,
    errors: errors.length > 0 ? errors : undefined,
  };
}

