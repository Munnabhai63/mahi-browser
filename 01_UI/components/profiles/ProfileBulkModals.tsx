import type React from 'react';
import { useState, memo } from 'react';
import { Play, Globe2, Tag } from 'lucide-react';
import type { ProxyItem } from '../../../10_CONFIG/shared/types/proxy.js';

export interface StaggerLaunchModalProps {
  selectedCount: number;
  isLaunching: boolean;
  progress: { completed: number; total: number; profileId: string; pid?: number; error?: string } | null;
  onClose: () => void;
  onLaunch: (delayMs: number) => Promise<void>;
}

export const StaggerLaunchModal: React.FC<StaggerLaunchModalProps> = memo(({
  selectedCount,
  isLaunching,
  progress,
  onClose,
  onLaunch,
}) => {
  const [staggerDelayMs, setStaggerDelayMs] = useState(1500);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                <Play className="w-5 h-5 fill-current" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  🚀 Launch {selectedCount} Profiles
                </h3>
                <p className="text-xs text-slate-400">Sequential launch with CPU spike protection</p>
              </div>
            </div>
            {!isLaunching && (
              <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200 text-sm font-bold p-1.5">
                ✕
              </button>
            )}
          </div>

          {isLaunching && progress ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-teal-500/10 text-teal-500 flex items-center justify-center animate-pulse">
                <Play className="w-8 h-8 fill-current" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Launching profile {progress.completed} of {progress.total}...
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {progress.pid ? `PID: ${progress.pid}` : 'Opening browser window...'}
                </div>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-teal-500 to-emerald-500 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${Math.round((progress.completed / progress.total) * 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="py-5 space-y-4">
              <div>
                <label htmlFor="field-001" className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Stagger Delay (Time between each window)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: '500ms (Fast)', value: 500 },
                    { label: '1.5s (Safe)', value: 1500 },
                    { label: '2.5s (Heavy)', value: 2500 },
                    { label: '4.0s (Light PC)', value: 4000 },
                  ].map((item) => (
                    <button type="button"
                      key={item.value}
                      onClick={() => setStaggerDelayMs(item.value)}
                      className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all ${
                        staggerDelayMs === item.value
                          ? 'border-teal-500 bg-teal-500/10 text-teal-600 dark:text-teal-400 border-2'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs text-slate-500 space-y-1">
                <div className="font-semibold text-slate-700 dark:text-slate-300">💡 CPU Protection Active:</div>
                <p>Opening windows sequentially prevents sudden 100% CPU freezes and Chromium crash locks.</p>
              </div>
            </div>
          )}

          {!isLaunching && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3">
              <button type="button" onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-slate-200 font-semibold text-xs">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onLaunch(staggerDelayMs)}
                className="px-5 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-teal-600/20 active:scale-95 transition-all flex items-center space-x-2"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Launch {selectedCount} Profiles Now</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export interface BulkProxyModalProps {
  selectedCount: number;
  proxies: ProxyItem[];
  isSaving: boolean;
  onClose: () => void;
  onApply: (data: {
    mode: 'single' | 'round-robin' | 'clear';
    selectedProxyIds: string[];
    rawInput: string;
  }) => Promise<void>;
}

export const BulkProxyModal: React.FC<BulkProxyModalProps> = memo(({
  selectedCount,
  proxies,
  isSaving,
  onClose,
  onApply,
}) => {
  const [bulkProxyMode, setBulkProxyMode] = useState<'single' | 'round-robin' | 'clear'>('single');
  const [selectedBulkProxyIds, setSelectedBulkProxyIds] = useState<string[]>([]);
  const [rawBulkProxyInput, setRawBulkProxyInput] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                <Globe2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Assign Proxy to {selectedCount} Profiles
                </h3>
                <p className="text-xs text-slate-400">Single proxy, Round-Robin distribution, or direct</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200 text-sm font-bold p-1.5">
              ✕
            </button>
          </div>

          <div className="py-4 space-y-4">
            <div>
              <label htmlFor="field-002" className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Distribution Mode
              </label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: 'single', label: '1 Proxy to All', desc: 'Same proxy for all' },
                  { id: 'round-robin', label: 'Round-Robin', desc: 'Distribute proxy list' },
                  { id: 'clear', label: 'Direct Connection', desc: 'Remove proxy' },
                ] as const).map((m) => (
                  <button type="button"
                    key={m.id}
                    onClick={() => setBulkProxyMode(m.id)}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                      bulkProxyMode === m.id
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-2 font-bold'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-500'
                    }`}
                  >
                    <div className="font-bold">{m.label}</div>
                    <div className="text-[10px] text-slate-400 font-normal">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {bulkProxyMode !== 'clear' && (
              <>
                {proxies.length > 0 && (
                  <div>
                    <label htmlFor="field-003" className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Select from Saved Proxies ({proxies.length} available)
                    </label>
                    <select
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 font-medium"
                      onChange={(e) => {
                        if (e.target.value) {
                          if (bulkProxyMode === 'single') {
                            setSelectedBulkProxyIds([e.target.value]);
                          } else if (!selectedBulkProxyIds.includes(e.target.value)) {
                            setSelectedBulkProxyIds([...selectedBulkProxyIds, e.target.value]);
                          }
                        }
                      }}
                    >
                      <option value="">-- Choose saved proxy --</option>
                      {proxies.map((px) => (
                        <option key={px.id} value={px.id}>
                          {px.name} ({px.host}:{px.port}) [{px.protocol.toUpperCase()}]
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label htmlFor="field-004" className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Or Paste Proxies (1 per line, format: host:port or host:port:user:pass)
                  </label>
                  <textarea
                    rows={3}
                    value={rawBulkProxyInput}
                    onChange={(e) => setRawBulkProxyInput(e.target.value)}
                    placeholder={'185.199.229.156:50100:user:pass\n192.168.1.1:8080'}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-slate-200 font-semibold text-xs">
              Cancel
            </button>
            <button
              type="button"
              onClick={() =>
                onApply({
                  mode: bulkProxyMode,
                  selectedProxyIds: selectedBulkProxyIds,
                  rawInput: rawBulkProxyInput,
                })
              }
              disabled={isSaving}
              className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-600/20 active:scale-95 transition-all flex items-center space-x-2"
            >
              <Globe2 className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Assigning...' : `Apply to ${selectedCount} Profiles`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export interface BulkEditModalProps {
  selectedCount: number;
  isSaving: boolean;
  onClose: () => void;
  onSave: (data: { folder: string; addTags: string; removeTags: string }) => Promise<void>;
}

export const BulkEditModal: React.FC<BulkEditModalProps> = memo(({
  selectedCount,
  isSaving,
  onClose,
  onSave,
}) => {
  const [bulkEditFolder, setBulkEditFolder] = useState('');
  const [bulkEditAddTags, setBulkEditAddTags] = useState('');
  const [bulkEditRemoveTags, setBulkEditRemoveTags] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Bulk Edit ({selectedCount} Profiles)
                </h3>
                <p className="text-xs text-slate-400">Batch update folder and tags</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200 text-sm font-bold p-1.5">
              ✕
            </button>
          </div>

          <div className="py-4 space-y-3.5">
            <div>
              <label htmlFor="field-005" className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Set Folder (Move profiles)
              </label>
              <input
                type="text"
                value={bulkEditFolder}
                onChange={(e) => setBulkEditFolder(e.target.value)}
                placeholder="e.g. Farming, Facebook Ads, Crypto"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-purple-500 font-semibold"
              />
            </div>

            <div>
              <label htmlFor="field-006" className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Add Tags (Comma separated)
              </label>
              <input
                type="text"
                value={bulkEditAddTags}
                onChange={(e) => setBulkEditAddTags(e.target.value)}
                placeholder="e.g. Warmed, Active, Verified"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-purple-500 font-semibold"
              />
            </div>

            <div>
              <label htmlFor="field-007" className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Remove Tags (Comma separated)
              </label>
              <input
                type="text"
                value={bulkEditRemoveTags}
                onChange={(e) => setBulkEditRemoveTags(e.target.value)}
                placeholder="e.g. Fresh, Unused"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-rose-500 font-semibold"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-slate-200 font-semibold text-xs">
              Cancel
            </button>
            <button
              type="button"
              onClick={() =>
                onSave({
                  folder: bulkEditFolder,
                  addTags: bulkEditAddTags,
                  removeTags: bulkEditRemoveTags,
                })
              }
              disabled={isSaving}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/20 active:scale-95 transition-all flex items-center space-x-2"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
