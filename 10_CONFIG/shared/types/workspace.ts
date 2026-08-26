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
