export type CloudSyncStatus = 'SYNCED' | 'PENDING' | 'LOCAL_ONLY' | 'SYNCING' | 'ERROR';

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
}

export interface CloudSyncProgressEvent {
  stage: 'CHECKING' | 'PACKING' | 'UPLOADING' | 'DOWNLOADING' | 'EXTRACTING' | 'COMPLETED' | 'ERROR';
  profileId: string;
  percent: number;
  message?: string;
  error?: string;
}
