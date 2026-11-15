import React, { useState } from 'react';
import {
  FolderPlus,
  FolderOpen,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  ArrowRight,
  Shield,
  Upload,
  Layers,
  FileText,
  Sparkles,
} from 'lucide-react';
import { useProfileStore } from '../stores/useProfileStore.js';
import { useToastStore } from '../stores/useToastStore.js';
import { ImportProfilePreview, CrossPlatformImportDTO } from '../../10_CONFIG/shared/types/archive.js';
import { NavigationPage } from '../components/Sidebar.js';

interface ImportProfileProps {
  onNavigate: (page: NavigationPage) => void;
}

type ImportMode = 'MAHI_ARCHIVE' | 'CROSS_PLATFORM_JSON' | 'NETSCAPE_COOKIES';

export const ImportProfilePage: React.FC<ImportProfileProps> = ({ onNavigate }) => {
  const { fetchProfiles, createProfile } = useProfileStore();
  const { showToast } = useToastStore();

  const [mode, setMode] = useState<ImportMode>('MAHI_ARCHIVE');

  // Mode 1: MAHI Archive
  const [filePath, setFilePath] = useState('');
  const [password, setPassword] = useState('');
  const [overrideName, setOverrideName] = useState('');
  const [targetFolder, setTargetFolder] = useState('Imported');
  const [preview, setPreview] = useState<ImportProfilePreview | null>(null);
  const [loading, setLoading] = useState(false);

  // Mode 2: Cross Platform JSON
  const [platform, setPlatform] = useState<CrossPlatformImportDTO['platform']>('DOLPHIN');
  const [jsonText, setJsonText] = useState('');
  const [jsonFolder, setJsonFolder] = useState('Imported');

  // Mode 3: Netscape Cookies Text
  const [cookieProfileName, setCookieProfileName] = useState('New Cookie Profile');
  const [netscapeText, setNetscapeText] = useState('');

  const handleBrowseFile = async () => {
    const paths = await window.mahiAPI.openFileDialog({
      title: 'Select .mahi-profile Archive',
      filters: [{ name: 'Mahi Profile Archive (*.mahi-profile, *.mahi-backup)', extensions: ['mahi-profile', 'mahi-backup', 'json'] }],
    });
    if (paths && paths.length > 0) {
      setFilePath(paths[0]);
      handleValidate(paths[0], password);
    }
  };

  const handleValidate = async (path: string, pwd?: string) => {
    if (!path) return;
    setLoading(true);
    try {
      const res = await window.mahiAPI.previewImportProfile(path, pwd || undefined);
      setPreview(res);
      if (res.valid && res.profileName) {
        setOverrideName(`${res.profileName} (Imported)`);
        setTargetFolder(res.folder || 'Imported');
      } else if (!res.valid) {
        showToast({
          type: 'error',
          title: 'Invalid Archive',
          message: res.errorMessage || 'Failed to read profile archive.',
        });
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Validation Failed',
        message: err?.message || 'Could not validate file.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImportArchive = async () => {
    if (!filePath || !preview || !preview.valid) return;
    setLoading(true);

    try {
      const imported = await window.mahiAPI.importProfile({
        sourceFilePath: filePath,
        password: password || undefined,
        overrideName: overrideName || undefined,
        targetFolder: targetFolder || undefined,
      });

      showToast({
        type: 'success',
        title: 'Profile Imported',
        message: `Profile "${imported.name}" successfully restored.`,
      });
      await fetchProfiles();
      onNavigate('profiles');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast({ type: 'error', title: 'Import Failed', message: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleImportCrossPlatform = async () => {
    if (!jsonText.trim()) return;
    setLoading(true);

    try {
      const res = await window.mahiAPI.importCrossPlatformProfiles({
        platform,
        jsonData: jsonText,
        targetFolder: jsonFolder || 'Imported',
      });

      if (res.success) {
        showToast({
          type: 'success',
          title: 'Cross-Platform Profiles Imported',
          message: `Successfully imported ${res.importedCount} profiles from ${platform}.`,
        });
        await fetchProfiles();
        onNavigate('profiles');
      } else {
        showToast({
          type: 'error',
          title: 'Import Failed',
          message: res.errors?.join(', ') || 'Failed to parse profiles',
        });
      }
    } catch (err: any) {
      showToast({ type: 'error', title: 'Import Error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleImportNetscape = async () => {
    if (!netscapeText.trim()) return;
    setLoading(true);

    try {
      const newProf = await createProfile({
        name: cookieProfileName || 'Cookie Profile',
        folder: 'Imported',
        settings: {} as any,
      });

      if (newProf && window.mahiAPI?.importCookies) {
        await window.mahiAPI.importCookies(newProf.id, netscapeText);
      }

      showToast({
        type: 'success',
        title: 'Cookies Imported',
        message: `Created profile "${cookieProfileName}" with imported cookies.`,
      });
      await fetchProfiles();
      onNavigate('profiles');
    } catch (err: any) {
      showToast({ type: 'error', title: 'Cookie Import Error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto h-full flex flex-col justify-between overflow-y-auto custom-scrollbar">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            🔄 Universal Profile & Data Importer
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Restore profiles from `.mahi-profile` archives, Netscape cookies, or import from Dolphin Anty, AdsPower & GoLogin.
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => setMode('MAHI_ARCHIVE')}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center space-x-2 ${
              mode === 'MAHI_ARCHIVE'
                ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>.mahi-profile Archive</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('CROSS_PLATFORM_JSON')}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center space-x-2 ${
              mode === 'CROSS_PLATFORM_JSON'
                ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Dolphin / AdsPower / GoLogin JSON</span>
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
        </div>

        {/* MODE 1: MAHI ARCHIVE */}
        {mode === 'MAHI_ARCHIVE' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Select Profile Archive (.mahi-profile)
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={filePath}
                    placeholder="No archive selected"
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono"
                  />
                  <button
                    onClick={handleBrowseFile}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center space-x-1.5"
                  >
                    <FolderOpen className="w-4 h-4" />
                    <span>Browse</span>
                  </button>
                </div>
              </div>

              {preview?.isEncrypted && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Archive Password
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter decryption password"
                      className="flex-1 px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                    />
                    <button
                      onClick={() => handleValidate(filePath, password)}
                      className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl"
                    >
                      Unlock
                    </button>
                  </div>
                </div>
              )}
            </div>

            {preview && preview.valid && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 space-y-3">
                <div className="flex items-center space-x-2 font-bold text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Valid Profile Archive: {preview.profileName}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-slate-600 dark:text-slate-300 font-mono">
                  <div>🍪 {preview.cookieCount} Cookies</div>
                  <div>🧩 {preview.extensionCount} Extensions</div>
                  <div>🌐 {preview.browserEngine.toUpperCase()}</div>
                </div>
              </div>
            )}

            {preview && !preview.valid && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-5 space-y-2">
                <div className="flex items-center space-x-2 font-bold text-xs text-rose-600 dark:text-rose-400">
                  <AlertCircle className="w-4 h-4" />
                  <span>Invalid Profile Archive</span>
                </div>
                <div className="text-xs text-rose-500">
                  {preview.errorMessage || 'This archive could not be verified or the password was incorrect.'}
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODE 2: CROSS PLATFORM JSON */}
        {mode === 'CROSS_PLATFORM_JSON' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Source Platform
                </label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as any)}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold"
                >
                  <option value="DOLPHIN">🐬 Dolphin Anty JSON</option>
                  <option value="ADSPOWER">⚡ AdsPower JSON</option>
                  <option value="GOLOGIN">🌐 GoLogin JSON</option>
                  <option value="GENERIC_JSON">📄 Generic Profiles JSON</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Target Folder
                </label>
                <input
                  type="text"
                  value={jsonFolder}
                  onChange={(e) => setJsonFolder(e.target.value)}
                  placeholder="e.g. Dolphin-Imported"
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Paste Profiles JSON Export
              </label>
              <textarea
                rows={7}
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder='[{"name": "Profile 1", "userAgent": "...", "cookies": [...]}]'
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono"
              />
            </div>
          </div>
        )}

        {/* MODE 3: NETSCAPE COOKIES */}
        {mode === 'NETSCAPE_COOKIES' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                New Profile Name
              </label>
              <input
                type="text"
                value={cookieProfileName}
                onChange={(e) => setCookieProfileName(e.target.value)}
                placeholder="e.g. Amazon Account Cookies"
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Paste Netscape Cookie File Content
              </label>
              <textarea
                rows={7}
                value={netscapeText}
                onChange={(e) => setNetscapeText(e.target.value)}
                placeholder=".google.com&#9;TRUE&#9;/&#9;TRUE&#9;1798765432&#9;SID&#9;abcdef..."
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono"
              />
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-6 border-t border-slate-200 dark:border-slate-800">
        <button
          onClick={() => onNavigate('profiles')}
          className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200"
        >
          Cancel
        </button>

        {mode === 'MAHI_ARCHIVE' && (
          <button
            onClick={handleImportArchive}
            disabled={loading || !preview || !preview.valid}
            className="px-6 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-lg shadow-teal-600/20 flex items-center space-x-2 active:scale-95 transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>{loading ? 'Importing...' : 'Restore Profile'}</span>
          </button>
        )}

        {mode === 'CROSS_PLATFORM_JSON' && (
          <button
            onClick={handleImportCrossPlatform}
            disabled={loading || !jsonText.trim()}
            className="px-6 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-lg shadow-teal-600/20 flex items-center space-x-2 active:scale-95 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>{loading ? 'Importing...' : `Import from ${platform}`}</span>
          </button>
        )}

        {mode === 'NETSCAPE_COOKIES' && (
          <button
            onClick={handleImportNetscape}
            disabled={loading || !netscapeText.trim()}
            className="px-6 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-lg shadow-teal-600/20 flex items-center space-x-2 active:scale-95 transition-all"
          >
            <FileText className="w-4 h-4" />
            <span>{loading ? 'Creating Profile...' : 'Import Netscape Cookies'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
