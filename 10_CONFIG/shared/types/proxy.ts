export type ProxyProtocol = 'http' | 'https' | 'socks4' | 'socks5';

export type ProxyStatus = 'CONNECTED' | 'FAILED' | 'UNKNOWN' | 'TESTING' | 'LIVE' | 'READY';

export interface ProxyItem {
  id: string;
  name: string;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  username?: string;
  password?: string; // Stored encrypted at rest, sanitized when sent to renderer
  hasPassword?: boolean; // Safe flag indicating presence
  countryRegion?: string; // ISO 3166-1 alpha-2 (e.g. US, GB, IN, DE)
  countryName?: string;
  city?: string;
  region?: string;
  timezone?: string;
  isp?: string;
  asn?: string;
  ip?: string;
  notes?: string;
  status: ProxyStatus;
  latencyMs?: number;
  lastTestedAt?: string;
  assignedProfileCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProxyDTO {
  name: string;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  username?: string;
  password?: string;
  countryRegion?: string;
  countryName?: string;
  city?: string;
  region?: string;
  timezone?: string;
  isp?: string;
  asn?: string;
  ip?: string;
  notes?: string;
}

export interface UpdateProxyDTO {
  name?: string;
  protocol?: ProxyProtocol;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  countryRegion?: string;
  countryName?: string;
  city?: string;
  region?: string;
  timezone?: string;
  isp?: string;
  asn?: string;
  ip?: string;
  status?: ProxyStatus;
  latencyMs?: number;
  notes?: string;
}

export interface ProxyTestResult {
  success: boolean;
  latencyMs: number;
  ip?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  timezone?: string;
  isp?: string;
  asn?: string;
  org?: string;
  errorCode?: string;
  errorMessage?: string;
}
