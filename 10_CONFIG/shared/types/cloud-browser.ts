/**
 * MAHI Browser — Cloud Browser Infrastructure Types
 * Phase 10 Architecture
 */

export type CloudSessionState =
  | 'REQUESTED'
  | 'QUEUED'
  | 'ALLOCATING'
  | 'PREPARING_PROFILE'
  | 'STARTING_BROWSER'
  | 'RUNNING'
  | 'IDLE_WARNING'
  | 'STOPPING'
  | 'SYNCING'
  | 'COMPLETED'
  | 'FAILED'
  | 'TIMED_OUT'
  | 'TERMINATED';

export type CloudWorkerStatus = 'ONLINE' | 'BUSY' | 'DRAINING' | 'OFFLINE';

export type CloudResourceClass = 'STANDARD' | 'PRO' | 'HIGH_PERF';

export interface CloudBrowserRegion {
  id: string;
  name: string;
  endpointUrl: string;
  status: 'ACTIVE' | 'MAINTENANCE' | 'DEPRECATED';
  isDefault: boolean;
  createdAt: string;
}

export interface CloudBrowserWorker {
  id: string;
  regionId: string;
  hostname: string;
  ipAddress: string;
  status: CloudWorkerStatus;
  capacity: number;
  activeSessions: number;
  cpuUsagePct: number;
  memoryUsageMb: number;
  lastHeartbeatAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CloudBrowserSession {
  id: string;
  userId: string;
  workspaceId?: string;
  profileId: string;
  workerId?: string;
  regionId: string;
  status: CloudSessionState;
  resourceClass: CloudResourceClass;
  profileVersion: number;
  lockId?: string;
  sessionTokenHash?: string;
  streamGatewayUrl?: string;
  cdpPort?: number;
  durationSeconds: number;
  maxDurationSeconds: number;
  idleTimeoutSeconds: number;
  lastActivityAt: string;
  startedAt?: string;
  endedAt?: string;
  terminationReason?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CloudSessionEvent {
  id: string;
  sessionId: string;
  userId: string;
  eventType: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface CloudSessionUsage {
  id: string;
  userId: string;
  workspaceId?: string;
  sessionId: string;
  durationSeconds: number;
  resourceClass: CloudResourceClass;
  regionId: string;
  createdAt: string;
}

export interface RequestCloudSessionDTO {
  profileId: string;
  workspaceId?: string;
  regionId?: string;
  resourceClass?: CloudResourceClass;
  maxDurationSeconds?: number;
  idleTimeoutSeconds?: number;
  startupUrl?: string;
}

export interface CloudSessionTokenPayload {
  sessionId: string;
  userId: string;
  workspaceId?: string;
  profileId: string;
  workerId: string;
  exp: number;
  nonce: string;
}

export interface CloudStreamFrame {
  type: 'frame';
  data: string; // Base64 encoded JPEG / PNG
  metadata: {
    offsetTop: number;
    pageScaleFactor: number;
    deviceWidth: number;
    deviceHeight: number;
    scrollOffsetX: number;
    scrollOffsetY: number;
    timestamp: number;
  };
}

export type CloudClientAction =
  | { type: 'mouseClick'; x: number; y: number; button?: 'left' | 'right' | 'middle'; clickCount?: number }
  | { type: 'mouseMove'; x: number; y: number }
  | { type: 'mouseWheel'; deltaX: number; deltaY: number; x: number; y: number }
  | { type: 'keyDown'; key: string; code?: string; text?: string }
  | { type: 'keyUp'; key: string; code?: string }
  | { type: 'navigate'; url: string }
  | { type: 'reload' }
  | { type: 'goBack' }
  | { type: 'goForward' }
  | { type: 'setViewport'; width: number; height: number; deviceScaleFactor?: number }
  | { type: 'ping' };

export type CloudServerMessage =
  | CloudStreamFrame
  | { type: 'status'; state: CloudSessionState; message?: string }
  | { type: 'heartbeat'; timestamp: number }
  | { type: 'pong' }
  | { type: 'error'; code: string; message: string };
