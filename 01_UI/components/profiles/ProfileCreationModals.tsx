import type React from 'react';
import { useState, memo } from 'react';
import { Play, Layers } from 'lucide-react';
import type { ProxyItem } from '../../../10_CONFIG/shared/types/proxy.js';

export interface QuickCreateModalProps {
  defaultName: string;
  proxies: ProxyItem[];
  isCreating: boolean;
  onClose: () => void;
  onSubmit: (
    data: { name: string; folder: string; proxyId: string; notes: string },
    runImmediately: boolean
  ) => Promise<void>;
}

export const QuickCreateModal: React.FC<QuickCreateModalProps> = memo(({
  defaultName,
  proxies,
  isCreating,
  onClose,
  onSubmit,
}) => {
  const [quickName, setQuickName] = useState(defaultName);
  const [quickFolder, setQuickFolder] = useState('General');
  const [quickProxyId, setQuickProxyId] = useState('');
  const [quickNotes, setQuickNotes] = useState('');

  const submitForm = async (e: React.FormEvent, runImmediately: boolean) => {
    e.preventDefault();
    if (!quickName.trim()) return;
    await onSubmit(
      {
        name: quickName.trim(),
        folder: quickFolder.trim() || 'General',
        proxyId: quickProxyId,
        notes: quickNotes.trim(),
      },
      runImmediately
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
              +
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Quick Create Profile</h3>
              <p className="text-[11px] text-slate-400">Ready in 1 second</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200 text-sm font-bold">
            ✕
          </button>
        </div>

        <form onSubmit={(e) => submitForm(e, false)} className="p-6 space-y-4 text-xs">
          <div>
            <label htmlFor="field-001" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Profile Name *</label>
            <input
              type="text"
              required
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
              placeholder="e.g. Profile 1"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:border-teal-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="field-002" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Folder / Workspace</label>
              <input
                type="text"
                value={quickFolder}
                onChange={(e) => setQuickFolder(e.target.value)}
                placeholder="General"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="field-003" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Proxy Configuration</label>
              <select
                value={quickProxyId}
                onChange={(e) => setQuickProxyId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:border-teal-500 focus:outline-none"
              >
                <option value="">Direct Connection (No Proxy)</option>
                {proxies.map((px) => (
                  <option key={px.id} value={px.id}>
                    {px.name} ({px.host}:{px.port})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="field-004" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Notes / Account Info</label>
            <input
              type="text"
              value={quickNotes}
              onChange={(e) => setQuickNotes(e.target.value)}
              placeholder="e.g. user@domain.com or purpose"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono focus:border-teal-500 focus:outline-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-slate-200 font-semibold">
              Cancel
            </button>

            <button
              type="submit"
              disabled={isCreating}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 active:scale-95 transition-all interactive-control"
            >
              {isCreating ? 'Creating...' : 'Create Profile'}
            </button>

            <button
              type="button"
              onClick={(e) => submitForm(e, true)}
              disabled={isCreating}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center space-x-1.5 interactive-control"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Create &amp; Run</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

export interface BulkCreateModalProps {
  proxies: ProxyItem[];
  isBulking: boolean;
  onClose: () => void;
  onSubmit: (data: {
    count: number;
    namePrefix: string;
    folder: string;
    osType: 'random' | 'windows' | 'mac';
    proxyId?: string;
  }) => Promise<void>;
}

export const BulkCreateModal: React.FC<BulkCreateModalProps> = memo(({
  proxies,
  isBulking,
  onClose,
  onSubmit,
}) => {
  const [bulkCount, setBulkCount] = useState(5);
  const [bulkPrefix, setBulkPrefix] = useState('Profile');
  const [bulkFolder, setBulkFolder] = useState('General');
  const [bulkOs, setBulkOs] = useState<'random' | 'windows' | 'mac'>('random');
  const [bulkProxyId, setBulkProxyId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkCount < 1) return;
    await onSubmit({
      count: bulkCount,
      namePrefix: bulkPrefix.trim() || 'Profile',
      folder: bulkFolder.trim() || 'General',
      osType: bulkOs,
      proxyId: bulkProxyId || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Bulk Profile Generator</h3>
              <p className="text-[11px] text-slate-400">Create multiple profiles with 1 click</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200 text-sm font-bold">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label htmlFor="field-005" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              How Many Profiles? ({bulkCount})
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="range"
                min={1}
                max={50}
                value={bulkCount}
                onChange={(e) => setBulkCount(parseInt(e.target.value, 10))}
                className="flex-1 accent-indigo-600"
              />
              <input
                type="number"
                min={1}
                max={100}
                value={bulkCount}
                onChange={(e) => setBulkCount(Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1)))}
                className="w-16 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-center font-bold font-mono text-xs"
              />
            </div>
            <div className="flex space-x-1.5 pt-2">
              {[5, 10, 20, 50].map((num) => (
                <button type="button"
                  key={num}
                  onClick={() => setBulkCount(num)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    bulkCount === num
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-200'
                  }`}
                >
                  +{num}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="field-006" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Name Prefix</label>
              <input
                type="text"
                value={bulkPrefix}
                onChange={(e) => setBulkPrefix(e.target.value)}
                placeholder="Profile"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="field-007" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Folder</label>
              <input
                type="text"
                value={bulkFolder}
                onChange={(e) => setBulkFolder(e.target.value)}
                placeholder="General"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="field-008" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">OS Personas</label>
              <select
                value={bulkOs}
                onChange={(e) => setBulkOs(e.target.value as 'random' | 'windows' | 'mac')}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:border-indigo-500 focus:outline-none"
              >
                <option value="random">Random Authentic (Mixed)</option>
                <option value="windows">Windows 10 / 11</option>
                <option value="mac">macOS (Apple M-Series)</option>
              </select>
            </div>

            <div>
              <label htmlFor="field-009" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Proxy (Optional)</label>
              <select
                value={bulkProxyId}
                onChange={(e) => setBulkProxyId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:border-indigo-500 focus:outline-none"
              >
                <option value="">No Proxy (Direct)</option>
                {proxies.map((px) => (
                  <option key={px.id} value={px.id}>
                    {px.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-slate-200 font-semibold">
              Cancel
            </button>

            <button
              type="submit"
              disabled={isBulking}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 active:scale-95 transition-all flex items-center space-x-1.5"
            >
              <Layers className={`w-4 h-4 ${isBulking ? 'animate-spin' : ''}`} />
              <span>{isBulking ? 'Generating...' : `Generate ${bulkCount} Profiles`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});
