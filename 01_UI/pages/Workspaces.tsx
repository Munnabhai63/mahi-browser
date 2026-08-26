import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Shield,
  UserCheck,
  UserPlus,
  Mail,
  FolderLock,
  Layers,
  Download,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Briefcase,
  Key,
  Edit2,
  Sparkles,
} from 'lucide-react';
import {
  Workspace,
  TeamMember,
  MemberRole,
  CreateWorkspaceDTO,
  CreateMemberDTO,
} from '../../10_CONFIG/shared/types/workspace.js';
import { useProfileStore } from '../stores/useProfileStore.js';
import { useToastStore } from '../stores/useToastStore.js';

export const WorkspacesPage: React.FC = () => {
  const { profiles, fetchProfiles } = useProfileStore();
  const { showToast } = useToastStore();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'members' | 'profiles'>('members');

  // Modals
  const [showCreateWsModal, setShowCreateWsModal] = useState<boolean>(false);
  const [newWsName, setNewWsName] = useState<string>('');
  const [newWsDesc, setNewWsDesc] = useState<string>('');
  const [newWsColor, setNewWsColor] = useState<string>('#14b8a6');

  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [inviteName, setInviteName] = useState<string>('');
  const [inviteEmail, setInviteEmail] = useState<string>('');
  const [inviteRole, setInviteRole] = useState<MemberRole>('EDITOR');

  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importJsonText, setImportJsonText] = useState<string>('');

  useEffect(() => {
    loadData();
    fetchProfiles();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      if (window.mahiAPI?.workspaceGetAll) {
        const wsList = await window.mahiAPI.workspaceGetAll();
        setWorkspaces(wsList);
        const activeId = await window.mahiAPI.workspaceGetActive();
        setActiveWorkspaceId(activeId || (wsList[0] ? wsList[0].id : ''));
        if (activeId || wsList[0]) {
          const mList = await window.mahiAPI.workspaceGetMembers(activeId || wsList[0].id);
          setMembers(mList);
        }
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchWorkspace = async (id: string) => {
    try {
      if (window.mahiAPI?.workspaceSetActive) {
        await window.mahiAPI.workspaceSetActive(id);
        setActiveWorkspaceId(id);
        const mList = await window.mahiAPI.workspaceGetMembers(id);
        setMembers(mList);
        showToast({
          type: 'info',
          title: 'Workspace Switched',
          message: `Active workspace changed to ${workspaces.find((w) => w.id === id)?.name}`,
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateWorkspace = async () => {
    if (!newWsName.trim()) return;
    try {
      if (window.mahiAPI?.workspaceCreate) {
        const created = await window.mahiAPI.workspaceCreate({
          name: newWsName,
          description: newWsDesc,
          color: newWsColor,
        });
        setWorkspaces([...workspaces, created]);
        setShowCreateWsModal(false);
        setNewWsName('');
        setNewWsDesc('');
        handleSwitchWorkspace(created.id);
        showToast({
          type: 'success',
          title: 'Workspace Created',
          message: `"${created.name}" is now ready`,
        });
      }
    } catch (err: any) {
      showToast({ type: 'error', title: 'Create Failed', message: err.message });
    }
  };

  const handleInviteMember = async () => {
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    try {
      if (window.mahiAPI?.workspaceAddMember) {
        const newMember = await window.mahiAPI.workspaceAddMember({
          workspaceId: activeWorkspaceId,
          name: inviteName,
          email: inviteEmail,
          role: inviteRole,
        });
        setMembers([...members, newMember]);
        setShowInviteModal(false);
        setInviteName('');
        setInviteEmail('');
        showToast({
          type: 'success',
          title: 'Member Added',
          message: `${newMember.name} joined as ${newMember.role}`,
        });
      }
    } catch (err: any) {
      showToast({ type: 'error', title: 'Invite Failed', message: err.message });
    }
  };

  const handleRoleChange = async (memberId: string, role: MemberRole) => {
    try {
      if (window.mahiAPI?.workspaceUpdateMemberRole) {
        await window.mahiAPI.workspaceUpdateMemberRole(memberId, role);
        setMembers(members.map((m) => (m.id === memberId ? { ...m, role } : m)));
        showToast({ type: 'success', title: 'Role Updated', message: `Member role set to ${role}` });
      }
    } catch (err: any) {
      showToast({ type: 'error', title: 'Update Failed', message: err.message });
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    try {
      if (window.mahiAPI?.workspaceDeleteMember) {
        await window.mahiAPI.workspaceDeleteMember(memberId);
        setMembers(members.filter((m) => m.id !== memberId));
        showToast({ type: 'info', title: 'Member Removed', message: 'Member removed from workspace' });
      }
    } catch (err: any) {
      showToast({ type: 'error', title: 'Delete Failed', message: err.message });
    }
  };

  const handleExportBundle = async () => {
    try {
      if (window.mahiAPI?.workspaceExportBundle) {
        const bundleJson = await window.mahiAPI.workspaceExportBundle({
          workspaceId: activeWorkspaceId,
          includeCookies: true,
          includeExtensions: true,
        });
        const blob = new Blob([bundleJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `workspace-${activeWorkspaceId.slice(0, 8)}-bundle.mahi-workspace`;
        a.click();
        URL.revokeObjectURL(url);
        showToast({
          type: 'success',
          title: 'Bundle Exported',
          message: 'Encrypted workspace bundle downloaded',
        });
      }
    } catch (err: any) {
      showToast({ type: 'error', title: 'Export Failed', message: err.message });
    }
  };

  const handleImportBundle = async () => {
    if (!importJsonText.trim()) return;
    try {
      if (window.mahiAPI?.workspaceImportBundle) {
        const res = await window.mahiAPI.workspaceImportBundle(importJsonText, activeWorkspaceId);
        setShowImportModal(false);
        setImportJsonText('');
        await loadData();
        await fetchProfiles();
        showToast({
          type: 'success',
          title: 'Bundle Imported',
          message: `Restored ${res.importedProfilesCount} profiles into workspace`,
        });
      }
    } catch (err: any) {
      showToast({ type: 'error', title: 'Import Failed', message: err.message });
    }
  };

  const currentWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

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
                ENTERPRISE MULTI-USER
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Collaborative agency workspaces, member role permissions, and encrypted profile bundles.
            </p>
          </div>
        </div>

        {/* Workspace Switcher & Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={activeWorkspaceId}
            onChange={(e) => handleSwitchWorkspace(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50 shadow-sm"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} {w.isDefault ? '(Default)' : ''}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowCreateWsModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4 text-teal-500" /> New Workspace
          </button>

          <button
            onClick={handleExportBundle}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 transition-all shadow-sm"
          >
            <Download className="w-4 h-4 text-teal-500" /> Export Bundle
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-sm font-black text-slate-950 shadow-md shadow-teal-500/20 transition-all"
          >
            <Upload className="w-4 h-4" /> Import Bundle
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Workspace</span>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
              {currentWorkspace?.name || 'Personal Workspace'}
            </div>
            <span className="text-xs text-teal-600 dark:text-teal-400 font-medium mt-0.5 block">
              {currentWorkspace?.description || 'Primary Workspace'}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-teal-500/10 text-teal-500">
            <Briefcase className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Team Members</span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{members.length}</div>
            <span className="text-xs text-slate-400 font-medium mt-0.5 block">
              {members.filter((m) => m.role === 'ADMIN').length} Admins, {members.filter((m) => m.role === 'EDITOR').length} Editors
            </span>
          </div>
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-500">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Workspace Profiles</span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{profiles.length}</div>
            <span className="text-xs text-emerald-500 font-medium mt-0.5 block">
              {profiles.filter((p) => p.status === 'RUNNING').length} Active Sessions
            </span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500">
            <Layers className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
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
            Team Members ({members.length})
          </button>
          <button
            onClick={() => setActiveTab('profiles')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'profiles'
                ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Profile Assignments ({profiles.length})
          </button>
        </div>

        {activeTab === 'members' && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-xs font-black text-slate-950 shadow-md shadow-teal-500/20 transition-all"
          >
            <UserPlus className="w-3.5 h-3.5" /> Invite Member
          </button>
        )}
      </div>

      {/* Tab 1: Team Members Table */}
      {activeTab === 'members' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 uppercase text-[11px] font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4">Member</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-600 dark:text-teal-400 font-bold flex items-center justify-center text-xs">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{member.name}</div>
                        <div className="text-[11px] text-slate-400">Joined {new Date(member.createdAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-mono text-xs">
                    {member.email}
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value as MemberRole)}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="EDITOR">EDITOR</option>
                      <option value="VIEWER">VIEWER</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" /> Active
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDeleteMember(member.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 transition-colors"
                      title="Remove Member"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Profile Assignment Matrix */}
      {activeTab === 'profiles' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 uppercase text-[11px] font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4">Profile Name</th>
                <th className="px-6 py-4">Folder & Tags</th>
                <th className="px-6 py-4">Assigned Member</th>
                <th className="px-6 py-4">Session Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {profiles.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                    {p.name}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                      {p.folder || 'General'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        if (window.mahiAPI?.workspaceAssignProfile) {
                          window.mahiAPI.workspaceAssignProfile(p.id, activeWorkspaceId, e.target.value || null);
                          showToast({ type: 'success', title: 'Assigned', message: 'Profile assigned successfully' });
                        }
                      }}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    >
                      <option value="">Unassigned (All Members)</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.role})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        p.status === 'RUNNING'
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Create Workspace */}
      {showCreateWsModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Create New Workspace</h3>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Workspace Name</label>
              <input
                type="text"
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
                placeholder="e.g. Crypto Trading Team"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description (Optional)</label>
              <input
                type="text"
                value={newWsDesc}
                onChange={(e) => setNewWsDesc(e.target.value)}
                placeholder="e.g. Dedicated team for crypto airdrops"
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

      {/* Modal: Invite Member */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Invite Team Member</h3>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="e.g. Alex Johnson"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="alex@team.com"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as MemberRole)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-bold"
              >
                <option value="ADMIN">ADMIN (Full Control)</option>
                <option value="EDITOR">EDITOR (Launch & Edit Profiles)</option>
                <option value="VIEWER">VIEWER (Read Only)</option>
              </select>
            </div>
            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleInviteMember}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 text-slate-950 font-black text-xs shadow-md shadow-teal-500/20"
              >
                Add Member
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Import Bundle */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Import Workspace Bundle</h3>
            <p className="text-xs text-slate-400">
              Paste the exported <code className="text-teal-400">.mahi-workspace</code> JSON bundle content below:
            </p>
            <textarea
              rows={6}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder="Paste JSON workspace bundle here..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white"
            />
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleImportBundle}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 text-slate-950 font-black text-xs shadow-md shadow-teal-500/20"
              >
                Import Profiles & Team
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
