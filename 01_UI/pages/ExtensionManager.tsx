import type React from 'react';
import { useState, useEffect } from 'react';
import {
  Puzzle,
  Plus,
  Trash2,
  FolderOpen,
  ToggleLeft,
  ToggleRight,
  Globe2,
  Download,
} from 'lucide-react';
import { useProfileStore } from '../stores/useProfileStore.js';
import type { ExtensionItem } from '../../10_CONFIG/shared/types/extension.js';
import { useToastStore } from '../stores/useToastStore.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import type { NavigationPage } from '../components/Sidebar.js';

interface ExtensionManagerProps {
  onNavigate: (page: NavigationPage) => void;
}

type TabMode = 'INSTALLED' | 'WEB_STORE_URL';

export const ExtensionManagerPage: React.FC<ExtensionManagerProps> = ({ onNavigate: _onNavigate }) => {
  const { profiles, selectedProfileId, setSelectedProfileId } = useProfileStore();
  const { showToast } = useToastStore();

  const [activeTab, setActiveTab] = useState<TabMode>('INSTALLED');
  const [extensions, setExtensions] = useState<ExtensionItem[]>([]);
  const [_loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExtensionItem | null>(null);

  // Manual / URL Install State
  const [webStoreUrl, setWebStoreUrl] = useState('');
  const [localFolderPath, setLocalFolderPath] = useState('');
  const [customExtName, setCustomExtName] = useState('');

  const activeProfileId = selectedProfileId || (profiles[0]?.id ?? '');
  const currentProfile = profiles.find((p) => p.id === activeProfileId);

  const loadExtensions = async () => {
    if (!activeProfileId) return;
    setLoading(true);
    try {
      if (window.mahiAPI) {
        const res = await window.mahiAPI.getExtensions(activeProfileId);
        setExtensions(res);
      }
    } catch (err) {
      console.debug('[ExtensionManager] extension list load failed', err);
    } finally {
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: loadExtensions is a stable loader; mount-only intentional
  useEffect(() => {
    void loadExtensions();
  }, []);

  const handleInstallFromUrl = async () => {
    if (!activeProfileId || !webStoreUrl.trim()) return;

    try {
      const installed = await window.mahiAPI.installFromWebStoreUrl(activeProfileId, webStoreUrl);
      showToast({
        type: 'success',
        title: 'Web Store Extension Installed',
        message: `Installed "${installed.name}" to ${currentProfile?.name}.`,
      });
      setWebStoreUrl('');
      loadExtensions();
      setActiveTab('INSTALLED');
    } catch (err: unknown) {
      showToast({
        type: 'error',
        title: 'Web Store Install Failed',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handlePickLocalFolder = async () => {
    const paths = await window.mahiAPI.openFileDialog({
      title: 'Select Unpacked Extension Folder',
      properties: ['openDirectory'],
    });
    if (paths && paths.length > 0) {
      setLocalFolderPath(paths[0]);
    }
  };

  const handleInstallLocal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfileId || !localFolderPath) return;

    try {
      const ext = await window.mahiAPI.installExtension({
        profileId: activeProfileId,
        sourcePath: localFolderPath,
        name: customExtName || undefined,
      });
      showToast({
        type: 'success',
        title: 'Local Extension Installed',
        message: `"${ext.name}" ready in profile.`,
      });
      setLocalFolderPath('');
      setCustomExtName('');
      loadExtensions();
      setActiveTab('INSTALLED');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast({ type: 'error', title: 'Installation Failed', message: msg });
    }
  };

  const handleToggle = async (ext: ExtensionItem) => {
    if (!activeProfileId || !window.mahiAPI) return;
    try {
      await window.mahiAPI.toggleExtension(activeProfileId, ext.id, !ext.enabled);
      loadExtensions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast({ type: 'error', title: 'Failed to toggle extension', message: msg });
    }
  };

  const handleDelete = async () => {
    if (!activeProfileId || !deleteTarget || !window.mahiAPI) return;
    try {
      await window.mahiAPI.removeExtension(activeProfileId, deleteTarget.id);
      showToast({ type: 'info', title: 'Extension Removed', message: 'Extension deleted.' });
      setDeleteTarget(null);
      loadExtensions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast({ type: 'error', title: 'Failed to remove extension', message: msg });
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col justify-between overflow-y-auto custom-scrollbar space-y-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-2">
              <Puzzle className="w-5 h-5 text-teal-500" />
              <span>Chrome Extension Manager</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Install and manage isolated Chrome extensions per profile.
            </p>
          </div>

          {/* Profile Switcher */}
          <div className="flex items-center space-x-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 shadow-xs">
            <span className="text-xs font-bold text-slate-400 pl-2">Active Profile:</span>
            <select
              value={activeProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.folder})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('INSTALLED')}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center space-x-2 ${
              activeTab === 'INSTALLED'
                ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Puzzle className="w-4 h-4" />
            <span>Installed Extensions ({extensions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('WEB_STORE_URL')}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center space-x-2 ${
              activeTab === 'WEB_STORE_URL'
                ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Globe2 className="w-4 h-4" />
            <span>Install via Web Store URL / Local Folder</span>
          </button>
        </div>

        {/* TAB 1: INSTALLED EXTENSIONS */}
        {activeTab === 'INSTALLED' && (
          <div>
            {extensions.length === 0 ? (
              <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl space-y-3">
                <Puzzle className="w-12 h-12 text-slate-400 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  No Extensions Installed on "{currentProfile?.name}"
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Use the "Install via Web Store URL / Local Folder" tab to add extensions.
                </p>
                <div className="pt-2">
                  <button type="button"
                    onClick={() => setActiveTab('WEB_STORE_URL')}
                    className="px-5 py-2.5 bg-teal-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-teal-500 transition-all"
                  >
                    Install Extension
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {extensions.map((ext) => (
                  <div
                    key={ext.id}
                    className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col justify-between space-y-4 hover:border-teal-500/30 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                          <Puzzle className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                            {ext.name}
                          </h4>
                          <span className="text-[10px] font-mono text-slate-400">
                            v{ext.version} • {ext.sourceType}
                          </span>
                        </div>
                      </div>

                      <button type="button"
                        onClick={() => handleToggle(ext)}
                        className="text-slate-400 hover:text-teal-500 transition-colors"
                        title={ext.enabled ? 'Disable' : 'Enable'}
                      >
                        {ext.enabled ? (
                          <ToggleRight className="w-6 h-6 text-teal-500" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-slate-400" />
                        )}
                      </button>
                    </div>

                    {ext.description && (
                      <p className="text-xs text-slate-400 line-clamp-2">
                        {ext.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-semibold text-slate-400">
                        {ext.enabled ? (
                          <span className="text-emerald-500">Active in browser</span>
                        ) : (
                          'Disabled'
                        )}
                      </span>
                      <button type="button"
                        onClick={() => setDeleteTarget(ext)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-colors"
                        title="Remove Extension"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: WEB STORE URL / LOCAL FOLDER */}
        {activeTab === 'WEB_STORE_URL' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Section A: Chrome Web Store URL */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                  <Globe2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Chrome Web Store URL
                  </h3>
                  <p className="text-xs text-slate-400">
                    Paste extension store link or 32-char ID
                  </p>
                </div>
              </div>

              <div>
                <label htmlFor="field-001" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Extension URL / ID
                </label>
                <input
                  type="text"
                  value={webStoreUrl}
                  onChange={(e) => setWebStoreUrl(e.target.value)}
                  placeholder="https://chromewebstore.google.com/detail/.../cjpalhdlnbpafiamejdnhcphjbkeiagm"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono"
                />
              </div>

              <button
                type="button"
                onClick={handleInstallFromUrl}
                disabled={!webStoreUrl.trim()}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-md shadow-cyan-600/20 active:scale-95 transition-all flex items-center justify-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Fetch & Install from Chrome Web Store</span>
              </button>
            </div>

            {/* Section B: Local Unpacked Folder */}
            <form
              onSubmit={handleInstallLocal}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4"
            >
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Unpacked Extension Folder
                  </h3>
                  <p className="text-xs text-slate-400">
                    Load local folder containing manifest.json
                  </p>
                </div>
              </div>

              <div>
                <label htmlFor="field-002" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Extension Directory
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={localFolderPath}
                    placeholder="No folder chosen"
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={handlePickLocalFolder}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold rounded-xl"
                  >
                    Browse
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="field-003" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Custom Display Name (Optional)
                </label>
                <input
                  type="text"
                  value={customExtName}
                  onChange={(e) => setCustomExtName(e.target.value)}
                  placeholder="Auto-detected from manifest"
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={!localFolderPath}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-md shadow-teal-600/20 active:scale-95 transition-all flex items-center justify-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Install Local Extension</span>
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="Remove Extension"
        message={`Are you sure you want to remove "${deleteTarget?.name}" from this profile?`}
        confirmLabel="Remove"
        isDestructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
