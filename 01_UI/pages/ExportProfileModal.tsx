import type React from 'react';
import { useState } from 'react';
import {
  Download,
  CheckCircle2,
  Layers,
  FileText,
  Archive,
} from 'lucide-react';
import { useProfileStore } from '../stores/useProfileStore.js';
import { useToastStore } from '../stores/useToastStore.js';
import type { NavigationPage } from '../components/Sidebar.js';

interface ExportProfileProps {
  onNavigate: (page: NavigationPage) => void;
}

type ExportMode = 'SINGLE_ARCHIVE' | 'NETSCAPE_COOKIES' | 'BULK_BACKUP';

export const ExportProfilePage: React.FC<ExportProfileProps> = ({ onNavigate }) => {
  const { profiles, selectedProfileId, setSelectedProfileId } = useProfileStore();
  const { showToast } = useToastStore();

  const [mode, setMode] = useState<ExportMode>('SINGLE_ARCHIVE');
  const activeProfileId = selectedProfileId || (profiles[0]?.id ?? '');
  const profile = profiles.find((p) => p.id === activeProfileId);

  // Single Archive Options
  const [includeCookies, setIncludeCookies] = useState(true);
  const [includeHistory, _setIncludeHistory] = useState(false);
  const [includeExtensions, setIncludeExtensions] = useState(true);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Bulk Archive Options
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>(profiles.map((p) => p.id));

  // Netscape Cookies Preview State
  const [_netscapeText, setNetscapeText] = useState('');

  const handleExportSingle = async () => {
    if (!profile) return;
    setLoading(true);

    try {
      const savePath = await window.mahiAPI.openSaveDialog({
        title: `Export ${profile.name}`,
        defaultPath: `${profile.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.mahi-profile`,
        filters: [{ name: 'Mahi Profile Archive (*.mahi-profile)', extensions: ['mahi-profile'] }],
      });

      if (!savePath) {
        return;
      }

      const res = await window.mahiAPI.exportProfile({
        profileId: profile.id,
        targetFilePath: savePath,
        includeCookies,
        includeHistory,
        includeExtensions,
        includeBrowserSettings: true,
        password: password || undefined,
      });

      if (res.success) {
        showToast({
          type: 'success',
          title: 'Export Complete',
          message: `Saved archive to ${res.filePath}`,
        });
        onNavigate('profiles');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast({ type: 'error', title: 'Export Failed', message: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleExportNetscape = async () => {
    if (!profile) return;
    setLoading(true);

    try {
      const savePath = await window.mahiAPI.openSaveDialog({
        title: `Export Cookies - ${profile.name}`,
        defaultPath: `${profile.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_cookies.txt`,
        filters: [{ name: 'Netscape Cookie File (*.txt)', extensions: ['txt'] }],
      });

      if (!savePath) {
        return;
      }

      const text = await window.mahiAPI.exportNetscapeCookies(profile.id, savePath);
      setNetscapeText(text);

      showToast({
        type: 'success',
        title: 'Netscape Cookies Exported',
        message: `Saved Netscape cookie file to ${savePath}`,
      });
    } catch (err: unknown) {
      showToast({ type: 'error', title: 'Cookie Export Failed', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleExportBulk = async () => {
    if (bulkSelectedIds.length === 0) return;
    setLoading(true);

    try {
      const savePath = await window.mahiAPI.openSaveDialog({
        title: `Export ${bulkSelectedIds.length} Profiles`,
        defaultPath: `MAHI_Workspace_Backup_${new Date().toISOString().slice(0, 10)}.mahi-backup`,
        filters: [{ name: 'Mahi Workspace Backup (*.mahi-backup)', extensions: ['mahi-backup'] }],
      });

      if (!savePath) {
        return;
      }

      const res = await window.mahiAPI.exportBulkProfiles({
        profileIds: bulkSelectedIds,
        targetFilePath: savePath,
        includeCookies: true,
        includeHistory: false,
        includeExtensions: true,
        password: password || undefined,
      });

      if (res.success) {
        showToast({
          type: 'success',
          title: 'Bulk Export Complete',
          message: `Archived ${res.profileCount} profiles to ${res.filePath}`,
        });
        onNavigate('profiles');
      }
    } catch (err: unknown) {
      showToast({ type: 'error', title: 'Bulk Export Failed', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto h-full flex flex-col justify-between overflow-y-auto custom-scrollbar">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            📦 Universal Profile Export & Backup
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Export isolated browser profiles into encrypted archives, Netscape cookie lists, or full workspace backups.
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => setMode('SINGLE_ARCHIVE')}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center space-x-2 ${
              mode === 'SINGLE_ARCHIVE'
                ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Archive className="w-4 h-4" />
            <span>Single Profile Archive</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('NETSCAPE_COOKIES')}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center space-x-2 ${
              mode === 'NETSCAPE_COOKIES'
                ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Netscape Cookies (.txt)</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('BULK_BACKUP')}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center space-x-2 ${
              mode === 'BULK_BACKUP'
                ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Multi-Profile Workspace Backup</span>
          </button>
        </div>

        {/* MODE 1: SINGLE PROFILE ARCHIVE */}
        {mode === 'SINGLE_ARCHIVE' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div>
              <label htmlFor="field-001" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Select Profile to Export
              </label>
              <select
                value={activeProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    👤 {p.name} ({p.folder})
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Components to Include
              </span>
              <div className="space-y-2 text-xs">
                <label htmlFor="field-002" className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeCookies}
                    onChange={(e) => setIncludeCookies(e.target.checked)}
                    className="rounded border-slate-700 text-teal-600 focus:ring-teal-500"
                  />
                  <span>Include Session Cookies (retains logins and authentication)</span>
                </label>
                <label htmlFor="field-003" className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeExtensions}
                    onChange={(e) => setIncludeExtensions(e.target.checked)}
                    className="rounded border-slate-700 text-teal-600 focus:ring-teal-500"
                  />
                  <span>Include Chrome Extension Configurations</span>
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <label htmlFor="field-004" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Optional Encryption Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank for master encryption or enter custom password"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
              />
            </div>
          </div>
        )}

        {/* MODE 2: NETSCAPE COOKIES */}
        {mode === 'NETSCAPE_COOKIES' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div>
              <label htmlFor="field-005" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Select Profile
              </label>
              <select
                value={activeProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    👤 {p.name} ({p.folder})
                  </option>
                ))}
              </select>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Netscape HTTP Cookie Format Description
              </span>
              <p className="text-xs text-slate-400">
                Exports cookies in tab-separated Netscape format (compatible with Cookie-Editor, EditThisCookie, and Python requests).
              </p>
              <pre className="p-2.5 bg-white dark:bg-slate-900 rounded-lg text-[10px] font-mono text-teal-600 dark:text-teal-400 overflow-x-auto">
                .google.com  TRUE  /  TRUE  1798765432  SID  abcdef123456
              </pre>
            </div>
          </div>
        )}

        {/* MODE 3: BULK WORKSPACE BACKUP */}
        {mode === 'BULK_BACKUP' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <label htmlFor="field-006" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Select Profiles to Include in Backup ({bulkSelectedIds.length} chosen)
              </label>
              <div className="space-x-2 text-xs">
                <button
                  type="button"
                  onClick={() => setBulkSelectedIds(profiles.map((p) => p.id))}
                  className="text-teal-600 dark:text-teal-400 font-bold hover:underline"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => setBulkSelectedIds([])}
                  className="text-slate-400 font-bold hover:underline"
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 custom-scrollbar border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 bg-slate-50 dark:bg-slate-950">
              {profiles.map((p) => {
                const isSelected = bulkSelectedIds.includes(p.id);
                return (
                  <button type="button"
                    key={p.id}
                    onClick={() => {
                      if (isSelected) {
                        setBulkSelectedIds(bulkSelectedIds.filter((id) => id !== p.id));
                      } else {
                        setBulkSelectedIds([...bulkSelectedIds, p.id]);
                      }
                    }}
                    className={`w-full p-2 rounded-lg text-left text-xs flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold border border-teal-500/30'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>👤 {p.name} ({p.folder})</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-6 border-t border-slate-200 dark:border-slate-800">
        <button type="button"
          onClick={() => onNavigate('profiles')}
          className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200"
        >
          Cancel
        </button>

        {mode === 'SINGLE_ARCHIVE' && (
          <button type="button"
            onClick={handleExportSingle}
            disabled={loading || !profile}
            className="px-6 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-lg shadow-teal-600/20 flex items-center space-x-2 active:scale-95 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>{loading ? 'Exporting...' : 'Export .mahi-profile'}</span>
          </button>
        )}

        {mode === 'NETSCAPE_COOKIES' && (
          <button type="button"
            onClick={handleExportNetscape}
            disabled={loading || !profile}
            className="px-6 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-lg shadow-teal-600/20 flex items-center space-x-2 active:scale-95 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>{loading ? 'Generating...' : 'Download Netscape Cookies (.txt)'}</span>
          </button>
        )}

        {mode === 'BULK_BACKUP' && (
          <button type="button"
            onClick={handleExportBulk}
            disabled={loading || bulkSelectedIds.length === 0}
            className="px-6 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-lg shadow-teal-600/20 flex items-center space-x-2 active:scale-95 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>{loading ? 'Archiving...' : `Backup ${bulkSelectedIds.length} Profiles (.mahi-backup)`}</span>
          </button>
        )}
      </div>
    </div>
  );
};
