import type React from 'react';
import { AlertTriangle, Laptop, X } from 'lucide-react';

interface DeviceLaunchModalProps {
  isOpen: boolean;
  profileName: string;
  onClose: () => void;
  onNavigateToDevices?: () => void;
}

export const DeviceLaunchModal: React.FC<DeviceLaunchModalProps> = ({
  isOpen,
  profileName,
  onClose,
  onNavigateToDevices,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Laptop className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Desktop Device Required</h3>
              <p className="text-xs text-slate-400">Honest Execution Notice</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center space-x-2 text-xs font-semibold text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Cannot launch profile "{profileName}" remotely without active desktop agent</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            The MAHI Browser Web Dashboard is a management & coordination interface. It does <strong className="text-slate-200">not</strong> stream remote browser windows (Cloud Browser streaming is scheduled for Phase 10).
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            To launch and run this anti-detect browser session with native fingerprint emulation, your registered <strong className="text-slate-200">MAHI Browser desktop client</strong> must be running on your computer and signed in with this account.
          </p>
        </div>

        <div className="space-y-2 text-xs text-slate-300">
          <div className="font-semibold text-slate-200">Next Steps:</div>
          <ul className="list-disc list-inside space-y-1 text-slate-400 text-xs">
            <li>Ensure MAHI Browser desktop client is open on Windows</li>
            <li>Verify you are signed in under the same account</li>
            <li>Alternatively, view and manage your registered sessions in Device Settings</li>
          </ul>
        </div>

        <div className="flex items-center justify-end space-x-3 pt-2">
          {onNavigateToDevices && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateToDevices();
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors"
            >
              Check Active Devices
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-teal-600/20 transition-all"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};
