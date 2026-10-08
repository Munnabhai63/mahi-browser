import React, { useState } from 'react';
import { Webhook, Copy, Check, AlertTriangle, X, ShieldCheck } from 'lucide-react';
import { CreateWebhookEndpointDTO } from '../../../10_CONFIG/shared/types/remote-api.js';

interface CreateWebhookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (dto: CreateWebhookEndpointDTO) => Promise<{ secret: string; url: string }>;
}

const AVAILABLE_EVENTS = [
  { id: 'profile.created', label: 'profile.created', desc: 'Fires when a browser profile is initialized' },
  { id: 'profile.updated', label: 'profile.updated', desc: 'Fires on metadata, folder, or config modification' },
  { id: 'profile.deleted', label: 'profile.deleted', desc: 'Fires when a profile is permanently destroyed' },
  { id: 'sync.completed', label: 'sync.completed', desc: 'Fires on zero-knowledge cloud state synchronization' },
  { id: 'workspace.member_invited', label: 'workspace.member_invited', desc: 'Fires when a user receives a team invitation' },
  { id: 'proxy.session_created', label: 'proxy.session_created', desc: 'Fires when a commercial proxy session is allocated' },
];

export const CreateWebhookModal: React.FC<CreateWebhookModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    'profile.created',
    'sync.completed',
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One-time secret state
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleToggleEvent = (eventId: string) => {
    if (selectedEvents.includes(eventId)) {
      setSelectedEvents(selectedEvents.filter((e) => e !== eventId));
    } else {
      setSelectedEvents([...selectedEvents, eventId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      setError('Webhook target URL is required');
      return;
    }
    if (!cleanUrl.startsWith('https://') && !cleanUrl.startsWith('http://localhost')) {
      setError('Production webhook URLs must use secure HTTPS protocol');
      return;
    }
    if (selectedEvents.length === 0) {
      setError('Select at least one event subscription');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await onSubmit({
        url: cleanUrl,
        events: selectedEvents as any,
        description: description.trim() || undefined,
      });
      setRevealedSecret(result.secret);
    } catch (err: any) {
      setError(err.message || 'Failed to create webhook endpoint');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = () => {
    if (revealedSecret) {
      navigator.clipboard.writeText(revealedSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDone = () => {
    setRevealedSecret(null);
    setUrl('');
    setDescription('');
    setSelectedEvents(['profile.created', 'sync.completed']);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-6">
        {revealedSecret ? (
          // One-Time Secret Reveal View
          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Webhook Endpoint Registered</h3>
                <p className="text-xs text-amber-400 font-semibold">Copy your signing secret immediately</p>
              </div>
            </div>

            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
              <div className="flex items-center space-x-2 text-xs font-bold text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>HMAC Signature Verification Secret</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                MAHI Cloud sends signed HTTP POST requests with header <code className="text-teal-300">X-Mahi-Signature</code>. Use this secret with HMAC-SHA256 to verify webhook payloads. It will not be shown again in plaintext.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Signing Secret</label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={revealedSecret}
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
                I have saved my signing secret
              </button>
            </div>
          </div>
        ) : (
          // Registration Form View
          <div>
            <div className="flex items-start justify-between pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center">
                  <Webhook className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Add Webhook Endpoint</h3>
                  <p className="text-xs text-slate-400">Receive real-time event notifications via signed HTTP POST</p>
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
                <label className="text-xs font-semibold text-slate-300">Endpoint URL *</label>
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://api.yourcompany.com/webhooks/mahi"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500/50"
                />
                <p className="text-[11px] text-slate-400">Must be a publicly accessible HTTPS endpoint (SSRF protected).</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Description (Optional)</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Production Slack Alert Integration"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500/50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Subscribed Events</span>
                  <span className="text-[11px] text-teal-400">{selectedEvents.length} selected</span>
                </label>
                <div className="max-h-44 overflow-y-auto p-2 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5 custom-scrollbar">
                  {AVAILABLE_EVENTS.map((event) => {
                    const isChecked = selectedEvents.includes(event.id);
                    return (
                      <label
                        key={event.id}
                        className={`flex items-start space-x-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                          isChecked ? 'bg-teal-500/10 border border-teal-500/20' : 'hover:bg-slate-900 border border-transparent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleEvent(event.id)}
                          className="mt-0.5 rounded border-slate-700 text-teal-500 focus:ring-teal-500/20"
                        />
                        <div>
                          <div className="text-xs font-mono font-semibold text-slate-200">{event.label}</div>
                          <div className="text-[10px] text-slate-400">{event.desc}</div>
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
                  <span>Register Webhook</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
