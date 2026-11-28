import type {
  AuthSecurityLogResult,
  AuthSessionCreateInput,
  AuthSessionRecord,
  AuthSessionUpdateInput,
  AuthUserCreateInput,
  AuthUserRecord,
  AuthUserUpdateInput,
  AuthVerificationTokenCreateInput,
  AuthVerificationTokenRecord,
  CloudProfileCreateInput,
  CloudProfileDeltaCreateInput,
  CloudProfileDeltaRecord,
  CloudProfileLockRecord,
  CloudProfileLockUpsertInput,
  CloudProfileRecord,
  CloudProfileUpdateInput,
  CloudProfileVersionCreateInput,
  CloudProfileVersionRecord,
  CloudSyncAuditLogResult,
  CloudUploadSessionCreateInput,
  CloudUploadSessionRecord,
  CloudUploadSessionUpdateInput,
  CommercialUserCreateInput,
  CommercialUserRecord,
  CommercialUserUpdateInput,
  RemoteApiKeyAuditResult,
  RemoteApiKeyCreateInput,
  RemoteApiKeyRecord,
  TeamWorkspaceCreateInput,
  TeamWorkspaceMemberCreateInput,
  TeamWorkspaceMemberRecord,
  TeamWorkspaceRecord,
  TeamWorkspaceUpdateInput,
  WebHandoffSessionCreateInput,
  WebHandoffSessionRecord,
  WebHandoffUserPayload,
} from './central-repository-types.js';

export * from './central-repository-types.js';

export interface CentralRepository {
  backendName: 'postgres' | 'sqlite';

  // Auth Users
  findAuthUserByEmail(email: string): Promise<AuthUserRecord | null>;
  findAuthUserById(id: string): Promise<AuthUserRecord | null>;
  createAuthUser(data: AuthUserCreateInput): Promise<AuthUserRecord | null>;
  updateAuthUser(id: string, data: AuthUserUpdateInput): Promise<AuthUserRecord | null>;
  updateAuthUserTerms(userId: string, acceptedTerms: number, termsVersion: string): Promise<boolean>;

  // Auth Sessions
  createAuthSession(data: AuthSessionCreateInput): Promise<AuthSessionRecord | AuthSessionCreateInput>;
  findAuthSessionByTokenHash(tokenHash: string): Promise<AuthSessionRecord | null>;
  updateAuthSession(id: string, data: AuthSessionUpdateInput): Promise<AuthSessionRecord | boolean | null>;
  revokeAuthSession(id: string): Promise<boolean>;
  revokeAllUserSessions(userId: string): Promise<number>;
  listUserAuthSessions(userId: string): Promise<AuthSessionRecord[]>;

  // Verification Tokens
  createVerificationToken(
    data: AuthVerificationTokenCreateInput
  ): Promise<AuthVerificationTokenRecord | AuthVerificationTokenCreateInput>;
  findVerificationTokenByHash(tokenHash: string): Promise<AuthVerificationTokenRecord | null>;
  consumeVerificationToken(tokenHash: string): Promise<AuthVerificationTokenRecord | null>;
  invalidatePendingVerificationTokens(userId: string, type?: string): Promise<number>;

  // Convenience Aliases for Auth Flow
  findUserByEmail?(email: string): Promise<AuthUserRecord | null>;
  findUserById?(id: string): Promise<AuthUserRecord | null>;
  createUser?(data: AuthUserCreateInput): Promise<AuthUserRecord | null>;
  updateUser?(id: string, data: AuthUserUpdateInput): Promise<AuthUserRecord | null>;
  updateUserLastLogin?(id: string, timestamp?: string): Promise<AuthUserRecord | null>;
  updateUserPassword?(id: string, passwordHash: string, salt: string): Promise<AuthUserRecord | null>;
  markUserEmailVerified?(id: string): Promise<AuthUserRecord | null>;
  createSession?(data: AuthSessionCreateInput): Promise<AuthSessionRecord | AuthSessionCreateInput>;
  findSessionByTokenHash?(tokenHash: string): Promise<AuthSessionRecord | null>;
  rotateSessionToken?(
    sessionId: string,
    newHash: string,
    expiresAt: string,
    ip?: string
  ): Promise<AuthSessionRecord | boolean | null>;
  findVerificationToken?(tokenHash: string): Promise<AuthVerificationTokenRecord | null>;
  markVerificationTokenUsed?(tokenHashOrId: string): Promise<AuthVerificationTokenRecord | null>;

  // Security Logs
  logAuthSecurity(
    userId: string | null,
    action: string,
    details?: string,
    ip?: string,
    result?: string
  ): Promise<AuthSecurityLogResult>;

  // Commercial Users
  findCommercialUserById(id: string): Promise<CommercialUserRecord | null>;
  findCommercialUserByEmail(email: string): Promise<CommercialUserRecord | null>;
  createCommercialUser(data: CommercialUserCreateInput): Promise<CommercialUserRecord | null>;
  updateCommercialUser(id: string, data: CommercialUserUpdateInput): Promise<CommercialUserRecord | null>;

  // Cloud Profiles
  findCloudProfileById(id: string): Promise<CloudProfileRecord | null>;
  createCloudProfile(data: CloudProfileCreateInput): Promise<CloudProfileRecord | null>;
  updateCloudProfile(id: string, data: CloudProfileUpdateInput): Promise<CloudProfileRecord | null>;
  deleteCloudProfile(id: string): Promise<boolean>;
  listCloudProfiles(ownerId: string): Promise<CloudProfileRecord[]>;

  // Cloud Versions
  createCloudProfileVersion(
    data: CloudProfileVersionCreateInput
  ): Promise<CloudProfileVersionRecord | CloudProfileVersionCreateInput>;
  getLatestCloudProfileVersion(cloudProfileId: string): Promise<CloudProfileVersionRecord | null>;
  getCloudProfileVersion(cloudProfileId: string, version: number): Promise<CloudProfileVersionRecord | null>;

  // Cloud Deltas
  createCloudProfileDelta?(
    data: CloudProfileDeltaCreateInput
  ): Promise<CloudProfileDeltaRecord | CloudProfileDeltaCreateInput | null>;
  getLatestCloudProfileDelta?(cloudProfileId: string): Promise<CloudProfileDeltaRecord | null>;

  // Upload Sessions
  createUploadSessionRecord(
    data: CloudUploadSessionCreateInput
  ): Promise<CloudUploadSessionRecord | CloudUploadSessionCreateInput>;
  findUploadSessionById(id: string): Promise<CloudUploadSessionRecord | null>;
  updateUploadSessionRecord(
    id: string,
    data: CloudUploadSessionUpdateInput
  ): Promise<CloudUploadSessionRecord | boolean | null>;

  // Cloud Sync Audits
  logCloudSyncAudit(
    userId: string,
    action: string,
    details?: string,
    cloudProfileId?: string,
    deviceId?: string
  ): Promise<CloudSyncAuditLogResult>;

  // Team Workspaces
  findWorkspaceById(id: string): Promise<TeamWorkspaceRecord | null>;
  createWorkspace(data: TeamWorkspaceCreateInput): Promise<TeamWorkspaceRecord | null>;
  updateWorkspace(id: string, data: TeamWorkspaceUpdateInput): Promise<TeamWorkspaceRecord | null>;
  deleteWorkspace(id: string): Promise<boolean>;
  listUserWorkspaces(userId: string): Promise<TeamWorkspaceRecord[]>;

  // Team Workspace Members
  addWorkspaceMember(
    data: TeamWorkspaceMemberCreateInput
  ): Promise<TeamWorkspaceMemberRecord | TeamWorkspaceMemberCreateInput>;
  findWorkspaceMember(workspaceId: string, userId: string): Promise<TeamWorkspaceMemberRecord | null>;
  listWorkspaceMembers(workspaceId: string): Promise<TeamWorkspaceMemberRecord[]>;
  updateWorkspaceMemberRole(
    workspaceId: string,
    userId: string,
    role: string
  ): Promise<{ count: number } | boolean>;
  removeWorkspaceMember(workspaceId: string, userId: string): Promise<boolean>;

  // Remote API Keys
  findRemoteApiKeyByHash(keyHash: string): Promise<RemoteApiKeyRecord | null>;
  createRemoteApiKey(data: RemoteApiKeyCreateInput): Promise<RemoteApiKeyRecord | RemoteApiKeyCreateInput>;
  listRemoteApiKeys(userId: string): Promise<RemoteApiKeyRecord[]>;
  revokeRemoteApiKey(id: string, userId?: string): Promise<boolean>;
  updateRemoteApiKeyLastUsed(id: string): Promise<RemoteApiKeyRecord | boolean>;

  // Remote API Key Audits
  logRemoteApiKeyAudit(
    apiKeyId: string,
    userId: string,
    endpoint: string,
    method: string,
    statusCode: number,
    ipAddress?: string
  ): Promise<RemoteApiKeyAuditResult>;

  // Cloud Profile Locks (DB persistence fallback)
  findLock(cloudProfileId: string): Promise<CloudProfileLockRecord | null>;
  upsertLock(data: CloudProfileLockUpsertInput): Promise<CloudProfileLockRecord | CloudProfileLockUpsertInput>;
  deleteLock(cloudProfileId: string): Promise<boolean>;

  // Web Handoff Sessions
  createWebHandoffSession(
    data: WebHandoffSessionCreateInput
  ): Promise<WebHandoffSessionRecord | WebHandoffSessionCreateInput>;
  consumeWebHandoffSessionAtomically(
    code: string,
    now: number
  ): Promise<{ token: string; user: WebHandoffUserPayload | null } | null>;
}
