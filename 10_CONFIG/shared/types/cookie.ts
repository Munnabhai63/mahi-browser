export interface CookieItem {
  id: string;
  profileId: string;
  domain: string;
  name: string;
  value: string;
  path: string;
  expires?: number; // Unix timestamp in seconds or -1 for session
  httpOnly: boolean;
  secure: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export interface CookieFilterOptions {
  profileId: string;
  searchQuery?: string;
  domain?: string;
}

export interface CookieExportOptions {
  profileId: string;
  format: 'json' | 'netscape';
  includeSensitive: boolean;
}

export interface CookieImportResult {
  importedCount: number;
  failedCount: number;
  errors: string[];
}
