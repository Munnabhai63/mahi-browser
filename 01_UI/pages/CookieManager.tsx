import React, { useState, useEffect } from 'react';
import {
  Globe2,
  Search,
  Trash2,
  Download,
  Upload,
  AlertTriangle,
  FileCode,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useProfileStore } from '../stores/useProfileStore.js';
import { CookieItem } from '../../10_CONFIG/shared/types/cookie.js';
import { useToastStore } from '../stores/useToastStore.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import { NavigationPage } from '../components/Sidebar.js';

interface CookieManagerProps {
  onNavigate: (page: NavigationPage) => void;
}

export const CookieManagerPage: React.FC<CookieManagerProps> = ({ onNavigate }) => {
  const { profiles, selectedProfileId, setSelectedProfileId } = useProfileStore();
  const { showToast } = useToastStore();

  const [cookies, setCookies] = useState<CookieItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importContent, setImportContent] = useState('');
  const [isExportWarningOpen, setIsExportWarningOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'netscape'>('json');
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  const activeProfileId = selectedProfileId || (profiles[0]?.id ?? '');

  const loadCookies = async () => {
    if (!activeProfileId) return;
    setLoading(true);
    try {
      if (window.mahiAPI) {
        const res = await window.mahiAPI.getCookies({
          profileId: activeProfileId,
          searchQuery,
          domain: domainFilter || undefined,
        });
        setCookies(res);
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Failed to load cookies',
        message: err?.message || 'Could not retrieve cookie jar.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCookies();
  }, [activeProfileId, searchQuery, domainFilter]);

  const handleDeleteOne = async (cookieId: string) => {
    if (!activeProfileId) return;
    try {
      await window.mahiAPI.deleteCookie(activeProfileId, cookieId);
      showToast({ type: 'info', title: 'Cookie Removed', message: 'Cookie deleted.' });
      loadCookies();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Delete Failed', message: err?.message || 'Could not remove cookie.' });
    }
  };

  const handleClearAll = async () => {
    if (!activeProfileId) return;
    try {
      await window.mahiAPI.deleteAllCookies(activeProfileId);
      showToast({ type: 'info', title: 'Cookies Cleared', message: 'All cookies purged.' });
      setIsClearConfirmOpen(false);
      loadCookies();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Clear Failed', message: err?.message || 'Could not purge cookies.' });
    }
  };

  const handleImport = async () => {
    if (!activeProfileId || !importContent.trim()) return;
    try {
      const result = await window.mahiAPI.importCookies(activeProfileId, importContent);
      if (result.importedCount > 0) {
        showToast({
          type: 'success',
          title: 'Cookies Imported',
          message: `Imported ${result.importedCount} cookies.`,
        });
        setIsImportModalOpen(false);
        setImportContent('');
        loadCookies();
      } else {
        showToast({
          type: 'error',
          title: 'Import Failed',
          message: result.errors[0] || 'Invalid cookie syntax',
        });
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Import Error',
        message: err?.message || 'Could not process cookies.',
      });
    }
  };

  const handleConfirmExport = async () => {
    if (!activeProfileId) return;
    try {
      const data = await window.mahiAPI.exportCookies({
        profileId: activeProfileId,
        format: exportFormat,
        includeSensitive: true,
      });

      const blob = new Blob([data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cookies_${activeProfileId}_${exportFormat}.${exportFormat === 'json' ? 'json' : 'txt'}`;
      a.click();
      URL.revokeObjectURL(url);

      setIsExportWarningOpen(false);
      showToast({ type: 'success', title: 'Cookies Exported', message: 'Download started.' });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Export Failed',
        message: err?.message || 'Could not export cookies.',
      });
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto h-full flex flex-col justify-between overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Cookie Manager</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Inspect, import, and export isolated cookies for each browser profile.
          </p>
        </div>

        {/* Profile Selector */}
        <div className="flex items-center space-x-3">
          <select
            value={activeProfileId}
            onChange={(e) => setSelectedProfileId(e.target.value)}
            className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500 shadow-xs"
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                👤 {p.name} ({p.folder})
              </option>
            ))}
          </select>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import</span>
          </button>

          <button
            onClick={() => setIsExportWarningOpen(true)}
            disabled={cookies.length === 0}
            className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 disabled:opacity-40 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>

          <button
            onClick={() => setIsClearConfirmOpen(true)}
            disabled={cookies.length === 0}
            className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-40 text-rose-500 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex items-center space-x-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cookie name or domain..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
          />
        </div>
        <span className="text-xs text-slate-400">{cookies.length} cookies found</span>
      </div>

      {/* Cookies Table */}
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {cookies.length === 0 ? (
          <div className="p-12 text-center">
            <Globe2 className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Cookies in this Profile</h4>
            <p className="text-xs text-slate-400 mt-0.5 mb-4">Launch the profile and visit websites to accumulate session cookies, or import them.</p>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-4 py-2 bg-teal-600 text-white text-xs font-semibold rounded-xl"
            >
              Import Cookies
            </button>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/50 dark:bg-slate-950/40">
                <th className="py-3 px-5">Domain</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Path</th>
                <th className="py-3 px-4">Expires</th>
                <th className="py-3 px-4">Flags</th>
                <th className="py-3 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
              {cookies.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-5 font-mono text-teal-600 dark:text-teal-400 font-semibold">{c.domain}</td>
                  <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-200">{c.name}</td>
                  <td className="py-3 px-4 font-mono text-slate-500">{c.path}</td>
                  <td className="py-3 px-4 text-slate-400">
                    {c.expires ? new Date(c.expires * 1000).toLocaleDateString() : 'Session'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-1.5 text-[10px] font-semibold">
                      {c.httpOnly && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          HttpOnly
                        </span>
                      )}
                      {c.secure && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500">
                          Secure
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-5 text-right">
                    <button
                      onClick={() => handleDeleteOne(c.id)}
                      className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Import Cookies Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs select-none">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Import Cookies</h3>
            <p className="text-xs text-slate-400 mt-0.5 mb-3">
              Paste JSON cookie array or Netscape HTTP Cookie file text.
            </p>

            <textarea
              rows={8}
              value={importContent}
              onChange={(e) => setImportContent(e.target.value)}
              placeholder="Paste Netscape or JSON cookies here..."
              className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono focus:outline-none focus:border-teal-500 resize-none"
            />

            <div className="flex items-center justify-end space-x-3 mt-4">
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!importContent.trim()}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-sm"
              >
                Import Cookies
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Sensitive Data Warning Modal */}
      {isExportWarningOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs select-none">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-amber-500/30 p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start space-x-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Security Warning</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Exporting cookies contains active session tokens and login states. Never share exported cookie files with unauthorized parties.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-xs">
              <label className="block font-semibold text-slate-700 dark:text-slate-300">Format</label>
              <div className="flex space-x-3">
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="exportFormat"
                    checked={exportFormat === 'json'}
                    onChange={() => setExportFormat('json')}
                  />
                  <span>JSON Format</span>
                </label>
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="exportFormat"
                    checked={exportFormat === 'netscape'}
                    onChange={() => setExportFormat('netscape')}
                  />
                  <span>Netscape Text Format</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 mt-6">
              <button
                onClick={() => setIsExportWarningOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmExport}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-sm"
              >
                I Understand, Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Confirmation */}
      <ConfirmModal
        isOpen={isClearConfirmOpen}
        title="Purge Profile Cookies"
        message="Are you sure you want to delete all cookies from this profile? All logged-in sessions will be terminated."
        confirmLabel="Purge All"
        isDestructive
        onConfirm={handleClearAll}
        onCancel={() => setIsClearConfirmOpen(false)}
      />
    </div>
  );
};
