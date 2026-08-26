export interface ProfileResourceUsage {
  profileId: string;
  pid: number;
  memoryMB: number;
  cpuPercent: number;
  uptimeSeconds: number;
}

export interface FleetResourceSummary {
  totalMemoryMB: number;
  totalCpuPercent: number;
  activeProfilesCount: number;
  profiles: Record<string, ProfileResourceUsage>;
}

export interface MasterVaultBundle {
  format: 'MAHI_MASTER_VAULT_V1';
  version: string;
  createdAt: string;
  encrypted: boolean;
  salt?: string;
  iv?: string;
  authTag?: string;
  payload: string; // JSON string of all tables or encrypted ciphertext
  metadata: {
    profilesCount: number;
    proxiesCount: number;
    workflowsCount: number;
    workspacesCount: number;
  };
}

export interface MasterVaultExportOptions {
  filePath?: string;
  password?: string;
  includeCookies?: boolean;
  includeHistory?: boolean;
}

export interface MasterVaultImportResult {
  success: boolean;
  profilesRestored: number;
  proxiesRestored: number;
  workflowsRestored: number;
  workspacesRestored: number;
  message?: string;
}
