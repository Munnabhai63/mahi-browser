export type MemberRole = 'ADMIN' | 'EDITOR' | 'VIEWER';

export type MemberStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED';

export interface TeamMember {
  id: string;
  workspaceId: string;
  name: string;
  email: string;
  role: MemberRole;
  status: MemberStatus;
  avatarColor?: string;
  assignedProfileIds: string[];
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  color?: string;
  isDefault: boolean;
  memberCount: number;
  profileCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkspaceDTO {
  name: string;
  description?: string;
  color?: string;
}

export interface CreateMemberDTO {
  workspaceId: string;
  name: string;
  email: string;
  role: MemberRole;
}

export interface WorkspaceBundleExportOptions {
  workspaceId: string;
  includeCookies: boolean;
  includeExtensions: boolean;
  password?: string;
}

// ============================================================================
// PHASE 3: MULTI-USER TEAM WORKSPACE & RBAC TYPES
// ============================================================================

export type TeamRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER';

export type TeamPermission =
  | 'WORKSPACE_VIEW'
  | 'WORKSPACE_EDIT'
  | 'WORKSPACE_DELETE'
  | 'WORKSPACE_TRANSFER'
  | 'MEMBER_INVITE'
  | 'MEMBER_REMOVE'
  | 'MEMBER_ROLE_CHANGE'
  | 'PROFILE_VIEW'
  | 'PROFILE_RUN'
  | 'PROFILE_EDIT'
  | 'PROFILE_DELETE'
  | 'PROFILE_SHARE'
  | 'PROFILE_SYNC'
  | 'PROXY_VIEW'
  | 'PROXY_EDIT'
  | 'AUTOMATION_RUN'
  | 'AUTOMATION_EDIT'
  | 'AUDIT_VIEW';

export const ROLE_PERMISSIONS: Record<TeamRole, TeamPermission[]> = {
  OWNER: [
    'WORKSPACE_VIEW',
    'WORKSPACE_EDIT',
    'WORKSPACE_DELETE',
    'WORKSPACE_TRANSFER',
    'MEMBER_INVITE',
    'MEMBER_REMOVE',
    'MEMBER_ROLE_CHANGE',
    'PROFILE_VIEW',
    'PROFILE_RUN',
    'PROFILE_EDIT',
    'PROFILE_DELETE',
    'PROFILE_SHARE',
    'PROFILE_SYNC',
    'PROXY_VIEW',
    'PROXY_EDIT',
    'AUTOMATION_RUN',
    'AUTOMATION_EDIT',
    'AUDIT_VIEW',
  ],
  ADMIN: [
    'WORKSPACE_VIEW',
    'WORKSPACE_EDIT',
    'MEMBER_INVITE',
    'MEMBER_REMOVE',
    'MEMBER_ROLE_CHANGE',
    'PROFILE_VIEW',
    'PROFILE_RUN',
    'PROFILE_EDIT',
    'PROFILE_DELETE',
    'PROFILE_SHARE',
    'PROFILE_SYNC',
    'PROXY_VIEW',
    'PROXY_EDIT',
    'AUTOMATION_RUN',
    'AUTOMATION_EDIT',
    'AUDIT_VIEW',
  ],
  MANAGER: [
    'WORKSPACE_VIEW',
    'MEMBER_INVITE',
    'PROFILE_VIEW',
    'PROFILE_RUN',
    'PROFILE_EDIT',
    'PROFILE_SHARE',
    'PROFILE_SYNC',
    'PROXY_VIEW',
    'PROXY_EDIT',
    'AUTOMATION_RUN',
    'AUTOMATION_EDIT',
    'AUDIT_VIEW',
  ],
  MEMBER: [
    'WORKSPACE_VIEW',
    'PROFILE_VIEW',
    'PROFILE_RUN',
    'PROFILE_SYNC',
    'PROXY_VIEW',
    'AUTOMATION_RUN',
  ],
  VIEWER: [
    'WORKSPACE_VIEW',
    'PROFILE_VIEW',
    'AUDIT_VIEW',
  ],
};

export interface TeamWorkspace {
  id: string;
  name: string;
  description: string;
  ownerUserId: string;
  ownerEmail?: string;
  ownerName?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  profileCount: number;
  userRole?: TeamRole;
  userPermissions?: TeamPermission[];
}

export interface TeamWorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  email: string;
  name: string;
  role: TeamRole;
  status: 'ACTIVE' | 'INVITED' | 'REMOVED' | 'SUSPENDED';
  joinedAt: string;
  invitedBy?: string;
  createdAt: string;
}

export interface TeamWorkspaceInvitation {
  id: string;
  workspaceId: string;
  workspaceName?: string;
  email: string;
  role: TeamRole;
  invitedBy: string;
  invitedByName?: string;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  expiresAt: string;
  createdAt: string;
}

export interface TeamProfileShare {
  id: string;
  workspaceId: string;
  cloudProfileId: string;
  profileName?: string;
  sharedBy: string;
  sharedByName?: string;
  permissionLevel: 'VIEW' | 'RUN' | 'EDIT' | 'ADMIN';
  encryptedKeyEnvelope: string;
  createdAt: string;
  revokedAt?: string | null;
  lockStatus?: {
    isLocked: boolean;
    lockedByDevice?: string;
    expiresAt?: string;
  };
}

export interface TeamWorkspaceAuditLog {
  id: string;
  workspaceId: string;
  userId: string;
  userEmail?: string;
  action: string;
  targetId?: string;
  details?: string;
  createdAt: string;
}
