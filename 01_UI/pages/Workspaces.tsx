import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Shield,
  UserCheck,
  UserPlus,
  Mail,
  Layers,
  Download,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Key,
  Copy,
  Check,
  Lock,
  Unlock,
  Play,
  RefreshCw,
  FileText,
  UserMinus,
  Share2,
} from 'lucide-react';
import {
  Workspace,
  TeamMember,
  MemberRole,
  TeamWorkspace,
  TeamWorkspaceMember,
  TeamRole,
  TeamWorkspaceInvitation,
  TeamProfileShare,
  TeamWorkspaceAuditLog,
  ROLE_PERMISSIONS,
} from '../../10_CONFIG/shared/types/workspace.js';
import { useProfileStore } from '../stores/useProfileStore.js';
import { useToastStore } from '../stores/useToastStore.js';

export const WorkspacesPage: React.FC = () => {
  const { profiles, fetchProfiles, startProfile, stopProfile } = useProfileStore();
  const { showToast } = useToastStore();

  // Local & Team Workspaces State
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [teamWorkspaces, setTeamWorkspaces] = useState<TeamWorkspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('');
  const [isTeamMode, setIsTeamMode] = useState<boolean>(true);

  // Active Team Data
  const [teamMembers, setTeamMembers] = useState<TeamWorkspaceMember[]>([]);
  const [teamInvites, setTeamInvites] = useState<TeamWorkspaceInvitation[]>([]);
  const [sharedProfiles, setSharedProfiles] = useState<TeamProfileShare[]>([]);
  const [auditLogs, setAuditLogs] = useState<TeamWorkspaceAuditLog[]>([]);

  // Local Workspace Members
  const [localMembers, setLocalMembers] = useState<TeamMember[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'members' | 'shares' | 'invites' | 'audit' | 'assignments'>('members');

  // Modals
  const [showCreateWsModal, setShowCreateWsModal] = useState<boolean>(false);
  const [newWsName, setNewWsName] = useState<string>('');
  const [newWsDesc, setNewWsDesc] = useState<string>('');

  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [inviteEmail, setInviteEmail] = useState<string>('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('MEMBER');
  const [latestInviteToken, setLatestInviteToken] = useState<string>('');
  const [copiedToken, setCopiedToken] = useState<boolean>(false);

  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [sharePermissionLevel, setSharePermissionLevel] = useState<'VIEW' | 'RUN' | 'EDIT' | 'ADMIN'>('RUN');

  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importJsonText, setImportJsonText] = useState<string>('');

  useEffect(() => {
    loadAllData();
    fetchProfiles();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // 1. Load Local Workspaces
      if (window.mahiAPI?.workspaceGetAll) {
        const localList = await window.mahiAPI.workspaceGetAll();
        setWorkspaces(localList);
      }

      // 2. Load Team Workspaces
      if (window.mahiAPI?.teamWorkspaceList) {
        const teamList = await window.mahiAPI.teamWorkspaceList();
        setTeamWorkspaces(teamList);

        if (teamList && teamList.length > 0) {
          setIsTeamMode(true);
          const currentId = activeWorkspaceId || teamList[0].id;
          setActiveWorkspaceId(currentId);
          await loadTeamWorkspaceDetails(currentId);
        } else if (window.mahiAPI?.workspaceGetActive) {
          setIsTeamMode(false);
          const activeLocal = await window.mahiAPI.workspaceGetActive();
          setActiveWorkspaceId(activeLocal);
          if (activeLocal && window.mahiAPI?.workspaceGetMembers) {
            const mList = await window.mahiAPI.workspaceGetMembers(activeLocal);
            setLocalMembers(mList);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTeamWorkspaceDetails = async (wsId: string) => {
    if (!wsId || !window.mahiAPI) return;
    try {
      if (window.mahiAPI.teamWorkspaceGetMembers) {
        const m = await window.mahiAPI.teamWorkspaceGetMembers(wsId);
        setTeamMembers(m);
      }
      if (window.mahiAPI.teamWorkspaceListProfiles) {
        const p = await window.mahiAPI.teamWorkspaceListProfiles(wsId);
        setSharedProfiles(p);
      }
      if (window.mahiAPI.teamWorkspaceListInvitations) {
        const inv = await window.mahiAPI.teamWorkspaceListInvitations(wsId);
        setTeamInvites(inv);
      }
      if (window.mahiAPI.teamWorkspaceGetAuditLogs) {
        const logs = await window.mahiAPI.teamWorkspaceGetAuditLogs(wsId, 25);
        setAuditLogs(logs);
      }
    } catch (err) {
      console.error('Error fetching team workspace details:', err);
    }
  };

  const handleSwitchWorkspace = async (id: string, isTeam: boolean) => {
    setActiveWorkspaceId(id);
    setIsTeamMode(isTeam);
    if (isTeam) {
      await loadTeamWorkspaceDetails(id);
    } else if (window.mahiAPI?.workspaceSetActive) {
      await window.mahiAPI.workspaceSetActive(id);
      if (window.mahiAPI.workspaceGetMembers) {
        const mList = await window.mahiAPI.workspaceGetMembers(id);
        setLocalMembers(mList);
      }
    }
  };

  const currentTeamWorkspace = teamWorkspaces.find((w) => w.id === activeWorkspaceId);
  const currentLocalWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  const currentUserRole: TeamRole = currentTeamWorkspace?.userRole || 'OWNER';
  const userPermissions = ROLE_PERMISSIONS[currentUserRole] || [];

  const canEditWorkspace = userPermissions.includes('WORKSPACE_EDIT');
  const canInvite = userPermissions.includes('MEMBER_INVITE');
  const canRemoveMember = userPermissions.includes('MEMBER_REMOVE');
  const canChangeRole = userPermissions.includes('MEMBER_ROLE_CHANGE');
  const canShareProfile = userPermissions.includes('PROFILE_SHARE');
  const canRunProfile = userPermissions.includes('PROFILE_RUN');

  const handleCreateWorkspace = async () => {
    if (!newWsName.trim()) return;
    try {
      if (isTeamMode && window.mahiAPI?.teamWorkspaceCreate) {
        const created = await window.mahiAPI.teamWorkspaceCreate({
          name: newWsName.trim(),
          description: newWsDesc.trim(),
        });
        setTeamWorkspaces([created, ...teamWorkspaces]);
        setActiveWorkspaceId(created.id);
        await loadTeamWorkspaceDetails(created.id);
        showToast({
          type: 'success',
          title: 'Team Workspace Created',
          message: `Workspace "${created.name}" is now ready`,
        });
      } else if (window.mahiAPI?.workspaceCreate) {
        const created = await window.mahiAPI.workspaceCreate({
          name: newWsName.trim(),
          description: newWsDesc.trim(),
        });
        setWorkspaces([...workspaces, created]);
        setActiveWorkspaceId(created.id);
        showToast({
          type: 'success',
          title: 'Local Workspace Created',
          message: `"${created.name}" created successfully`,
        });
      }
      setShowCreateWsModal(false);
      setNewWsName('');
      setNewWsDesc('');
    } catch (err: any) {
      showToast({ type: 'error', title: 'Create Failed', message: err.message });
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) return;
    try {
      if (isTeamMode && window.mahiAPI?.teamWorkspaceInviteMember) {
        const res = await window.mahiAPI.teamWorkspaceInviteMember(
          activeWorkspaceId,
          inviteEmail.trim(),
          inviteRole
        );
        if (res && res.token) {
          setLatestInviteToken(res.token);
        }
        await loadTeamWorkspaceDetails(activeWorkspaceId);
        showToast({
          type: 'success',
          title: 'Invitation Sent',
          message: `Invited ${inviteEmail} as ${inviteRole}`,
        });
      }
      setInviteEmail('');
    } catch (err: any) {
      showToast({ type: 'error', title: 'Invite Failed', message: err.message });
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      if (window.mahiAPI?.teamWorkspaceRevokeInvitation) {
        await window.mahiAPI.teamWorkspaceRevokeInvitation(activeWorkspaceId, inviteId);
        await loadTeamWorkspaceDetails(activeWorkspaceId);
        showToast({ type: 'info', title: 'Invitation Revoked', message: 'Invite link invalidated' });
      }
    } catch (err: any) {
      showToast({ type: 'error', title: 'Revoke Failed', message: err.message });
    }
  };

  const handleRoleChange = async (targetUserId: string, newRole: TeamRole) => {
    try {
      if (window.mahiAPI?.teamWorkspaceUpdateMemberRole) {
        await window.mahiAPI.teamWorkspaceUpdateMemberRole(activeWorkspaceId, targetUserId, newRole);
        await loadTeamWorkspaceDetails(activeWorkspaceId);
        showToast({ type: 'success', title: 'Role Updated', message: `Role changed to ${newRole}` });
      }
    } catch (err: any) {
      showToast({ type: 'error', title: 'Role Change Failed', message: err.message });
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    if (!confirm('Are you sure you want to remove this member from the workspace?')) return;
    try {
      if (window.mahiAPI?.teamWorkspaceRemoveMember) {
        await window.mahiAPI.teamWorkspaceRemoveMember(activeWorkspaceId, targetUserId);
        await loadTeamWorkspaceDetails(activeWorkspaceId);
        showToast({ type: 'info', title: 'Member Removed', message: 'User access revoked' });
      }
    } catch (err: any) {
      showToast({ type: 'error', title: 'Remove Failed', message: err.message });
    }
  };

  const handleShareProfile = async () => {
    if (!selectedProfileId) return;
    try {
      if (window.mahiAPI?.teamWorkspaceShareProfile) {
        await window.mahiAPI.teamWorkspaceShareProfile(activeWorkspaceId, {
          cloudProfileId: selectedProfileId,
          permissionLevel: sharePermissionLevel,
          encryptedKeyEnvelope: 'workspace_envelope_' + selectedProfileId,
        });
        await loadTeamWorkspaceDetails(activeWorkspaceId);
        setShowShareModal(false);
        setSelectedProfileId('');
        showToast({
          type: 'success',
          title: 'Profile Shared',
          message: 'Profile now accessible to authorized teammates',
        });
      }
    } catch (err: any) {
      showToast({ type: 'error', title: 'Share Failed', message: err.message });
    }
  };

  const handleRevokeShare = async (cloudProfileId: string) => {
    try {
      if (window.mahiAPI?.teamWorkspaceRevokeProfileShare) {
        await window.mahiAPI.teamWorkspaceRevokeProfileShare(activeWorkspaceId, cloudProfileId);
        await loadTeamWorkspaceDetails(activeWorkspaceId);
        showToast({ type: 'info', title: 'Share Revoked', message: 'Profile removed from workspace' });
      }
    } catch (err: any) {
      showToast({ type: 'error', title: 'Revoke Failed', message: err.message });
    }
  };

  const handleLaunchSharedProfile = async (share: TeamProfileShare) => {
    if (!canRunProfile) {
      showToast({ type: 'error', title: 'Permission Denied', message: 'Your role does not permit running profiles.' });
      return;
    }

    if (share.lockStatus?.isLocked) {
      showToast({
        type: 'warning',
        title: 'Profile In Use',
        message: `Currently active on device: ${share.lockStatus.lockedByDevice || 'Teammate Device'}. Simultaneous launch blocked to prevent corruption.`,
      });
      return;
    }

    try {
      const matchLocal = profiles.find((p) => p.id === share.cloudProfileId);
      if (matchLocal) {
        await startProfile(matchLocal.id);
        showToast({
          type: 'success',
          title: 'Profile Launched',
          message: `Session inherited securely for "${share.profileName}"`,
        });
        await loadTeamWorkspaceDetails(activeWorkspaceId);
      } else {
        showToast({
          type: 'info',
          title: 'Syncing & Launching',
          message: `Restoring shared profile archive from Zero-Knowledge Cloud...`,
        });
      }
    } catch (err: any) {
      showToast({ type: 'error', title: 'Launch Failed', message: err.message });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
    showToast({ type: 'info', title: 'Token Copied', message: 'High-entropy invite token copied to clipboard' });
  };

  const getRoleBadge = (role: TeamRole) => {
    switch (role) {
      case 'OWNER':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'ADMIN':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'MANAGER':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'MEMBER':
        return 'bg-teal-500/10 text-teal-400 border-teal-500/20';
      case 'VIEWER':
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 overflow-y-auto h-full custom-scrollbar">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-teal-500/20 to-emerald-400/20 border border-teal-500/30 text-teal-600 dark:text-teal-400 shadow-sm">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Team Workspaces & Roles
              </h1>
              <span className="px-2 py-0.5 text-xs font-bold bg-teal-950/80 border border-teal-700/50 text-teal-400 rounded-md">
                RBAC MULTI-USER
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Zero-knowledge profile sharing, distributed lock coordination, and server-enforced role permissions.
            </p>
          </div>
        </div>

        {/* Workspace Switcher & Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
            <select
              value={activeWorkspaceId}
              onChange={(e) => {
                const isTeam = teamWorkspaces.some((tw) => tw.id === e.target.value);
                handleSwitchWorkspace(e.target.value, isTeam);
              }}
              className="bg-transparent px-4 py-2.5 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
            >
              <optgroup label="Cloud Team Workspaces">
                {teamWorkspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.userRole || 'MEMBER'})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Local Workspaces">
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.isDefault ? '(Default)' : ''}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <button
            onClick={() => setShowCreateWsModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4 text-teal-500" /> New Workspace
          </button>

          <button
            onClick={() => loadAllData()}
            className="p-2.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-400 hover:text-slate-100 transition-all shadow-sm"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Workspace</span>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
              {isTeamMode ? currentTeamWorkspace?.name || 'Team Workspace' : currentLocalWorkspace?.name || 'Local'}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRoleBadge(currentUserRole)}`}>
                {currentUserRole}
              </span>
              <span className="text-xs text-slate-400">{isTeamMode ? 'Cloud Multi-User' : 'Local Machine'}</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-teal-500/10 text-teal-500">
            <Briefcase className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Members</span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {isTeamMode ? teamMembers.length : localMembers.length}
            </div>
            <span className="text-xs text-slate-400 font-medium mt-0.5 block">
              {isTeamMode
                ? `${teamMembers.filter((m) => m.role === 'ADMIN' || m.role === 'OWNER').length} Admins/Owners`
                : 'Local profiles'}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-500">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Shared Profiles</span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {isTeamMode ? sharedProfiles.length : profiles.length}
            </div>
            <span className="text-xs text-emerald-500 font-medium mt-0.5 block">
              {isTeamMode
                ? `${sharedProfiles.filter((s) => s.lockStatus?.isLocked).length} Locked / In Use`
                : `${profiles.filter((p) => p.status === 'RUNNING').length} Running`}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Invites</span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {isTeamMode ? teamInvites.length : 0}
            </div>
            <span className="text-xs text-slate-400 font-medium mt-0.5 block">
              {isTeamMode ? 'Single-use cryptographic tokens' : 'Local only'}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500">
            <Mail className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('members')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'members'
                ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Members ({isTeamMode ? teamMembers.length : localMembers.length})
          </button>

          {isTeamMode && (
            <>
              <button
                onClick={() => setActiveTab('shares')}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  activeTab === 'shares'
                    ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Shared Profiles ({sharedProfiles.length})
              </button>

              <button
                onClick={() => setActiveTab('invites')}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  activeTab === 'invites'
                    ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Invitations ({teamInvites.length})
              </button>

              <button
                onClick={() => setActiveTab('audit')}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  activeTab === 'audit'
                    ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Audit Trail ({auditLogs.length})
              </button>
            </>
          )}

          {!isTeamMode && (
            <button
              onClick={() => setActiveTab('assignments')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'assignments'
                  ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Assignments ({profiles.length})
            </button>
          )}
        </div>

        {/* Tab Actions */}
        <div className="flex items-center gap-2">
          {activeTab === 'members' && canInvite && isTeamMode && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-xs font-black text-slate-950 shadow-md shadow-teal-500/20 transition-all"
            >
              <UserPlus className="w-3.5 h-3.5" /> Invite Teammate
            </button>
          )}

          {activeTab === 'shares' && canShareProfile && (
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-xs font-black text-slate-950 shadow-md shadow-teal-500/20 transition-all"
            >
              <Share2 className="w-3.5 h-3.5" /> Share Cloud Profile
            </button>
          )}
        </div>
      </div>

      {/* Tab: Members Table */}
      {activeTab === 'members' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 uppercase text-[11px] font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4">Teammate</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Role & Permissions</th>
                <th className="px-6 py-4">Joined Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {isTeamMode ? (
                teamMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-600 dark:text-teal-400 font-bold flex items-center justify-center text-xs">
                          {(m.name || m.email).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            {m.name || m.email}
                            {m.role === 'OWNER' && <Shield className="w-3.5 h-3.5 text-amber-500" />}
                          </div>
                          <div className="text-[11px] text-slate-400">Status: {m.status}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-mono text-xs">{m.email}</td>
                    <td className="px-6 py-4">
                      {canChangeRole && m.role !== 'OWNER' ? (
                        <select
                          value={m.role}
                          onChange={(e) => handleRoleChange(m.userId, e.target.value as TeamRole)}
                          className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
                        >
                          <option value="ADMIN">ADMIN (Full admin)</option>
                          <option value="MANAGER">MANAGER (Share & run)</option>
                          <option value="MEMBER">MEMBER (Launch only)</option>
                          <option value="VIEWER">VIEWER (Read only)</option>
                        </select>
                      ) : (
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${getRoleBadge(m.role)}`}>
                          {m.role}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {new Date(m.joinedAt || m.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {canRemoveMember && m.role !== 'OWNER' && (
                        <button
                          onClick={() => handleRemoveMember(m.userId)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 transition-colors"
                          title="Remove Teammate"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                localMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{member.name}</td>
                    <td className="px-6 py-4 text-slate-400 text-xs font-mono">{member.email}</td>
                    <td className="px-6 py-4 font-bold text-xs text-teal-400">{member.role}</td>
                    <td className="px-6 py-4 text-xs text-slate-400">{new Date(member.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-xs text-slate-500">Local Only</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Shared Profiles */}
      {activeTab === 'shares' && isTeamMode && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 uppercase text-[11px] font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4">Profile</th>
                <th className="px-6 py-4">Shared By</th>
                <th className="px-6 py-4">Permission Level</th>
                <th className="px-6 py-4">Concurrency / Lock Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {sharedProfiles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-400">
                    No profiles currently shared in this workspace. Click "Share Cloud Profile" to collaborate.
                  </td>
                </tr>
              ) : (
                sharedProfiles.map((share) => (
                  <tr key={share.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-teal-500/10 text-teal-500">
                          <Layers className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">
                            {share.profileName || share.cloudProfileId}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">ID: {share.cloudProfileId.slice(0, 8)}...</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">{share.sharedByName || 'Teammate'}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20">
                        {share.permissionLevel}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {share.lockStatus?.isLocked ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Lock className="w-3 h-3" />
                          In Use by {share.lockStatus.lockedByDevice || 'Teammate'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <Unlock className="w-3 h-3" />
                          Ready to Launch
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleLaunchSharedProfile(share)}
                        disabled={share.lockStatus?.isLocked}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          share.lockStatus?.isLocked
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                        }`}
                        title={share.lockStatus?.isLocked ? 'Profile currently in use' : 'Launch profile'}
                      >
                        <Play className="w-3 h-3" /> Run
                      </button>

                      {canShareProfile && (
                        <button
                          onClick={() => handleRevokeShare(share.cloudProfileId)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 transition-colors"
                          title="Revoke Profile Access"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Invitations Table */}
      {activeTab === 'invites' && isTeamMode && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 uppercase text-[11px] font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4">Invited Email</th>
                <th className="px-6 py-4">Assigned Role</th>
                <th className="px-6 py-4">Invited By</th>
                <th className="px-6 py-4">Expires At</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {teamInvites.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-400">
                    No pending invitations. Click "Invite Teammate" to invite new members.
                  </td>
                </tr>
              ) : (
                teamInvites.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-slate-200">{inv.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getRoleBadge(inv.role)}`}>
                        {inv.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">{inv.invitedByName || 'Admin'}</td>
                    <td className="px-6 py-4 text-xs text-slate-400">{new Date(inv.expiresAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right">
                      {canInvite && (
                        <button
                          onClick={() => handleRevokeInvite(inv.id)}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Audit Trail */}
      {activeTab === 'audit' && isTeamMode && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 uppercase text-[11px] font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Actor</th>
                <th className="px-6 py-4">Details</th>
                <th className="px-6 py-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-400">
                    No audit records logged yet.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-xs text-teal-400">{log.action}</td>
                    <td className="px-6 py-4 text-xs text-slate-300 font-mono">{log.userEmail || log.userId}</td>
                    <td className="px-6 py-4 text-xs text-slate-400">{log.details || '—'}</td>
                    <td className="px-6 py-4 text-right text-xs text-slate-500 font-mono">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Create Workspace */}
      {showCreateWsModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Create Multi-User Team Workspace</h3>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Workspace Name</label>
              <input
                type="text"
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
                placeholder="e.g. Agency Team North"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description (Optional)</label>
              <input
                type="text"
                value={newWsDesc}
                onChange={(e) => setNewWsDesc(e.target.value)}
                placeholder="e.g. Media buying & multi-accounting team"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm"
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                onClick={() => setShowCreateWsModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWorkspace}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 text-slate-950 font-black text-xs shadow-md shadow-teal-500/20"
              >
                Create Workspace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Invite Teammate */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Invite Teammate via Central Auth</h3>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Account Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@agency.com"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assign Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as TeamRole)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-200"
              >
                <option value="ADMIN">ADMIN (Member invite/remove, profile share/edit/run)</option>
                <option value="MANAGER">MANAGER (Invite members, share/run profiles)</option>
                <option value="MEMBER">MEMBER (Launch assigned & shared profiles)</option>
                <option value="VIEWER">VIEWER (Read-only metadata)</option>
              </select>
            </div>

            {latestInviteToken && (
              <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-xl space-y-1">
                <span className="text-[11px] font-bold text-teal-400">Single-Use Invite Token Generated:</span>
                <div className="flex items-center justify-between gap-2 font-mono text-xs text-slate-200 bg-slate-950/60 p-2 rounded-lg">
                  <span className="truncate">{latestInviteToken}</span>
                  <button
                    onClick={() => copyToClipboard(latestInviteToken)}
                    className="p-1 hover:text-teal-400"
                    title="Copy token"
                  >
                    {copiedToken ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setLatestInviteToken('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
              >
                Close
              </button>
              <button
                onClick={handleInviteMember}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 text-slate-950 font-black text-xs shadow-md shadow-teal-500/20"
              >
                Send Invitation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Share Cloud Profile */}
      {showShareModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Share Profile to Workspace</h3>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Profile</label>
              <select
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-200"
              >
                <option value="">-- Choose Profile --</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.folder || 'General'})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Permission Level</label>
              <select
                value={sharePermissionLevel}
                onChange={(e) => setSharePermissionLevel(e.target.value as any)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-200"
              >
                <option value="RUN">RUN (Teammates can launch & sync sessions)</option>
                <option value="VIEW">VIEW (Read-only visibility)</option>
                <option value="EDIT">EDIT (Can edit settings & launch)</option>
                <option value="ADMIN">ADMIN (Full management)</option>
              </select>
            </div>
            <p className="text-xs text-slate-400">
              Zero-Knowledge protection: Teammates inherit sessions and cookies. Passwords and master secrets are never transmitted.
            </p>
            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleShareProfile}
                disabled={!selectedProfileId}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 text-slate-950 font-black text-xs shadow-md shadow-teal-500/20 disabled:opacity-50"
              >
                Confirm Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
