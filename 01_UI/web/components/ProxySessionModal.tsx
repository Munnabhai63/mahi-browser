import type React from 'react';
import { useState } from 'react';
import { Shield, Globe, Clock, X } from 'lucide-react';

interface ProxySessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (dto: {
    networkType: string;
    country: string;
    sessionType: 'STICKY' | 'ROTATING';
    ttlMinutes?: number;
  }) => Promise<void>;
}

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'CA', name: 'Canada' },
  { code: 'JP', name: 'Japan' },
  { code: 'AU', name: 'Australia' },
  { code: 'SG', name: 'Singapore' },
  { code: 'IN', name: 'India' },
  { code: 'BR', name: 'Brazil' },
];

export const ProxySessionModal: React.FC<ProxySessionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [networkType, setNetworkType] = useState('RESIDENTIAL');
  const [country, setCountry] = useState('US');
  const [sessionType, setSessionType] = useState<'STICKY' | 'ROTATING'>('STICKY');
  const [ttlMinutes, setTtlMinutes] = useState(30);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        networkType,
        country,
        sessionType,
        ttlMinutes: sessionType === 'STICKY' ? ttlMinutes : undefined,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate proxy session');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Generate Proxy Session</h3>
              <p className="text-xs text-slate-400">Allocate from built-in commercial catalog</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="proxy-modal-country" className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <span>Target Country</span>
            </label>
            <select
              id="proxy-modal-country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-teal-500/50"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-semibold text-slate-300">Network Tier</span>
            <div className="grid grid-cols-3 gap-2">
              {['RESIDENTIAL', 'DATACENTER', 'MOBILE'].map((tier) => (
                <button
                  type="button"
                  key={tier}
                  onClick={() => setNetworkType(tier)}
                  className={`py-2 px-2 text-center text-xs font-semibold rounded-xl border transition-all ${
                    networkType === tier
                      ? 'bg-teal-500/10 border-teal-500/40 text-teal-300 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-semibold text-slate-300">Session Mode</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSessionType('STICKY')}
                className={`py-2 px-3 text-left text-xs rounded-xl border transition-all ${
                  sessionType === 'STICKY'
                    ? 'bg-teal-500/10 border-teal-500/40 text-teal-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                }`}
              >
                <div className="font-bold">STICKY IP</div>
                <div className="text-[10px] text-slate-400">Fixed IP for persistence</div>
              </button>

              <button
                type="button"
                onClick={() => setSessionType('ROTATING')}
                className={`py-2 px-3 text-left text-xs rounded-xl border transition-all ${
                  sessionType === 'ROTATING'
                    ? 'bg-teal-500/10 border-teal-500/40 text-teal-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                }`}
              >
                <div className="font-bold">ROTATING IP</div>
                <div className="text-[10px] text-slate-400">Rotates per request/TTL</div>
              </button>
            </div>
          </div>

          {sessionType === 'STICKY' && (
            <div className="space-y-1.5">
              <label htmlFor="proxy-modal-ttl" className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Session Duration (TTL Minutes)</span>
              </label>
              <select
                id="proxy-modal-ttl"
                value={ttlMinutes}
                onChange={(e) => setTtlMinutes(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-teal-500/50"
              >
                <option value={10}>10 minutes</option>
                <option value={30}>30 minutes (Standard)</option>
                <option value={60}>60 minutes (1 Hour)</option>
                <option value={120}>120 minutes (2 Hours)</option>
              </select>
            </div>
          )}

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px] text-slate-400">
            Sessions are managed securely via reference tokens. Master provider credentials are never transmitted to client browsers.
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
              <span>Allocate Session</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
