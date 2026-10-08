import React, { useState } from 'react';
import {
  Layers,
  UserPlus,
  Users,
  Shield,
  Trash2,
  Share2,
  Mail,
  Plus,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  TeamWorkspace,
  TeamWorkspaceMember,
  TeamRole,
  TeamProfileShare,
} from '../../../10_CONFIG/shared/types/workspace.js';
import { CreateWorkspaceModal, InviteMemberModal } from '../components/WorkspaceModal.js';
import { ConfirmModal } from '../components/ConfirmModal.js';

interface WorkspacesPageProps {
  workspaces: TeamWorkspace[];
  currentWorkspace: TeamWorkspace | null;
  members: TeamWorkspaceMember[];
  sharedProfiles: TeamProfileShare[];
  currentUserRole?: TeamRole;
  isLoading: boolean;
  onSelectWorkspace: (ws: TeamWorkspace | null) => void;
  onCreateWorkspace: (name: string, desc?: string) => Promise<void>;
  onInviteMember: (email: string, role: TeamRole) => Promise<void>;
  onUpdateRole: (targetUserId: string, role: TeamRole) => Promise<void>;
  onRemoveMember: (targetUserId: string) => Promise<void>;
  onShareProfile: (profileId: string, level: string) => Promise<void>;
}

export const WorkspacesPage: React.FC<WorkspacesPageProps> = ({
  workspaces,
  currentWorkspace,
  members,
  sharedProfiles,
  currentUserRole = 'OWNER',
  isLoading,
  onSelectWorkspace,
  onCreateWorkspace,
  onInviteMember,
  onUpdateRole,
  onRemoveMember,
  onShareProfile,
}) => {
  const [activeTab, setActiveTab] = useState<'MEMBERS' | 'SHARES' | 'SETTINGS'>('MEMBERS');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [removingMember, setRemovingMember] = useState<TeamWorkspaceMember | null>(null);
  const [isRemovingPending, setIsRemovingPending] = useState(false);

  // RBAC checks
  const canManageMembers = currentUserRole === 'OWNER' || currentUserRole === 'ADMIN';

  const handleConfirmRemoveMember = async () => {
    if (!removingMember) return;
    setIsRemovingPending(true);
    try {
      await onRemoveMember(removingMember.userId);
      setRemovingMember(null);
    } finally {
      setIsRemovingPending(false);
    }
  };

  const getRoleBadge = (role: TeamRole) => {
    switch (role) {
      case 'OWNER':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            OWNER
          </span>
        );
      case 'ADMIN':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-400 border border-teal-500/30">
            ADMIN
          </span>
        );
      case 'MEMBER':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            MEMBER
          </span>
        );
      case 'VIEWER':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
            VIEWER
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Team Workspaces & RBAC</h2>
          <p className="text-xs text-slate-400">
            Collaborative environments, role-based access control, and shared profile partitions
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-teal-600/20 flex items-center space-x-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Workspace</span>
          </button>
        </div>
      </div>

      {/* Workspace Selection Shelf */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Personal Workspace Card */}
        <div
          onClick={() => onSelectWorkspace(null)}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            !currentWorkspace
              ? 'bg-teal-500/10 border-teal-500/40 shadow-lg shadow-teal-500/5'
              : 'bg-[#0c1222] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-100">Personal Space</div>
              <div className="text-[10px] text-slate-400">Single-tenant private isolation</div>
            </div>
          </div>
        </div>

        {/* Team Workspaces */}
        {workspaces.map((ws) => (
          <div
            key={ws.id}
            onClick={() => onSelectWorkspace(ws)}
            className={`p-4 rounded-2xl border cursor-pointer transition-all ${
              currentWorkspace?.id === ws.id
                ? 'bg-teal-500/10 border-teal-500/40 shadow-lg shadow-teal-500/5'
                : 'bg-[#0c1222] border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-100">{ws.name}</div>
                  <div className="text-[10px] text-slate-400">{ws.id}</div>
                </div>
              </div>
              <span className="text-[10px] text-teal-400 font-mono font-semibold">Active</span>
            </div>
          </div>
        ))}
      </div>

      {/* Workspace Management Panel */}
      {currentWorkspace ? (
        <div className="bg-[#0c1222] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          {/* Sub Navigation Bar */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setActiveTab('MEMBERS')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'MEMBERS'
                    ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Team Members ({members.length})
              </button>
              <button
                onClick={() => setActiveTab('SHARES')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'SHARES'
                    ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Shared Profiles ({sharedProfiles.length})
              </button>
            </div>

            {canManageMembers && activeTab === 'MEMBERS' && (
              <button
                type="button"
                onClick={() => setIsInviteOpen(true)}
                className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-teal-600/20 flex items-center space-x-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Invite Member</span>
              </button>
            )}
          </div>

          {/* Members Tab */}
          {activeTab === 'MEMBERS' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Member / User ID</th>
                    <th className="py-3 px-4">Current Role</th>
                    <th className="py-3 px-4">Joined At</th>
                    {canManageMembers && <th className="py-3 px-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {members.map((m) => (
                    <tr key={m.userId} className="hover:bg-slate-900/40">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center font-bold">
                            {m.userId.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-200">{m.userId}</div>
                            <div className="text-[10px] text-slate-500 font-mono">Workspace Member</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {canManageMembers && m.role !== 'OWNER' ? (
                          <select
                            value={m.role}
                            onChange={(e) => onUpdateRole(m.userId, e.target.value as TeamRole)}
                            className="px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                          >
                            <option value="VIEWER">VIEWER</option>
                            <option value="MEMBER">MEMBER</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>
                        ) : (
                          getRoleBadge(m.role)
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : 'Active'}
                      </td>

                      {canManageMembers && (
                        <td className="py-3 px-4 text-right">
                          {m.role !== 'OWNER' && (
                            <button
                              type="button"
                              onClick={() => setRemovingMember(m)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg"
                              title="Remove from Workspace"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Shared Profiles Tab */}
          {activeTab === 'SHARES' && (
            <div className="p-6">
              {sharedProfiles.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <Share2 className="w-8 h-8 text-slate-600 mx-auto" />
                  <div className="text-xs text-slate-400">No profiles currently shared with this workspace.</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {sharedProfiles.map((s) => (
                    <div key={s.id || s.cloudProfileId} className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                        <span>Profile: {s.profileName || s.cloudProfileId}</span>
                        <span className="text-[10px] text-teal-400 font-mono">{s.permissionLevel}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">Shared by {s.sharedBy}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="p-8 bg-[#0c1222] border border-slate-800 rounded-2xl text-center space-y-3">
          <Layers className="w-10 h-10 text-teal-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-200">Personal Workspace Selected</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            You are operating in your single-tenant personal workspace. Switch to a team workspace above or create a new workspace to invite team members and enforce RBAC policies.
          </p>
        </div>
      )}

      {/* Modals */}
      <CreateWorkspaceModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={onCreateWorkspace}
      />

      {currentWorkspace && (
        <InviteMemberModal
          isOpen={isInviteOpen}
          workspaceName={currentWorkspace.name}
          onClose={() => setIsInviteOpen(false)}
          onSubmit={onInviteMember}
        />
      )}

      {removingMember && (
        <ConfirmModal
          isOpen={true}
          title={`Remove Member "${removingMember.userId}"?`}
          message="This user will lose all RBAC access to this team workspace and its shared browser profiles immediately."
          confirmLabel="Remove Member"
          confirmVariant="danger"
          isPending={isRemovingPending}
          onConfirm={handleConfirmRemoveMember}
          onCancel={() => setRemovingMember(null)}
        />
      )}
    </div>
  );
};
