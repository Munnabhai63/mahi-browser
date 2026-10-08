import React, { useState } from 'react';
import {
  Globe2,
  Search,
  Filter,
  Plus,
  Play,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  AlertTriangle,
  RefreshCw,
  Folder,
  Tag,
  Shield,
  Laptop,
} from 'lucide-react';
import { DeviceLaunchModal } from '../components/DeviceLaunchModal.js';
import { ProfileModal } from '../components/ProfileModal.js';
import { ConfirmModal } from '../components/ConfirmModal.js';

export interface WebProfileItem {
  id: string;
  name: string;
  folder?: string;
  tags?: string[];
  notes?: string;
  syncStatus?: 'SYNCED' | 'PENDING' | 'CONFLICT' | 'OFFLINE' | 'LOCKED' | 'FAILED';
  isLocked?: boolean;
  lockedBy?: string;
  version?: number;
  assignedProxy?: string;
  lastSync?: string;
  createdAt?: string;
}

interface ProfilesPageProps {
  profiles: WebProfileItem[];
  isLoading: boolean;
  onRefresh: () => void;
  onCreateProfile: (dto: { name: string; folder?: string; notes?: string; tags?: string[] }) => Promise<void>;
  onUpdateProfile: (id: string, dto: { name?: string; folder?: string; notes?: string; tags?: string[] }) => Promise<void>;
  onDeleteProfile: (id: string) => Promise<void>;
  onLaunchProfile: (id: string) => Promise<{ success: boolean; code?: string; message?: string }>;
  onNavigateToDevices?: () => void;
}

export const ProfilesPage: React.FC<ProfilesPageProps> = ({
  profiles,
  isLoading,
  onRefresh,
  onCreateProfile,
  onUpdateProfile,
  onDeleteProfile,
  onLaunchProfile,
  onNavigateToDevices,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [folderFilter, setFolderFilter] = useState<string>('ALL');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<WebProfileItem | null>(null);
  const [deletingProfile, setDeletingProfile] = useState<WebProfileItem | null>(null);
  const [isDeletingPending, setIsDeletingPending] = useState(false);

  // Honest Device Launch Modal state
  const [deviceModalProfile, setDeviceModalProfile] = useState<WebProfileItem | null>(null);
  const [isLaunchingId, setIsLaunchingId] = useState<string | null>(null);

  // Filter profiles
  const uniqueFolders = Array.from(new Set(profiles.map((p) => p.folder).filter(Boolean))) as string[];

  const filteredProfiles = profiles.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.folder && p.folder.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.tags && p.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase())));

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'LOCKED' && p.isLocked) ||
      (statusFilter === 'SYNCED' && p.syncStatus === 'SYNCED') ||
      (statusFilter === 'PENDING' && p.syncStatus === 'PENDING') ||
      (statusFilter === 'CONFLICT' && p.syncStatus === 'CONFLICT');

    const matchesFolder = folderFilter === 'ALL' || p.folder === folderFilter;

    return matchesSearch && matchesStatus && matchesFolder;
  });

  const handleLaunch = async (profile: WebProfileItem) => {
    setIsLaunchingId(profile.id);
    try {
      const res = await onLaunchProfile(profile.id);
      if (!res.success || res.code === 'DEVICE_REQUIRED') {
        // Honest launch flow: display DeviceLaunchModal informing user desktop app is required
        setDeviceModalProfile(profile);
      }
    } catch {
      setDeviceModalProfile(profile);
    } finally {
      setIsLaunchingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingProfile) return;
    setIsDeletingPending(true);
    try {
      await onDeleteProfile(deletingProfile.id);
      setDeletingProfile(null);
    } finally {
      setIsDeletingPending(false);
    }
  };

  const getSyncStatusBadge = (status?: string, isLocked?: boolean) => {
    if (isLocked) {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <Lock className="w-3 h-3" />
          <span>LOCKED</span>
        </span>
      );
    }

    switch (status) {
      case 'SYNCED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>SYNCED</span>
          </span>
        );
      case 'CONFLICT':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <AlertTriangle className="w-3 h-3" />
            <span>CONFLICT</span>
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>PENDING</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
            <span>OFFLINE</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Cloud Browser Profiles</h2>
          <p className="text-xs text-slate-400">
            Synchronized profile configurations managed via Remote Cloud API
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl transition-colors disabled:opacity-50"
            title="Refresh Profiles List"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-teal-400' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-teal-600/20 flex items-center space-x-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Cloud Profile</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="p-4 bg-[#0c1222] border border-slate-800 rounded-2xl flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search profiles by name, tag, or folder..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500/50"
          />
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center space-x-1.5 w-full md:w-auto">
            <span className="text-[11px] text-slate-400 shrink-0">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-teal-500/50"
            >
              <option value="ALL">All Statuses</option>
              <option value="SYNCED">Synced Only</option>
              <option value="LOCKED">Locked / Running</option>
              <option value="PENDING">Pending Sync</option>
              <option value="CONFLICT">Sync Conflict</option>
            </select>
          </div>

          {/* Folder Filter */}
          {uniqueFolders.length > 0 && (
            <div className="flex items-center space-x-1.5 w-full md:w-auto">
              <span className="text-[11px] text-slate-400 shrink-0">Folder:</span>
              <select
                value={folderFilter}
                onChange={(e) => setFolderFilter(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-teal-500/50"
              >
                <option value="ALL">All Folds</option>
                {uniqueFolders.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Profiles Table / Card List */}
      <div className="bg-[#0c1222] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {isLoading && profiles.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="animate-spin inline-block w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full" />
            <p className="text-xs text-slate-400">Loading cloud profiles from Remote API...</p>
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 text-slate-500 mx-auto flex items-center justify-center">
              <Globe2 className="w-6 h-6" />
            </div>
            <div className="text-sm font-semibold text-slate-200">No Profiles Found</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchTerm || statusFilter !== 'ALL' || folderFilter !== 'ALL'
                ? 'No profiles match the current filter criteria.'
                : 'No browser profiles exist in this workspace. Create one to begin.'}
            </p>
            {searchTerm === '' && (
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="mt-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-teal-600/20"
              >
                Create First Profile
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Profile Name</th>
                  <th className="py-3 px-4">Folder & Tags</th>
                  <th className="py-3 px-4">Sync State</th>
                  <th className="py-3 px-4">Proxy</th>
                  <th className="py-3 px-4">Version</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredProfiles.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-900/40 transition-colors">
                    {/* Name & ID */}
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
                          <Globe2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-100 flex items-center space-x-1.5">
                            <span>{p.name}</span>
                            {p.isLocked && <Lock className="w-3 h-3 text-amber-400 shrink-0" />}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500">{p.id}</div>
                        </div>
                      </div>
                    </td>

                    {/* Folder & Tags */}
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        {p.folder && (
                          <div className="inline-flex items-center space-x-1 text-[11px] text-slate-300">
                            <Folder className="w-3 h-3 text-slate-400" />
                            <span>{p.folder}</span>
                          </div>
                        )}
                        {p.tags && p.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {p.tags.slice(0, 3).map((t) => (
                              <span
                                key={t}
                                className="px-1.5 py-0.5 bg-slate-900 text-slate-400 rounded text-[9px] border border-slate-800"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Sync State Badge */}
                    <td className="py-3 px-4">{getSyncStatusBadge(p.syncStatus, p.isLocked)}</td>

                    {/* Assigned Proxy */}
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {p.assignedProxy ? (
                        <span className="flex items-center space-x-1 text-slate-300">
                          <Shield className="w-3 h-3 text-emerald-400" />
                          <span>{p.assignedProxy}</span>
                        </span>
                      ) : (
                        <span className="text-slate-600">Direct / No Proxy</span>
                      )}
                    </td>

                    {/* Version */}
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      v{p.version || 1}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        {/* Run on Device button */}
                        <button
                          type="button"
                          onClick={() => handleLaunch(p)}
                          disabled={isLaunchingId === p.id}
                          className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg font-semibold flex items-center space-x-1 transition-colors disabled:opacity-50"
                          title="Run Profile on Desktop Device"
                        >
                          <Play className="w-3 h-3" />
                          <span className="hidden sm:inline">Run</span>
                        </button>

                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => setEditingProfile(p)}
                          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                          title="Edit Profile Metadata"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => setDeletingProfile(p)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                          title="Delete Profile"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Profile Modal */}
      <ProfileModal
        isOpen={isCreateOpen}
        mode="create"
        onClose={() => setIsCreateOpen(false)}
        onSubmit={async (dto) => {
          await onCreateProfile(dto);
        }}
      />

      {/* Edit Profile Modal */}
      {editingProfile && (
        <ProfileModal
          isOpen={true}
          mode="edit"
          initialData={editingProfile}
          onClose={() => setEditingProfile(null)}
          onSubmit={async (dto) => {
            await onUpdateProfile(editingProfile.id, dto);
          }}
        />
      )}

      {/* Honest Device Launch Modal */}
      {deviceModalProfile && (
        <DeviceLaunchModal
          isOpen={true}
          profileName={deviceModalProfile.name}
          onClose={() => setDeviceModalProfile(null)}
          onNavigateToDevices={onNavigateToDevices}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingProfile && (
        <ConfirmModal
          isOpen={true}
          title={`Delete Profile "${deletingProfile.name}"?`}
          message="This action will delete the profile metadata and zero-knowledge cloud state from the remote server. Are you sure you wish to proceed?"
          confirmLabel="Delete Profile"
          confirmVariant="danger"
          isPending={isDeletingPending}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingProfile(null)}
        />
      )}
    </div>
  );
};
