import React, { useState } from 'react';
import { Key, Copy, Check, AlertTriangle, Shield, X, Eye } from 'lucide-react';
import { CreateRemoteApiKeyDTO } from '../../../10_CONFIG/shared/types/remote-api.js';
import { TeamWorkspace } from '../../../10_CONFIG/shared/types/workspace.js';

interface CreateApiKeyModalProps {
  isOpen: boolean;
  workspaces: TeamWorkspace[];
  onClose: () => void;
  onSubmit: (dto: CreateRemoteApiKeyDTO) => Promise<{ secretKey: string; note: string }>;
}

const AVAILABLE_SCOPES = [
  { id: 'profiles:read', label: 'profiles:read', desc: 'List and inspect cloud profiles' },
  { id: 'profiles:write', label: 'profiles:write', desc: 'Create, edit, and delete profiles' },
  { id: 'profiles:run', label: 'profiles:run', desc: 'Trigger profile execution on registered devices' },
  { id: 'proxy:read', label: 'proxy:read', desc: 'Inspect catalog and proxy assignments' },
  { id: 'proxy:create', label: 'proxy:create', desc: 'Generate and rotate proxy provider sessions' },
  { id: 'workspace:read', label: 'workspace:read', desc: 'List workspaces, members, and shared profiles' },
  { id: 'workspace:manage', label: 'workspace:manage', desc: 'Manage workspaces, roles, and member invitations' },
  { id: 'webhooks:read', label: 'webhooks:read', desc: 'View webhook endpoints and delivery audits' },
  { id: 'webhooks:manage', label: 'webhooks:manage', desc: 'Register endpoints, rotate secrets, and trigger tests' },
  { id: 'sync:read', label: 'sync:read', desc: 'Read zero-knowledge cloud sync state' },
  { id: 'sync:write', label: 'sync:write', desc: 'Push encrypted state blobs' },
];

export const CreateApiKeyModal: React.FC<CreateApiKeyModalProps> = ({
  isOpen,
  workspaces,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [workspaceId, setWorkspaceId] = useState<string>('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    'profiles:read',
    'profiles:write',
    'profiles:run',
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One-time secret state
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleToggleScope = (scopeId: string) => {
    if (selectedScopes.includes(scopeId)) {
      setSelectedScopes(selectedScopes.filter((s) => s !== scopeId));
    } else {
      setSelectedScopes([...selectedScopes, scopeId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Key name/identifier is required');
      return;
    }
    if (selectedScopes.length === 0) {
      setError('Please select at least one permission scope');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await onSubmit({
        name: name.trim(),
        scopes: selectedScopes as any,
        workspaceId: workspaceId || undefined,
      });
      setRevealedKey(result.secretKey);
    } catch (err: any) {
      setError(err.message || 'Failed to create API key');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = () => {
    if (revealedKey) {
      navigator.clipboard.writeText(revealedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDone = () => {
    setRevealedKey(null);
    setName('');
    setWorkspaceId('');
    setSelectedScopes(['profiles:read', 'profiles:write', 'profiles:run']);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-6">
        {revealedKey ? (
          // One-Time Plaintext Key Reveal View
          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">API Key Created Successfully</h3>
                <p className="text-xs text-amber-400 font-semibold">Copy this secret key immediately</p>
              </div>
            </div>

            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
              <div className="flex items-center space-x-2 text-xs font-bold text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>One-Time Display Security Policy</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                For cryptographic security, MAHI Cloud only hashes your key with SHA-256 at rest. This plaintext secret <strong className="text-white">will never be shown again</strong>. If you lose this key, you must rotate or create a new one.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Secret API Key</label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={revealedKey}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-teal-500/40 rounded-xl text-xs font-mono text-teal-300 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-teal-600/20 flex items-center space-x-1.5 shrink-0"
                >
                  {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleDone}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold rounded-xl"
              >
                I have saved my key
              </button>
            </div>
          </div>
        ) : (
          // Form View
          <div>
            <div className="flex items-start justify-between pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Create Remote API Key</h3>
                  <p className="text-xs text-slate-400">Generate programmatic credentials for cloud automation</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 mb-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Key Name / Description *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. CI/CD Pipeline Automation Key"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Workspace Context (Optional)</label>
                <select
                  value={workspaceId}
                  onChange={(e) => setWorkspaceId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-teal-500/50"
                >
                  <option value="">Personal Scope (User-level resources)</option>
                  {workspaces.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.id})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400">Restricting to a workspace ensures cross-workspace isolation.</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Permission Scopes</span>
                  <span className="text-[11px] text-teal-400">{selectedScopes.length} selected</span>
                </label>
                <div className="max-h-48 overflow-y-auto p-2 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5 custom-scrollbar">
                  {AVAILABLE_SCOPES.map((scope) => {
                    const isChecked = selectedScopes.includes(scope.id);
                    return (
                      <label
                        key={scope.id}
                        className={`flex items-start space-x-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                          isChecked ? 'bg-teal-500/10 border border-teal-500/20' : 'hover:bg-slate-900 border border-transparent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleScope(scope.id)}
                          className="mt-0.5 rounded border-slate-700 text-teal-500 focus:ring-teal-500/20"
                        />
                        <div>
                          <div className="text-xs font-mono font-semibold text-slate-200">{scope.label}</div>
                          <div className="text-[10px] text-slate-400">{scope.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-teal-600/20 flex items-center space-x-2"
                >
                  {isSubmitting && (
                    <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                  )}
                  <span>Generate Key</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
