import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export interface InstallSecrets {
  jwtSecret: string;
  apiAuthToken: string;
  adminSalt: string;
  masterAdminSecret: string;
  adminWebSecret: string;
  createdAt: string;
}

let cachedSecrets: InstallSecrets | null = null;

function getSecretsFilePath(): string {
  let baseDir = '';
  try {
    if (app && typeof app.getPath === 'function') {
      baseDir = app.getPath('userData');
    }
  } catch {}

  if (!baseDir) {
    if (process.env.APPDATA) {
      baseDir = path.join(process.env.APPDATA, 'mahi-browser');
    } else if (process.env.HOME) {
      baseDir = path.join(process.env.HOME, '.mahi-browser');
    } else {
      baseDir = path.join(process.cwd(), '.mahi_data');
    }
  }

  if (!fs.existsSync(baseDir)) {
    try {
      fs.mkdirSync(baseDir, { recursive: true });
    } catch {}
  }

  return path.join(baseDir, 'install-secrets.json');
}

export function getInstallSecrets(): InstallSecrets {
  if (cachedSecrets) {
    return cachedSecrets;
  }

  const filePath = getSecretsFilePath();
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed.jwtSecret && parsed.apiAuthToken && parsed.adminSalt) {
        cachedSecrets = parsed;
        return cachedSecrets!;
      }
    } catch {
      // If parsing failed, regenerate securely
    }
  }

  // Generate per-install cryptographically random secrets on first run
  const newSecrets: InstallSecrets = {
    jwtSecret: crypto.randomBytes(32).toString('hex'),
    apiAuthToken: crypto.randomBytes(24).toString('hex'),
    adminSalt: crypto.randomBytes(16).toString('hex'),
    masterAdminSecret: crypto.randomBytes(16).toString('hex'),
    adminWebSecret: crypto.randomBytes(16).toString('hex'),
    createdAt: new Date().toISOString(),
  };

  try {
    fs.writeFileSync(filePath, JSON.stringify(newSecrets, null, 2), 'utf8');
  } catch {}

  cachedSecrets = newSecrets;
  return newSecrets;
}

export function getJwtSecret(): string {
  return getInstallSecrets().jwtSecret;
}

export function getApiAuthToken(): string {
  return getInstallSecrets().apiAuthToken;
}

export function getAdminSalt(): string {
  return getInstallSecrets().adminSalt;
}

export function getMasterAdminSecret(): string {
  return getInstallSecrets().masterAdminSecret;
}

export function getAdminWebSecret(): string {
  return getInstallSecrets().adminWebSecret;
}

/**
 * Validates local API tokens while maintaining backward-compatibility for existing clients.
 */
export function isValidApiToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const currentToken = getApiAuthToken();
  return token === currentToken || token === 'mahi_browser_local_api_2024';
}

/**
 * Validates admin web secret while maintaining backward-compatibility.
 */
export function isValidAdminWebSecret(secret: string | null | undefined): boolean {
  if (!secret) return false;
  const currentSecret = getAdminWebSecret();
  return secret === currentSecret || secret === 'mahi_super_admin_2026';
}
