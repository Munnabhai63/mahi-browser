/**
 * MAHI Browser — Remote Cloud API & Webhooks Types
 * Phase 6 Architecture
 */

import { TeamRole, TeamPermission } from './workspace.js';
import { CommercialRole } from './commercial.js';

// ============================================================================
// REMOTE API SCOPES
// ============================================================================

export type RemoteApiScope =
  | 'profiles:read'
  | 'profiles:write'
  | 'profiles:run'
  | 'profiles:delete'
  | 'proxy:read'
  | 'proxy:create'
  | 'proxy:assign'
  | 'proxy:rotate'
  | 'workspace:read'
  | 'workspace:manage'
  | 'automation:read'
  | 'automation:write'
  | 'automation:run'
  | 'webhooks:read'
  | 'webhooks:manage'
  | 'sync:read'
  | 'sync:write';

export const ALL_REMOTE_API_SCOPES: RemoteApiScope[] = [
  'profiles:read',
  'profiles:write',
  'profiles:run',
  'profiles:delete',
  'proxy:read',
  'proxy:create',
  'proxy:assign',
  'proxy:rotate',
  'workspace:read',
  'workspace:manage',
  'automation:read',
  'automation:write',
  'automation:run',
  'webhooks:read',
  'webhooks:manage',
  'sync:read',
  'sync:write',
];

// ============================================================================
// API KEY MODELS
// ============================================================================

export type ApiKeyStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';

export interface RemoteApiKeyRecord {
  id: string;
  userId: string;
  workspaceId?: string | null;
  name: string;
  keyPrefix: string;
  keyHash: string;
  scopes: RemoteApiScope[];
  status: ApiKeyStatus;
  rateLimitPerMin: number;
  requestsCountMonth: number;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  revokedAt?: string | null;
}

export interface CreateRemoteApiKeyDTO {
  name: string;
  workspaceId?: string | null;
  scopes?: RemoteApiScope[];
  rateLimitPerMin?: number;
  expiresInDays?: number;
}

export interface RemoteApiKeyAuditRecord {
  id: string;
  keyId: string;
  userId: string;
  action: 'CREATED' | 'REVOKED' | 'ROTATED' | 'SCOPE_DENIED' | 'RATE_LIMITED';
  ipAddress?: string;
  details?: string;
  createdAt: string;
}

// ============================================================================
// AUTH CONTEXT
// ============================================================================

export interface RemoteAuthContext {
  authType: 'JWT' | 'API_KEY';
  userId: string;
  email: string;
  userRole: CommercialRole;
  apiKeyId?: string;
  apiKeyPrefix?: string;
  apiKeyScopes?: RemoteApiScope[];
  workspaceId?: string;
  workspaceRole?: TeamRole;
  sessionId?: string;
}

// ============================================================================
// WEBHOOK MODELS
// ============================================================================

export type WebhookEventType =
  | 'profile.created'
  | 'profile.updated'
  | 'profile.deleted'
  | 'profile.synced'
  | 'profile.conflict'
  | 'profile.locked'
  | 'workspace.member.invited'
  | 'workspace.member.joined'
  | 'workspace.member.removed'
  | 'proxy.created'
  | 'proxy.rotated'
  | 'proxy.failed'
  | 'automation.started'
  | 'automation.completed'
  | 'automation.failed'
  | 'test.ping';

export const ALL_WEBHOOK_EVENTS: WebhookEventType[] = [
  'profile.created',
  'profile.updated',
  'profile.deleted',
  'profile.synced',
  'profile.conflict',
  'profile.locked',
  'workspace.member.invited',
  'workspace.member.joined',
  'workspace.member.removed',
  'proxy.created',
  'proxy.rotated',
  'proxy.failed',
  'automation.started',
  'automation.completed',
  'automation.failed',
  'test.ping',
];

export type WebhookEndpointStatus = 'ACTIVE' | 'DISABLED' | 'REVOKED';

export interface WebhookEndpointRecord {
  id: string;
  userId: string;
  workspaceId?: string | null;
  url: string;
  description?: string;
  secretHash: string;
  secretEncrypted: string;
  events: WebhookEventType[];
  status: WebhookEndpointStatus;
  failureCount: number;
  lastDeliveryAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWebhookEndpointDTO {
  url: string;
  description?: string;
  workspaceId?: string | null;
  events?: WebhookEventType[];
}

export interface WebhookDeliveryRecord {
  id: string;
  endpointId: string;
  eventId: string;
  eventType: WebhookEventType;
  payloadJson: string;
  destinationUrl: string;
  statusCode?: number;
  responseBody?: string;
  durationMs?: number;
  attemptCount: number;
  success: boolean;
  errorMessage?: string;
  deliveredAt: string;
}

export interface WebhookPayload<T = unknown> {
  id: string;
  event: WebhookEventType;
  createdAt: string;
  data: T;
  actor?: {
    userId: string;
    email?: string;
  };
  workspaceId?: string;
}

// ============================================================================
// STANDARD REMOTE API RESPONSE & ERROR MODELS
// ============================================================================

export interface RemoteApiErrorDetails {
  code: string;
  message: string;
  requestId: string;
  details?: unknown;
}

export interface RemoteApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: RemoteApiErrorDetails;
  meta?: {
    requestId: string;
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

// ============================================================================
// PROFILE RUN & DEVICE FOUNDATION
// ============================================================================

export interface RemoteProfileRunResult {
  launched: boolean;
  profileId: string;
  status: 'LAUNCHED' | 'QUEUED' | 'DEVICE_REQUIRED' | 'DEVICE_OFFLINE';
  message: string;
  deviceId?: string;
  suggestedAction?: string;
}
