import type React from 'react';
import { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Upload,
  Shield,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { useToastStore } from '../stores/useToastStore.js';
import { useProfileStore } from '../stores/useProfileStore.js';
import type { ParsedAccountImportItem } from '../../10_CONFIG/shared/types/profile.js';

type ParsedAccountItem = ParsedAccountImportItem;

interface UniversalBulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UniversalBulkImportModal: React.FC<UniversalBulkImportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { showToast } = useToastStore();
  const { fetchProfiles } = useProfileStore();

  const [rawText, setRawText] = useState('');
  const [parsedItems, setParsedItems] = useState<ParsedAccountItem[]>([]);
  const [folder, setFolder] = useState('General');
  const [targetOs, setTargetOs] = useState<'windows' | 'macos' | 'linux'>('windows');
  const [browserEngine, setBrowserEngine] = useState<'chrome' | 'edge' | 'chromium' | 'camoufox'>('chrome');
  const [customTag, setCustomTag] = useState('Bulk-Import');
  const [isImporting, setIsImporting] = useState(false);
  const [_importProgress, setImportProgress] = useState(0);

  // Live Auto-Parser on text input
  useEffect(() => {
    if (!rawText.trim()) {
      setParsedItems([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        if (window.mahiAPI) {
          const items = await window.mahiAPI.importerParsePreview(rawText);
          setParsedItems(items || []);
        }
      } catch (err) {
        console.debug('[UniversalBulkImportModal] import preview parse failed', err);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [rawText]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) setRawText(content);
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (parsedItems.length === 0) {
      showToast({
        type: 'warning',
        title: 'No Accounts Parsed',
        message: 'Please paste or upload valid account data first.',
      });
      return;
    }

    setIsImporting(true);
    setImportProgress(10);

    try {
      if (window.mahiAPI) {
        setImportProgress(40);
        const res = await window.mahiAPI.importerExecuteBulkImport(parsedItems, {
          folder,
          os: targetOs,
          browserEngine,
          tags: customTag ? [customTag] : ['Imported'],
        });

        setImportProgress(100);

        if (res.success) {
          showToast({
            type: 'success',
            title: '🎉 Bulk Import Completed!',
            message: `Successfully imported ${res.totalImported} profiles with stealth fingerprints & proxies in ${Math.round(res.durationMs)}ms!`,
          });
          await fetchProfiles();
          onClose();
        } else {
          showToast({
            type: 'error',
            title: 'Import Partial / Failed',
            message: res.errors?.[0] || 'Some profiles could not be imported.',
          });
        }
      }
    } catch (err: unknown) {
      showToast({
        type: 'error',
        title: 'Import Error',
        message: err instanceof Error ? err.message : 'Bulk import process failed',
      });
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-teal-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                Universal Multi-Account Bulk Importer
              </h2>
              <p className="text-xs text-slate-400">
                Paste or drop accounts in Delimited (colon/pipe), CSV, Netscape, or JSON format
              </p>
            </div>
          </div>
          <button type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {/* Format Helper Pills */}
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="text-slate-400 font-bold self-center mr-1">Formats:</span>
            <button
              type="button"
              onClick={() =>
                setRawText(
                  `acc1@gmail.com:pass123:157.240.1.1:8080:user:pass\nacc2@gmail.com:pass456:157.240.1.2:8080:user:pass\nacc3@gmail.com:pass789:157.240.1.3:8080`
                )
              }
              className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg font-mono text-[10px]"
            >
              Colon (email:pass:proxy:port:user:pass)
            </button>
            <button
              type="button"
              onClick={() =>
                setRawText(
                  `name,proxy,user_agent,notes\nFacebook-Acc-1,http://157.240.1.1:8080:usr:pwd,,Warmed FB Account\nGoogle-Acc-2,socks5://157.240.1.2:1080,,Google Search Account`
                )
              }
              className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg font-mono text-[10px]"
            >
              CSV Header Format
            </button>
            <button
              type="button"
              onClick={() =>
                setRawText(
                  JSON.stringify(
                    {
                      profiles: [
                        {
                          name: 'GoLogin Profile 1',
                          navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/158.0.0.0 Safari/537.36', language: 'en-US', resolution: '1920x1080' },
                          proxy: { mode: 'socks5', host: '157.240.1.10', port: 1080, username: 'usr', password: 'pwd' },
                          timezone: { id: 'America/New_York' },
                        },
                      ],
                    },
                    null,
                    2
                  )
                )
              }
              className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg font-mono text-[10px]"
            >
              GoLogin / AdsPower / Dolphin JSON
            </button>
          </div>

          {/* Text Input Area */}
          <div className="relative">
            <textarea
              rows={6}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste raw account lines here...&#10;Example 1: user1@gmail.com:SecretPass:142.250.1.1:8080:proxyuser:proxypass&#10;Example 2: ProfileName:157.240.1.1:8080"
              className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none resize-none leading-relaxed"
            />
            <div className="absolute right-3 bottom-3 flex items-center space-x-2">
              <label htmlFor="field-001" className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer shadow-sm flex items-center space-x-1.5">
                <FileText className="w-3.5 h-3.5 text-teal-500" />
                <span>Upload .txt / .csv / .json</span>
                <input
                  type="file"
                  accept=".txt,.csv,.json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Live Parser Preview Box */}
          {parsedItems.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-teal-500" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    Live Parsed Preview ({parsedItems.length} Accounts Detected)
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-500">
                  Ready to Import
                </span>
              </div>

              <div className="max-h-44 overflow-y-auto space-y-1.5 custom-scrollbar text-xs">
                {parsedItems.map((item, idx) => (
                  <div
                    key={`${item.name}-${item.usernameOrEmail ?? ''}-${item.proxy?.host ?? 'direct'}-${item.proxy?.port ?? 0}`}
                    className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold flex items-center justify-center text-slate-400 shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                        {item.name}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      {item.proxy ? (
                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-500 font-mono text-[10px] flex items-center space-x-1">
                          <Shield className="w-3 h-3" />
                          <span>
                            {item.proxy.host}:{item.proxy.port}
                          </span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px]">
                          Direct Network
                        </span>
                      )}

                      {item.cookies && item.cookies.length > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 font-bold text-[10px] flex items-center space-x-1">
                          <span>🍪 {item.cookies.length} Cookies</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Import Configuration Settings */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div>
              <label htmlFor="field-002" className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Assign Folder
              </label>
              <input
                type="text"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-medium"
              />
            </div>

            <div>
              <label htmlFor="field-003" className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Fingerprint OS
              </label>
              <select
                value={targetOs}
                onChange={(e) => setTargetOs(e.target.value as 'windows' | 'macos' | 'linux')}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-medium"
              >
                <option value="windows">Windows 11 / 10</option>
                <option value="macos">macOS (Apple Silicon)</option>
                <option value="linux">Linux (Ubuntu/Debian)</option>
              </select>
            </div>

            <div>
              <label htmlFor="field-004" className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Browser Engine
              </label>
              <select
                value={browserEngine}
                onChange={(e) => setBrowserEngine(e.target.value as 'chrome' | 'edge' | 'chromium' | 'camoufox')}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-medium"
              >
                <option value="chrome">Google Chrome</option>
                <option value="edge">Microsoft Edge</option>
                <option value="chromium">Chromium 138 (Stealth)</option>
                <option value="camoufox">Camoufox (Patched Firefox)</option>
              </select>
            </div>

            <div>
              <label htmlFor="field-005" className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Custom Tag
              </label>
              <input
                type="text"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-medium"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleExecuteImport}
            disabled={parsedItems.length === 0 || isImporting}
            className="px-6 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-teal-500/25 active:scale-95 transition-all flex items-center space-x-2 text-xs"
          >
            <span>
              {isImporting
                ? 'Importing Profiles...'
                : `Import All (${parsedItems.length} Profiles)`}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
