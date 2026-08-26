import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import https from 'node:https';
import { execSync } from 'node:child_process';
import { getDatabase } from '../../06_DATABASE/connection.js';
import { ExtensionItem, InstallExtensionDTO } from '../../10_CONFIG/shared/types/extension.js';
import { getProfileById } from './profile-service.js';
import { logActivity } from '../../07_BACKEND/services/audit-service.js';

function downloadBuffer(url: string, maxRedirects = 5): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': '*/*',
      },
    };
    https.get(options, (res) => {
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
  });
}

/**
 * Downloads official CRX package from Google Web Store CDN and extracts pure ZIP payload
 */
export async function downloadAndExtractCrx(extensionStoreId: string, targetDir: string): Promise<boolean> {
  try {
    const crxUrl = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=131.0.0.0&acceptformat=crx2,crx3&x=id%3D${extensionStoreId}%26installsource%3Dondemand%26uc&nacl_arch=x86-64`;
    const crxBuffer = await downloadBuffer(crxUrl);

    if (!crxBuffer || crxBuffer.length < 100) {
      throw new Error(`CRX download returned empty or too small (${crxBuffer?.length || 0} bytes)`);
    }

    // Locate ZIP magic PK\x03\x04
    const pkIndex = crxBuffer.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    if (pkIndex < 0) {
      throw new Error('Invalid CRX archive: ZIP header not found');
    }

    const zipBuffer = crxBuffer.subarray(pkIndex);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const tempZipPath = path.join(targetDir, '__temp_pkg.zip');
    fs.writeFileSync(tempZipPath, zipBuffer);

    try {
      execSync(`tar -xf "${tempZipPath}" -C "${targetDir}"`, { stdio: 'ignore' });
    } catch {
      execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${tempZipPath}' -DestinationPath '${targetDir}' -Force"`, { stdio: 'ignore' });
    } finally {
      if (fs.existsSync(tempZipPath)) {
        fs.rmSync(tempZipPath, { force: true });
      }
    }

    // Crucial for Chromium: Remove reserved _metadata directory and update_url from manifest
    const metaDir = path.join(targetDir, '_metadata');
    if (fs.existsSync(metaDir)) {
      try { fs.rmSync(metaDir, { recursive: true, force: true }); } catch {}
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
      } catch {}
    }

    return fs.existsSync(manifestPath);
  } catch (err: any) {
    return false;
  }
}

export function getExtensions(profileId: string): ExtensionItem[] {
  const db = getDatabase();
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
  let extensionId = crypto.randomBytes(8).toString('hex');
  let iconPath: string | undefined = undefined;
  const srcPath = dto.sourcePath || (dto as any).location || '';

  // Check if directory with manifest.json
  if (srcPath) {
    const manifestPath = path.join(srcPath, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        if (manifest.name) name = manifest.name;
        if (manifest.version) version = manifest.version;
        if (manifest.description) description = manifest.description;
        if (manifest.icons) {
          const iconKey = Object.keys(manifest.icons).sort((a, b) => parseInt(b) - parseInt(a))[0];
          if (iconKey && manifest.icons[iconKey]) {
            iconPath = path.join(srcPath, manifest.icons[iconKey]);
          }
        }
      } catch {
        // use defaults
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
    sourcePath: dto.sourcePath,
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
  if (urlMatch && urlMatch[1]) {
    extId = urlMatch[1].toLowerCase();
  }

  if (extId.length !== 32) {
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
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (manifest.name && !manifest.name.startsWith('__MSG_')) {
        name = manifest.name;
      }
    } catch {}
  }

  return installExtension({
    profileId,
    sourcePath: extDir,
    name,
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

export function removeExtension(profileId: string, extensionId: string): boolean {
  const db = getDatabase();
  db.prepare('DELETE FROM extensions WHERE profile_id = ? AND id = ?').run(profileId, extensionId);
  logActivity('EXTENSION', 'WARNING', 'Remove Extension', `Removed extension from profile`, profileId);
  return true;
}
