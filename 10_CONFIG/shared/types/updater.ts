export type UpdateState = 
  | 'IDLE'
  | 'CHECKING'
  | 'AVAILABLE'
  | 'NOT_AVAILABLE'
  | 'DOWNLOADING'
  | 'DOWNLOADED'
  | 'ERROR';

export interface UpdateProgress {
  bytesPerSecond: number;
  percent: number;
  total: number;
  transferred: number;
}

export interface AppUpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string | Array<{ version: string; note: string }>;
  mandatory?: boolean;
}

export interface UpdateStatusEvent {
  state: UpdateState;
  currentVersion: string;
  availableVersion?: string;
  progress?: UpdateProgress;
  error?: string;
  releaseNotes?: string;
}
