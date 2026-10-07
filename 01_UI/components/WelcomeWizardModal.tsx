import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Sparkles, 
  Layers, 
  Smartphone, 
  Zap, 
  ArrowRight, 
  CheckCircle2, 
  Download, 
  Globe, 
  Monitor, 
  Apple, 
  Terminal, 
  X,
  Bot
} from 'lucide-react';
import { useProfileStore } from '../stores/useProfileStore.js';
import { useToastStore } from '../stores/useToastStore.js';
import { getDefaultProfileSettings, DEFAULT_USER_AGENTS } from '../../10_CONFIG/shared/constants/defaults.js';
import { NavigationPage } from './Sidebar.js';

interface WelcomeWizardModalProps {
  onNavigate: (page: NavigationPage) => void;
}

export const WelcomeWizardModal: React.FC<WelcomeWizardModalProps> = ({ onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedOS, setSelectedOS] = useState<'windows' | 'mac' | 'linux'>('windows');
  const [isCreating, setIsCreating] = useState(false);

  const { profiles, createProfile } = useProfileStore();

  useEffect(() => {
    // Disabled auto-popup to allow direct access to main UI on fresh install
    // User lands directly on ProfilesList with 0 blocking gates
  }, []);

  const handleClose = () => {
    localStorage.setItem('mahi_onboarding_completed', 'true');
    setIsOpen(false);
  };

  const handleCreateFirstProfile = async () => {
    setIsCreating(true);
    try {
      const baseSettings = getDefaultProfileSettings();
      const osUA = selectedOS === 'mac'
        ? DEFAULT_USER_AGENTS[1].value
        : selectedOS === 'linux'
        ? DEFAULT_USER_AGENTS[3].value
        : DEFAULT_USER_AGENTS[0].value;

      baseSettings.browser.userAgent = osUA;

      await createProfile({
        name: `Primary ${selectedOS.toUpperCase()} Profile`,
        folder: 'General',
        tags: ['Primary', 'Ultra-Stealth'],
        settings: baseSettings,
      });

      useToastStore.getState().showToast({
        type: 'success',
        title: 'Profile Created!',
        message: 'Your primary anti-detect profile is ready to launch.',
      });

      handleClose();
      onNavigate('profiles');
    } catch {
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Creation Failed',
        message: 'Could not create initial profile.',
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-teal-500/30 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col">
        
        {/* Top Header Banner */}
        <div className="relative bg-gradient-to-r from-teal-900/60 via-slate-900 to-indigo-950/60 px-6 py-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-slate-950 font-black text-2xl shadow-lg shadow-teal-500/30">
              M
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">Welcome to MAHI BROWSER</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-500/20 text-teal-400 border border-teal-500/40">
                  PRO
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Enterprise Anti-Detect & Multi-Session Automation Hub</p>
            </div>
          </div>
          <button 
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between px-8 py-3 bg-slate-950/60 border-b border-slate-800/80 text-xs font-semibold">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-teal-400' : 'text-slate-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 1 ? 'bg-teal-500 text-slate-950 font-bold' : 'bg-slate-800'}`}>1</span>
            Capabilities
          </div>
          <div className="w-12 h-0.5 bg-slate-800" />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-teal-400' : 'text-slate-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 2 ? 'bg-teal-500 text-slate-950 font-bold' : 'bg-slate-800'}`}>2</span>
            Environment
          </div>
          <div className="w-12 h-0.5 bg-slate-800" />
          <div className={`flex items-center gap-2 ${step >= 3 ? 'text-teal-400' : 'text-slate-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 3 ? 'bg-teal-500 text-slate-950 font-bold' : 'bg-slate-800'}`}>3</span>
            Launch
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex-1">
          {/* STEP 1: Overview & Highlights */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="text-center max-w-lg mx-auto mb-5">
                <h3 className="text-lg font-bold text-white">Your High-Performance Multi-Profile Fleet</h3>
                <p className="text-xs text-slate-400 mt-1">MAHI Browser provides military-grade anti-bot bypass, real hardware fingerprint spoofing, and automated session farming.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Ultra-Stealth Masking</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Canvas, WebGL GPU, AudioContext & WebRTC noise injected at runtime.</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Layers size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Multi-Window Synchronizer</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Mirror mouse clicks, typing, and navigation across unlimited slave windows.</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Mobile IP Rotator</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">1-Click Android USB ADB airplane mode & 4G/5G LTE dongle IP rotation.</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Bot size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Automated Cookie Warmer</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Farm real browsing history & authoritative Google cookies automatically.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Persona Selection */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="text-center max-w-md mx-auto mb-4">
                <h3 className="text-lg font-bold text-white">Select Default Operating System Persona</h3>
                <p className="text-xs text-slate-400 mt-1">Choose the primary OS environment for your initial anti-detect profiles.</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedOS('windows')}
                  className={`p-4 rounded-xl border flex flex-col items-center gap-3 text-center transition ${
                    selectedOS === 'windows'
                      ? 'bg-teal-500/15 border-teal-500 text-teal-300 shadow-lg shadow-teal-500/20'
                      : 'bg-slate-800/40 border-slate-700 hover:border-slate-600 text-slate-400'
                  }`}
                >
                  <div className={`p-3 rounded-xl ${selectedOS === 'windows' ? 'bg-teal-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'}`}>
                    <Monitor size={24} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Windows 11</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Chrome 131 • Direct3D11</div>
                  </div>
                  {selectedOS === 'windows' && <CheckCircle2 size={16} className="text-teal-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedOS('mac')}
                  className={`p-4 rounded-xl border flex flex-col items-center gap-3 text-center transition ${
                    selectedOS === 'mac'
                      ? 'bg-teal-500/15 border-teal-500 text-teal-300 shadow-lg shadow-teal-500/20'
                      : 'bg-slate-800/40 border-slate-700 hover:border-slate-600 text-slate-400'
                  }`}
                >
                  <div className={`p-3 rounded-xl ${selectedOS === 'mac' ? 'bg-teal-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'}`}>
                    <Apple size={24} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">macOS Sequoia</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Apple M3 Pro • Metal</div>
                  </div>
                  {selectedOS === 'mac' && <CheckCircle2 size={16} className="text-teal-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedOS('linux')}
                  className={`p-4 rounded-xl border flex flex-col items-center gap-3 text-center transition ${
                    selectedOS === 'linux'
                      ? 'bg-teal-500/15 border-teal-500 text-teal-300 shadow-lg shadow-teal-500/20'
                      : 'bg-slate-800/40 border-slate-700 hover:border-slate-600 text-slate-400'
                  }`}
                >
                  <div className={`p-3 rounded-xl ${selectedOS === 'linux' ? 'bg-teal-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'}`}>
                    <Terminal size={24} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Linux Ubuntu</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Chromium • Mesa GL</div>
                  </div>
                  {selectedOS === 'linux' && <CheckCircle2 size={16} className="text-teal-400" />}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Action Choice */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="text-center max-w-md mx-auto mb-4">
                <h3 className="text-lg font-bold text-white">How would you like to begin?</h3>
                <p className="text-xs text-slate-400 mt-1">Choose an action to launch your workspace immediately.</p>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  disabled={isCreating}
                  onClick={handleCreateFirstProfile}
                  className="w-full p-4 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-slate-950 font-bold text-left flex items-center justify-between shadow-lg shadow-teal-500/25 transition disabled:opacity-50"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 rounded-lg bg-slate-950/20 text-slate-950">
                      <Sparkles size={22} />
                    </div>
                    <div>
                      <div className="text-sm font-extrabold">Create Primary Stealth Profile</div>
                      <div className="text-xs font-medium text-slate-900/80 mt-0.5">Auto-generates clean persona, WebGL spoofing & noise</div>
                    </div>
                  </div>
                  <ArrowRight size={18} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    onNavigate('import');
                  }}
                  className="w-full p-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-left flex items-center justify-between transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                      <Download size={18} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Import from GoLogin / AdsPower / Dolphin</div>
                      <div className="text-[11px] text-slate-400">Restore bulk archives, cookies, or JSON accounts</div>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    onNavigate('proxies');
                  }}
                  className="w-full p-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-left flex items-center justify-between transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                      <Globe size={18} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Add Encrypted Residential Proxies</div>
                      <div className="text-[11px] text-slate-400">Setup HTTP / SOCKS5 with AES-256 password security</div>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-slate-400" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as any)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
            >
              Back
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-300 transition"
            >
              Skip Tutorial
            </button>
          )}

          {step < 3 && (
            <button
              type="button"
              onClick={() => setStep((s) => (s + 1) as any)}
              className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition shadow-md shadow-teal-500/20"
            >
              Continue <ArrowRight size={14} />
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
