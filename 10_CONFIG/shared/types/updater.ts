export type UpdateState = 
  | 'IDLE'
  | 'CHECKING'
  | 'AVAILABLE'
  | 'NOT_AVAILABLE'
  | 'DOWNLOADING'
  | 'DOWNLOADED'
  | 'INSTALLING'
  | 'ERROR';

export type UpdateChannel = 'STABLE' | 'BETA';

export interface UpdateProgress {
  bytesPerSecond: number;
  percent: number;
  total: number;
  transferred: number;
}

export interface UpdateReleaseFile {
  url: string;
  name: string;
  size: number;
  sha256?: string;
  sha512?: string;
  signature?: string;
  arch?: 'x64' | 'arm64' | 'ia32';
  platform?: 'win32' | 'darwin' | 'linux';
  format?: 'nsis' | 'portable' | 'dmg' | 'zip' | 'appimage' | 'deb';
  signatureStatus?: 'SIGNED' | 'UNSIGNED' | 'NOTARIZED';
}

export interface UpdateReleaseManifest {
  version: string;
  releaseDate: string;
  channel: UpdateChannel;
  minAppVersion?: string;
  mandatory?: boolean;
  releaseNotes: string;
  files: UpdateReleaseFile[];
  sha512?: string;
  sha256?: string;
  targetPlatform?: 'win32' | 'darwin' | 'linux';
}

export interface AppUpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string | Array<{ version: string; note: string }>;
  mandatory?: boolean;
  channel?: UpdateChannel;
}

export interface UpdateStatusEvent {
  state: UpdateState;
  currentVersion: string;
  availableVersion?: string;
  channel?: UpdateChannel;
  progress?: UpdateProgress;
  error?: string;
  releaseNotes?: string;
  mandatory?: boolean;
}

export interface UpdateConfig {
  channel: UpdateChannel;
  autoCheck: boolean;
  autoDownload: boolean;
  notifyBeforeRestart: boolean;
  feedUrl?: string;
  lastCheckedAt?: string;
}

export interface UpdateInstallOptions {
  force?: boolean;
}

export interface UpdateInstallResult {
  success: boolean;
  reason?: string;
  activeProfiles?: string[];
  error?: string;
}
