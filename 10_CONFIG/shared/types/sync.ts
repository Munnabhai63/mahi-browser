export type CloudSyncStatus = 'SYNCED' | 'PENDING' | 'LOCAL_ONLY' | 'SYNCING' | 'ERROR' | 'CONFLICT' | 'LOCKED';

export interface CloudProfileMetadata {
  id: string;
  name: string;
  size: number;
  size_mb: number;
  updated_at: string;
  hwid?: string;
}

export interface CloudSyncUsage {
  used_bytes: number;
  total_bytes: number;
  used_mb: number;
  total_mb: number;
  profile_count: number;
  quota_percent: number;
}

export interface CloudSyncConfig {
  autoSync: boolean;
  syncPassphrase: string;
  keyDerivationVersion?: 1 | 2;
}

export interface CloudSyncProgressEvent {
  stage: 'CHECKING' | 'PACKING' | 'UPLOADING' | 'DOWNLOADING' | 'EXTRACTING' | 'COMPLETED' | 'ERROR' | 'CONFLICT';
  profileId: string;
  percent: number;
  message?: string;
  error?: string;
}

export type CloudSyncMode = 'full' | 'cookies_only';

export interface CloudSyncUploadOptions {
  force?: boolean;
  baseVersion?: number;
  mode?: CloudSyncMode;
}

export interface CloudSyncUploadResult {
  success: boolean;
  skipped?: boolean;
  reason?: 'unchanged';
  mode?: CloudSyncMode;
  manifestHash?: string;
  cloudProfile?: {
    id: string;
    version?: number;
    deltaVersion?: number;
    name?: string;
  };
  conflict?: boolean;
  currentCloudVersion?: number;
  localBaseVersion?: number;
}

export interface CloudSyncRestoreOptions {
  overrideName?: string;
  targetFolder?: string;
  passphrase?: string;
  version?: number;
  targetLocalProfileId?: string;
  mode?: CloudSyncMode;
}

export type CloudSyncConflictResolution =
  | 'DOWNLOAD_LATEST'
  | 'KEEP_LOCAL_AS_NEW'
  | 'OVERWRITE_FORCE';

export interface RestoredCloudProfileSummary {
  id: string;
  name: string;
  folder?: string;
  status?: string;
}
