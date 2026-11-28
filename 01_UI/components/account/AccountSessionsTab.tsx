import type React from 'react';
import { Laptop, Trash2 } from 'lucide-react';
import type { AccountActiveSessionRecord } from '../../../10_CONFIG/shared/types/commercial.js';

interface AccountSessionsTabProps {
  activeSessions: AccountActiveSessionRecord[];
  onRevokeSession: (sessionId: string) => void;
  onRevokeAllSessions: () => void;
}

export const AccountSessionsTab: React.FC<AccountSessionsTabProps> = ({
  activeSessions,
  onRevokeSession,
  onRevokeAllSessions,
}) => {
  return (
    <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
          <Laptop size={14} className="text-teal-400" />
          <span>ACTIVE DEVICES & SESSIONS</span>
        </div>
        {activeSessions && activeSessions.length > 1 && (
          <button
            type="button"
            onClick={onRevokeAllSessions}
            className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold"
          >
            Log out other devices
          </button>
        )}
      </div>

      {activeSessions && activeSessions.length > 0 ? (
        <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
          {activeSessions.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs"
            >
              <div className="flex items-center gap-2">
                <Laptop size={14} className="text-slate-400" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-white">{s.device_name || 'Windows Desktop'}</span>
                    {s.is_current && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Current
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {s.platform || 'windows'} • {s.last_used_at ? new Date(s.last_used_at).toLocaleDateString() : 'Active'}
                  </span>
                </div>
              </div>

              {!s.is_current && (
                <button
                  type="button"
                  onClick={() => onRevokeSession(s.id)}
                  className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
                  title="Revoke session"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-slate-400">Current device session is active.</p>
      )}
    </div>
  );
};
