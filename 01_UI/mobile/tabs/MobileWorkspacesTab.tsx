import type React from 'react';
import { useState } from 'react';

export interface MobileWorkspaceMember {
  id: string;
  email: string;
  name: string;
  role: 'OWNER' | 'ADMIN' | 'OPERATOR' | 'VIEWER';
  joinedAt: string;
}

export interface MobileWorkspaceItem {
  id: string;
  name: string;
  currentUserRole: 'OWNER' | 'ADMIN' | 'OPERATOR' | 'VIEWER';
  memberCount: number;
  sharedProfileCount: number;
  members: MobileWorkspaceMember[];
}

interface MobileWorkspacesTabProps {
  workspaces: MobileWorkspaceItem[];
  activeWorkspaceId: string;
  onSelectWorkspace: (workspaceId: string) => void;
  onInviteMember: (workspaceId: string, email: string, role: string) => void;
  onRemoveMember: (workspaceId: string, memberId: string) => void;
  isOffline: boolean;
}

export const MobileWorkspacesTab: React.FC<MobileWorkspacesTabProps> = ({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onInviteMember,
  onRemoveMember,
  isOffline,
}) => {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'OPERATOR' | 'VIEWER'>('OPERATOR');

  const currentWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  const canManageMembers =
    currentWorkspace?.currentUserRole === 'OWNER' ||
    currentWorkspace?.currentUserRole === 'ADMIN';

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'OWNER':
        return '#818CF8';
      case 'ADMIN':
        return '#38BDF8';
      case 'OPERATOR':
        return '#34D399';
      default:
        return '#94A3B8';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Workspace Switcher Card */}
      <div
        style={{
          background: '#1E293B',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 14,
          padding: 16,
        }}
      >
        <label htmlFor="mobile-ws-select" style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Active Workspace
        </label>
        <select
          id="mobile-ws-select"
          value={activeWorkspaceId}
          onChange={(e) => onSelectWorkspace(e.target.value)}
          style={{
            width: '100%',
            marginTop: 6,
            padding: '10px 12px',
            background: '#0F172A',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 8,
            color: '#F8FAFC',
            fontSize: 14,
            fontWeight: 600,
            outline: 'none',
          }}
        >
          {workspaces.map((ws) => (
            <option key={ws.id} value={ws.id}>
              {ws.name} ({ws.currentUserRole})
            </option>
          ))}
        </select>

        {currentWorkspace && (
          <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: 12, color: '#94A3B8' }}>
            <span>👥 {currentWorkspace.memberCount} Members</span>
            <span>📂 {currentWorkspace.sharedProfileCount} Shared Profiles</span>
            <span>
              🛡️ Role:{' '}
              <strong style={{ color: getRoleBadgeColor(currentWorkspace.currentUserRole) }}>
                {currentWorkspace.currentUserRole}
              </strong>
            </span>
          </div>
        )}
      </div>

      {/* Members Section */}
      <div
        style={{
          background: '#1E293B',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 14,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#F8FAFC' }}>
            Team Members
          </h3>
          {canManageMembers && (
            <button
              type="button"
              onClick={() => setShowInviteModal(true)}
              disabled={isOffline}
              style={{
                padding: '6px 12px',
                background: '#6366F1',
                color: '#FFF',
                border: 'none',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: isOffline ? 'not-allowed' : 'pointer',
              }}
            >
              + Invite
            </button>
          )}
        </div>

        {/* Member List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {currentWorkspace?.members.map((member) => (
            <div
              key={member.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
                borderRadius: 10,
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.04)',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#F8FAFC' }}>
                  {member.name}
                </div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                  {member.email}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: `${getRoleBadgeColor(member.role)}20`,
                    color: getRoleBadgeColor(member.role),
                    border: `1px solid ${getRoleBadgeColor(member.role)}40`,
                  }}
                >
                  {member.role}
                </span>

                {canManageMembers && member.role !== 'OWNER' && (
                  <button
                    type="button"
                    onClick={() => onRemoveMember(currentWorkspace.id, member.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#EF4444',
                      fontSize: 11,
                      cursor: 'pointer',
                      padding: 4,
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99,
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#1E293B',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 14,
              padding: 20,
              width: '100%',
              maxWidth: 360,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16, color: '#F8FAFC' }}>Invite Team Member</h3>
            <div>
              <label htmlFor="mobile-ws-invite-email" style={{ fontSize: 12, color: '#94A3B8', display: 'block', marginBottom: 4 }}>
                Member Email
              </label>
              <input
                id="mobile-ws-invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@agency.com"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: '#0F172A',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 8,
                  color: '#FFF',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label htmlFor="mobile-ws-invite-role" style={{ fontSize: 12, color: '#94A3B8', display: 'block', marginBottom: 4 }}>
                Assigned Role (RBAC)
              </label>
              <select
                id="mobile-ws-invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'ADMIN' | 'OPERATOR' | 'VIEWER')}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: '#0F172A',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 8,
                  color: '#FFF',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
              >
                <option value="ADMIN">ADMIN (Manage profiles & members)</option>
                <option value="OPERATOR">OPERATOR (Run & edit profiles)</option>
                <option value="VIEWER">VIEWER (Read-only observation)</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                style={{
                  padding: '8px 14px',
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#94A3B8',
                  borderRadius: 8,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (inviteEmail.trim()) {
                    onInviteMember(currentWorkspace.id, inviteEmail.trim(), inviteRole);
                    setInviteEmail('');
                    setShowInviteModal(false);
                  }
                }}
                disabled={!inviteEmail.trim()}
                style={{
                  padding: '8px 16px',
                  background: '#6366F1',
                  border: 'none',
                  color: '#FFF',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: !inviteEmail.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                Send Invite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
