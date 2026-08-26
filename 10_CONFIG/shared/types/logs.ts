export type LogSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

export type LogCategory =
  | 'PROFILE'
  | 'PROXY'
  | 'EXTENSION'
  | 'COOKIE'
  | 'COOKIES'
  | 'HISTORY'
  | 'AUTOMATION'
  | 'SECURITY'
  | 'SYSTEM'
  | 'API'
  | 'SETTINGS'
  | 'FLEET'
  | 'NETWORK'
  | 'WORKSPACE'
  | 'LICENSING';

export interface ActivityLogItem {
  id: string;
  timestamp: string;
  category: LogCategory;
  severity: LogSeverity;
  action: string;
  details: string;
  profileId?: string;
  profileName?: string;
  metadata?: Record<string, unknown>;
}

export interface ActivityLogFilter {
  category?: LogCategory;
  severity?: LogSeverity;
  profileId?: string;
  searchQuery?: string;
  limit?: number;
}
