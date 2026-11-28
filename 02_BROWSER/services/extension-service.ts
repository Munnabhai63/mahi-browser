import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import https from 'node:https';
import { execFileSync } from 'node:child_process';
import { getDatabase } from '../../06_DATABASE/connection.js';
import type { ExtensionItem, InstallExtensionDTO } from '../../10_CONFIG/shared/types/extension.js';
import { getProfileById, getProfilesDirectory } from './profile-service.js';
import { logActivity } from '../../07_BACKEND/services/audit-service.js';
import { createLogger } from '../../07_BACKEND/utils/logger.js';
const log = createLogger('extension-service');

function assertSafeZipBuffer(zipBuffer: Buffer, targetDir: string): void {
  const minEocdLen = 22;
  const maxCommentLen = 65535;
  const searchStart = Math.max(0, zipBuffer.length - minEocdLen - maxCommentLen);
  let eocdOffset = -1;
  for (let i = zipBuffer.length - minEocdLen; i >= searchStart; i--) {
    if (
      zipBuffer[i] === 0x50 &&
      zipBuffer[i + 1] === 0x4b &&
      zipBuffer[i + 2] === 0x05 &&
      zipBuffer[i + 3] === 0x06
    ) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) {
    throw new Error('Invalid ZIP archive: End of Central Directory not found');
  }

  const totalEntries = zipBuffer.readUInt16LE(eocdOffset + 10);
  const cdOffset = zipBuffer.readUInt32LE(eocdOffset + 16);
  const resolvedRoot = path.resolve(targetDir);
  let cursor = cdOffset;

  for (let idx = 0; idx < totalEntries; idx++) {
    if (cursor + 46 > zipBuffer.length) {
      throw new Error('Corrupted ZIP Central Directory');
    }
    if (
      zipBuffer[cursor] !== 0x50 ||
      zipBuffer[cursor + 1] !== 0x4b ||
      zipBuffer[cursor + 2] !== 0x01 ||
      zipBuffer[cursor + 3] !== 0x02
    ) {
      throw new Error('Invalid ZIP Central Directory entry signature');
    }

    const nameLen = zipBuffer.readUInt16LE(cursor + 28);
    const extraLen = zipBuffer.readUInt16LE(cursor + 30);
    const commentLen = zipBuffer.readUInt16LE(cursor + 32);
    const extAttrs = zipBuffer.readUInt32LE(cursor + 38);
    const nameStart = cursor + 46;
    const nameEnd = nameStart + nameLen;
    if (nameEnd > zipBuffer.length) {
      throw new Error('Truncated ZIP filename entry');
    }

    // Reject POSIX symlinks stored in ZIP external attributes
    const unixMode = (extAttrs >>> 16) & 0o170000;
    if (unixMode === 0o120000) {
      throw new Error('Blocked unsafe symlink entry inside CRX/ZIP archive');
    }

    const entryName = zipBuffer.subarray(nameStart, nameEnd).toString('utf8');
    if (
      !entryName ||
      entryName.includes('\0') ||
      entryName.startsWith('/') ||
      entryName.startsWith('\\') ||
      /^[A-Za-z]:/.test(entryName)
    ) {
      throw new Error(`Blocked unsafe ZIP entry path: ${entryName}`);
    }

    const segments = entryName.split(/[\\/]+/).filter(Boolean);
    if (segments.includes('..')) {
      throw new Error(`Blocked ZIP path traversal entry: ${entryName}`);
    }

    const resolvedEntry = path.resolve(resolvedRoot, ...segments);
    if (resolvedEntry !== resolvedRoot && !resolvedEntry.startsWith(resolvedRoot + path.sep)) {
      throw new Error(`ZIP entry escapes extraction root: ${entryName}`);
    }

    cursor = nameEnd + extraLen + commentLen;
  }
}

function downloadBuffer(url: string, maxRedirects = 5): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));
    const parsedUrl = new URL(url);
    const chromeVersion = (typeof process !== 'undefined' && process.versions && process.versions.chrome) || '130.0.0.0';
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`,
        'Accept': 'application/x-chrome-extension,*/*',
      },
    };
    const req = https.get(options, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadBuffer(res.headers.location, maxRedirects - 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download CRX (HTTP ${res.statusCode})`));
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy(new Error('CRX download timeout'));
    });
  });
}

/**
 * Resolves localized manifest strings (e.g. __MSG_appName__) from _locales directory
 */
export function resolveLocalizedText(extDir: string, text: string | undefined): string {
  if (!text) return '';
  if (!text.startsWith('__MSG_')) return text;
  const key = text.replace(/^__MSG_|__$/g, '');
  const locales = ['en', 'en_US', 'en_GB'];
  for (const loc of locales) {
    const msgFile = path.join(extDir, '_locales', loc, 'messages.json');
    if (fs.existsSync(msgFile)) {
      try {
        const msgs = JSON.parse(fs.readFileSync(msgFile, 'utf8'));
        if (msgs[key]?.message) {
          return msgs[key].message;
        }
      } catch (err) {
        log.debug('extension-service _locales messages.json parse failed', { msgFile, err });
      }
    }
  }
  return text;
}

/**
 * Downloads official CRX package from Google Web Store CDN and extracts pure ZIP payload
 */
export async function downloadAndExtractCrx(extensionStoreId: string, targetDir: string): Promise<boolean> {
  const chromeVersion = (typeof process !== 'undefined' && process.versions && process.versions.chrome) || '130.0.0.0';
  const urlTemplates = [
    `https://clients2.google.com/service/update2/crx?response=redirect&os=win&arch=x64&os_arch=x86_64&nacl_arch=x86-64&prod=chromecrx&prodchannel=&prodversion=${chromeVersion}&lang=en-US&acceptformat=crx2,crx3&x=id%3D${extensionStoreId}%26installsource%3Dondemand%26uc`,
    `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=${chromeVersion}&acceptformat=crx2,crx3&x=id%3D${extensionStoreId}%26installsource%3Dondemand%26uc`,
    `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=138.0.7204.0&acceptformat=crx2,crx3&x=id%3D${extensionStoreId}%26installsource%3Dondemand%26uc`,
  ];

  for (const crxUrl of urlTemplates) {
    try {
      const crxBuffer = await downloadBuffer(crxUrl);

      if (!crxBuffer || crxBuffer.length < 100) continue;

      // Locate ZIP magic PK\x03\x04
      const pkIndex = crxBuffer.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
      if (pkIndex < 0) continue;

      const zipBuffer = crxBuffer.subarray(pkIndex);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      assertSafeZipBuffer(zipBuffer, targetDir);

      const tempZipPath = path.join(targetDir, '__temp_pkg.zip');
      fs.writeFileSync(tempZipPath, zipBuffer);

      try {
        execFileSync('tar', ['-xf', tempZipPath, '-C', targetDir], { stdio: 'ignore' });
      } catch {
        if (process.platform === 'win32') {
          const psScript = `Expand-Archive -LiteralPath '${tempZipPath.replace(/'/g, "''")}' -DestinationPath '${targetDir.replace(/'/g, "''")}' -Force`;
          const encodedPs = Buffer.from(psScript, 'utf16le').toString('base64');
          execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encodedPs], { stdio: 'ignore' });
        } else {
          execFileSync('unzip', ['-q', '-o', tempZipPath, '-d', targetDir], { stdio: 'ignore' });
        }
      } finally {
        if (fs.existsSync(tempZipPath)) {
          fs.rmSync(tempZipPath, { force: true });
        }
      }

      // Crucial for Chromium: Remove reserved _metadata directory and update_url from manifest
      const metaDir = path.join(targetDir, '_metadata');
      if (fs.existsSync(metaDir)) {
        try { fs.rmSync(metaDir, { recursive: true, force: true }); } catch (rmErr) { log.debug('extension-service _metadata cleanup skipped', { metaDir, err: rmErr }); }
      }

      const manifestPath = path.join(targetDir, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          let modified = false;
          if (manifest.update_url) {
            delete manifest.update_url;
            modified = true;
          }
          if (modified) {
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
          }
        } catch (manifestErr) {
          log.debug('extension-service manifest update_url strip skipped', { manifestPath, err: manifestErr });
        }
        return true;
      }
    } catch {
    }
  }

  return false;
}

export function getExtensions(profileId: string): ExtensionItem[] {
  const db = getDatabase();

  // Try to sync natively installed extensions from the profile directory
  try {
    const profile = getProfileById(profileId);
    if (profile?.storagePath) {
      const defaultExtDir = path.join(profile.storagePath, 'Default', 'Extensions');
      if (fs.existsSync(defaultExtDir)) {
        const extFolders = fs.readdirSync(defaultExtDir);
        for (const extFolder of extFolders) {
          const extPath = path.join(defaultExtDir, extFolder);
          if (!fs.statSync(extPath).isDirectory()) continue;

          const versions = fs.readdirSync(extPath).filter((v) => {
            const vPath = path.join(extPath, v);
            return fs.statSync(vPath).isDirectory() && fs.existsSync(path.join(vPath, 'manifest.json'));
          });

          if (versions.length === 0) continue;
          versions.sort();
          const latestVersion = versions[versions.length - 1];
          const versionDir = path.join(extPath, latestVersion);
          const manifestPath = path.join(versionDir, 'manifest.json');

          try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            const extName = resolveLocalizedText(versionDir, manifest.name) || extFolder;
            const extVersion = manifest.version || latestVersion;
            const extDesc = resolveLocalizedText(versionDir, manifest.description) || '';

            let iconPath: string | undefined ;
            if (manifest.icons) {
              const iconKey = Object.keys(manifest.icons).sort((a, b) => parseInt(b, 10) - parseInt(a, 10))[0];
              if (iconKey && manifest.icons[iconKey]) {
                iconPath = path.join(versionDir, manifest.icons[iconKey]);
              }
            }

            const existing = db.prepare('SELECT id FROM extensions WHERE profile_id = ? AND extension_id = ?').get(profileId, extFolder) as { id: string } | undefined;
            if (!existing) {
              const newId = crypto.randomUUID();
              db.prepare(`
                INSERT INTO extensions (id, profile_id, extension_id, name, version, description, enabled, source_type, source_path, icon_path, installed_at)
                VALUES (?, ?, ?, ?, ?, ?, 1, 'webstore', ?, ?, ?)
              `).run(
                newId,
                profileId,
                extFolder,
                extName,
                extVersion,
                extDesc || null,
                versionDir,
                iconPath || null,
                new Date().toISOString()
              );
            }
          } catch (manifestErr) {
            log.debug('extension-service native extension manifest parse skipped', { manifestPath, err: manifestErr });
          }
        }
      }
    }
  } catch (syncErr) {
    log.debug('extension-service native extension directory scan skipped', { profileId, err: syncErr });
  }

  const rows = db.prepare('SELECT * FROM extensions WHERE profile_id = ? ORDER BY name ASC').all(profileId) as {
    id: string;
    profile_id: string;
    extension_id: string;
    name: string;
    version: string;
    description: string | null;
    enabled: number;
    source_type: string;
    source_path: string;
    icon_path: string | null;
    installed_at: string;
  }[];

  return rows.map((r) => ({
    id: r.id,
    profileId: r.profile_id,
    extensionId: r.extension_id,
    name: r.name,
    version: r.version,
    description: r.description || undefined,
    enabled: Boolean(r.enabled),
    sourceType: r.source_type as ExtensionItem['sourceType'],
    sourcePath: r.source_path,
    iconPath: r.icon_path || undefined,
    installedAt: r.installed_at,
  }));
}

export function installExtension(dto: InstallExtensionDTO): ExtensionItem {
  const db = getDatabase();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  let name = dto.name || 'Custom Extension';
  let version = dto.version || '1.0.0';
  let description = '';
  const extensionId = crypto.randomBytes(8).toString('hex');
  let iconPath: string | undefined ;
  const srcPath = dto.sourcePath || (dto as InstallExtensionDTO & { location?: string }).location || '';

  // Check if directory with manifest.json
  if (srcPath) {
    const manifestPath = path.join(srcPath, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        if (manifest.name) name = resolveLocalizedText(srcPath, manifest.name) || manifest.name;
        if (manifest.version) version = manifest.version;
        if (manifest.description) description = resolveLocalizedText(srcPath, manifest.description) || manifest.description;
        if (manifest.icons) {
          const iconKey = Object.keys(manifest.icons).sort((a, b) => parseInt(b, 10) - parseInt(a, 10))[0];
          if (iconKey && manifest.icons[iconKey]) {
            iconPath = path.join(srcPath, manifest.icons[iconKey]);
          }
        }
      } catch (manifestErr) {
        log.debug('extension-service unpacked manifest parse failed, using defaults', { extPath: srcPath, err: manifestErr });
      }
    }
  }

  // Deduplicate: If same extension name already exists in this profile, remove it first
  const existing = getExtensions(dto.profileId).filter((e) => e.name === name);
  for (const old of existing) {
    db.prepare('DELETE FROM extensions WHERE id = ?').run(old.id);
  }

  db.prepare(`
    INSERT INTO extensions (id, profile_id, extension_id, name, version, description, enabled, source_type, source_path, icon_path, installed_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, 'unpacked', ?, ?, ?)
  `).run(
    id,
    dto.profileId,
    extensionId,
    name,
    version,
    description || null,
    srcPath,
    iconPath || null,
    now
  );

  logActivity('EXTENSION', 'SUCCESS', 'Install Extension', `Installed extension "${name}" (v${version})`, dto.profileId);

  return {
    id,
    profileId: dto.profileId,
    extensionId,
    name,
    version,
    description: description || undefined,
    enabled: true,
    sourceType: 'unpacked',
    sourcePath: srcPath,
    iconPath,
    installedAt: now,
  };
}

/**
 * Parses Chrome Web Store URL or ID and installs unpacked extension.
 */
export async function installFromWebStoreUrl(profileId: string, webStoreUrl: string): Promise<ExtensionItem> {
  const profile = getProfileById(profileId);
  if (!profile) throw new Error(`Profile ${profileId} not found`);

  // Extract 32-character extension ID
  let extId = webStoreUrl.trim();
  const urlMatch = webStoreUrl.match(/\/detail\/[^/]+\/([a-z]{32})/i) || webStoreUrl.match(/([a-z]{32})/i);
  if (urlMatch?.[1]) {
    extId = urlMatch[1].toLowerCase();
  }

  if (!/^[a-z]{32}$/.test(extId)) {
    throw new Error('Invalid Chrome Web Store URL or 32-character extension ID');
  }

  // Create extension directory
  const extDir = path.join(profile.storagePath, 'extensions', extId);
  const downloaded = await downloadAndExtractCrx(extId, extDir);
  if (!downloaded) {
    throw new Error(`Failed to download and extract extension (${extId}) from Chrome Web Store.`);
  }

  const manifestPath = path.join(extDir, 'manifest.json');
  let name = `Web Store Extension (${extId.slice(0, 8)})`;
  let version = '1.0.0';
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      name = resolveLocalizedText(extDir, manifest.name) || name;
      version = manifest.version || version;
    } catch (manifestErr) {
      log.debug('extension-service webstore manifest parse failed, using fallback metadata', { manifestPath, err: manifestErr });
    }
  }

  return installExtension({
    profileId,
    sourcePath: extDir,
    name,
    version,
  });
}

export function toggleExtension(profileId: string, extensionId: string, enabled: boolean): boolean {
  const db = getDatabase();
  db.prepare('UPDATE extensions SET enabled = ? WHERE profile_id = ? AND id = ?').run(
    enabled ? 1 : 0,
    profileId,
    extensionId
  );
  logActivity('EXTENSION', 'INFO', 'Toggle Extension', `Extension ${enabled ? 'enabled' : 'disabled'}`, profileId);
  return true;
}

function isStrictlyInsideRoot(candidate: string, root: string): boolean {
  const resolvedCandidate = path.resolve(candidate);
  const resolvedRoot = path.resolve(root);
  const rel = path.relative(resolvedRoot, resolvedCandidate);
  return Boolean(rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

export function removeExtension(profileId: string, extensionId: string): boolean {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM extensions WHERE profile_id = ? AND id = ?').get(profileId, extensionId) as {
    source_path?: string;
    extension_id?: string;
    name?: string;
  } | undefined;

  if (row?.source_path && fs.existsSync(row.source_path)) {
    try {
      const profile = getProfileById(profileId);
      const allowedRoots = [path.resolve(getProfilesDirectory())];
      if (profile?.storagePath) {
        allowedRoots.push(path.resolve(profile.storagePath));
      }
      const resolvedSrc = path.resolve(row.source_path);
      const isManagedProfilePath = allowedRoots.some((root) => isStrictlyInsideRoot(resolvedSrc, root));
      if (isManagedProfilePath) {
        if (resolvedSrc.includes(path.join('Default', 'Extensions'))) {
          const extParent = path.dirname(resolvedSrc);
          if (allowedRoots.some((root) => isStrictlyInsideRoot(extParent, root))) {
            fs.rmSync(extParent, { recursive: true, force: true });
          }
        } else {
          fs.rmSync(resolvedSrc, { recursive: true, force: true });
        }
      }
    } catch (rmErr) {
      log.warn(`[ExtensionService] Could not remove files at ${row.source_path}:`, rmErr);
    }
  }

  db.prepare('DELETE FROM extensions WHERE profile_id = ? AND id = ?').run(profileId, extensionId);
  logActivity('EXTENSION', 'WARNING', 'Remove Extension', `Removed extension ${row?.name || extensionId} from profile`, profileId);
  return true;
}
