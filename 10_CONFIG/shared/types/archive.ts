import { Profile } from './profile.js';
import { CookieItem } from './cookie.js';
import { HistoryItem } from './history.js';
import { ExtensionItem } from './extension.js';

export interface MahiProfileArchiveData {
  formatVersion: '1.0';
  exportedAt: string;
  appVersion: string;
  profile: Profile;
  cookies?: CookieItem[];
  history?: HistoryItem[];
  extensions?: ExtensionItem[];
  storageFiles?: Record<string, string>; // Essential storage files (Preferences, Local Storage, Cookies), caches excluded
}

export interface ExportProfileOptions {
  profileId: string;
  targetFilePath?: string;
  includeCookies: boolean;
  includeHistory: boolean;
  includeExtensions: boolean;
  includeBrowserSettings: boolean;
  includeStorage?: boolean;
  password?: string;
}

export interface BulkExportOptions {
  profileIds: string[];
  targetFilePath?: string;
  includeCookies: boolean;
  includeHistory: boolean;
  includeExtensions: boolean;
  password?: string;
}

export interface ImportProfileOptions {
  sourceFilePath: string;
  password?: string;
  overrideName?: string;
  targetFolder?: string;
  ownerId?: string;
}

export interface CrossPlatformImportDTO {
  platform: 'DOLPHIN' | 'ADSPOWER' | 'GOLOGIN' | 'GENERIC_JSON';
  jsonData: string;
  targetFolder?: string;
}

export interface CrossPlatformImportResult {
  success: boolean;
  importedCount: number;
  profiles: Profile[];
  errors?: string[];
}

export interface ImportProfilePreview {
  valid: boolean;
  formatVersion: string;
  exportedAt: string;
  profileName: string;
  folder: string;
  tags: string[];
  cookieCount: number;
  historyCount: number;
  extensionCount: number;
  browserEngine: string;
  isEncrypted: boolean;
  isBulk?: boolean;
  profileCount?: number;
  errorMessage?: string;
}

