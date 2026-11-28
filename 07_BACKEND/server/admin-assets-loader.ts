import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ALLOWED_ADMIN_ASSETS: Record<string, string> = {
  'admin.css': 'text/css; charset=utf-8',
  'download-portal.css': 'text/css; charset=utf-8',
  'download-portal-tailwind.js': 'application/javascript; charset=utf-8',
  'download-portal.js': 'application/javascript; charset=utf-8',
  'owner-admin.js': 'application/javascript; charset=utf-8',
  'super-admin.js': 'application/javascript; charset=utf-8',
  'web-admin.js': 'application/javascript; charset=utf-8',
};

function getAssetCandidateDirectories(): string[] {
  return [
    path.join(__dirname, 'assets'),
    path.resolve(__dirname, '../admin-assets'),
    path.join(process.cwd(), '07_BACKEND', 'server', 'assets'),
  ];
}

export async function loadAdminAssetAsync(
  assetName: string
): Promise<{ content: Buffer; contentType: string } | null> {
  const cleanName = path.posix.basename(assetName);
  if (cleanName !== assetName || !Object.hasOwn(ALLOWED_ADMIN_ASSETS, cleanName)) {
    return null;
  }

  const contentType = ALLOWED_ADMIN_ASSETS[cleanName];
  for (const dir of getAssetCandidateDirectories()) {
    const candidate = path.join(dir, cleanName);
    try {
      const stat = await fs.promises.stat(candidate);
      if (stat.isFile()) {
        const content = await fs.promises.readFile(candidate);
        return { content, contentType };
      }
    } catch {
      // Check next packaged or source asset directory
    }
  }

  return null;
}
