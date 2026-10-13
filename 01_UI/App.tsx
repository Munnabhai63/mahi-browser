import React, { useState, useEffect } from 'react';
import { Sidebar, NavigationPage } from './components/Sidebar.js';
import { Header } from './components/Header.js';
import { GlobalSearchModal } from './components/GlobalSearchModal.js';
import { CommandPaletteModal } from './components/CommandPaletteModal.js';
import { SynchronizerModal } from './components/SynchronizerModal.js';
import { ToastContainer } from './components/ToastContainer.js';
import { AppLockModal } from './components/AppLockModal.js';
import { WelcomeWizardModal } from './components/WelcomeWizardModal.js';
import { UpdateModal } from './components/UpdateModal.js';
import { EngineDownloadModal } from './components/EngineDownloadModal.js';
import { AccountModal } from './components/AccountModal.js';
import { useAccountStore } from './stores/useAccountStore.js';

// Pages
import { Dashboard } from './pages/Dashboard.js';
import { ProfilesList } from './pages/ProfilesList.js';
import { TrashBin } from './pages/TrashBin.js';
import { CreateProfileWizard } from './pages/CreateProfileWizard.js';

import { ProfileSettingsPage } from './pages/ProfileSettings.js';
import { BrowserEnvironmentPage } from './pages/BrowserEnvironment.js';
import { ProxyManagerPage } from './pages/ProxyManager.js';
import { CookieManagerPage } from './pages/CookieManager.js';
import { HistoryManagerPage } from './pages/HistoryManager.js';
import { ExtensionManagerPage } from './pages/ExtensionManager.js';
import { AutomationListPage } from './pages/AutomationList.js';
import { WorkflowBuilderPage } from './pages/WorkflowBuilder.js';
import { Diagnostics } from './pages/Diagnostics.js';
import { CaptchaSettings } from './pages/CaptchaSettings.js';
import { WorkspacesPage } from './pages/Workspaces.js';



import { ImportProfilePage } from './pages/ImportProfileModal.js';
import { ExportProfilePage } from './pages/ExportProfileModal.js';
import { AppSettingsPage } from './pages/AppSettings.js';
import { ActivityLogsPage } from './pages/ActivityLogs.js';
import { MahiProLicensePage } from './pages/MahiProLicensePage.js';
import { MobileRotator } from './pages/MobileRotator.js';
import { HelpAboutPage } from './pages/HelpAbout.js';




import { useProfileStore } from './stores/useProfileStore.js';
import { useLogStore } from './stores/useLogStore.js';
import { useSettingsStore } from './stores/useSettingsStore.js';
import { useToastStore } from './stores/useToastStore.js';

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<NavigationPage>('profiles');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const { fetchProfiles, handleStatusChange } = useProfileStore();
  const { fetchLogs, addLog } = useLogStore();
  const { fetchSettings } = useSettingsStore();

  const { currentUser, commercialUser, isAccountModalOpen, closeAccountModal } = useAccountStore();

  useEffect(() => {
    // 1. Immediately restore desktop account session and plan limits from persistent storage
    useAccountStore.getState().fetchPlanLimits().then(() => {
      const state = useAccountStore.getState();
      const hasSession = Boolean(state.accountSession?.token || state.currentUser);
      const firstLaunchHandled = localStorage.getItem('mahi_first_launch_seen');
      if (!hasSession && !firstLaunchHandled) {
        localStorage.setItem('mahi_first_launch_seen', 'true');
        useAccountStore.getState().openAccountModal();
      }
    }).catch(() => {});

    // Attempt auto-login if saved license exists
    useAccountStore.getState().commercialLogin('AUTO', 'LICENSE_MODE').catch(() => {});

    // Initial data load for all users (Free and Pro)
    fetchProfiles();
    fetchLogs();
    fetchSettings();

    // Listen to real-time events from main process
    if (window.mahiAPI) {
      const unsubStatus = window.mahiAPI.onProfileStatusChanged((data) => {
        handleStatusChange(data);
      });

      const unsubLogs = window.mahiAPI.onActivityLogAdded((log) => {
        addLog(log);
      });

      const unsubAccount = window.mahiAPI.onAccountStatusChanged?.(() => {
        useAccountStore.getState().fetchPlanLimits().catch(() => {});
      });

      return () => {
        unsubStatus();
        unsubLogs();
        unsubAccount?.();
      };
    }
  }, []);

  // When commercial user state changes, refresh profiles
  useEffect(() => {
    if (commercialUser) {
      fetchProfiles();
    }
  }, [commercialUser]);

  const [isSynchronizerOpen, setIsSynchronizerOpen] = useState(false);

  // Global Keyboard Shortcuts (Ctrl+K, Ctrl+N, Ctrl+,, Ctrl+F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setCurrentPage('create-profile');
      } else if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setCurrentPage('settings');
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fast Profile Launch / Switch via:
  // 1) Hold Space + Number (e.g. Space + 1)
  // 2) Hold Shift + Number (e.g. Shift + 1)
  // 3) Number + Space (e.g. 1 then Space)
  useEffect(() => {
    let digitBuffer = '';
    let bufferTimer: NodeJS.Timeout | null = null;
    let isSpaceDown = false;

    const triggerQuickSwitch = async (profileNum: number) => {
      if (isNaN(profileNum) || profileNum <= 0) return;
      try {
        const res = await window.mahiAPI.quickSwitchProfile(profileNum);
        if (!res.success) {
          useToastStore.getState().showToast({
            type: 'error',
            title: 'Quick Switch',
            message: res.error || `Profile ${profileNum} does not exist.`,
          });
        } else if (res.action === 'FOCUSED') {
          useToastStore.getState().showToast({
            type: 'info',
            title: 'Profile Focused',
            message: `Switched to running "${res.profile?.name || `Profile ${profileNum}`}"`,
          });
        } else if (res.action === 'LAUNCHED') {
          useToastStore.getState().showToast({
            type: 'success',
            title: 'Profile Launched',
            message: `Launched "${res.profile?.name || `Profile ${profileNum}`}"`,
          });
        }
      } catch (err: any) {
        useToastStore.getState().showToast({
          type: 'error',
          title: 'Launch Error',
          message: err?.message || 'Failed to switch profile',
        });
      }
    };

    const handleQuickSwitchKeyDown = async (e: KeyboardEvent) => {
      // 1. Input Safety: If user is typing in input, textarea, select, or contenteditable, ignore completely
      const activeEl = document.activeElement;
      const tag = activeEl ? (activeEl.tagName || '').toUpperCase() : '';
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (activeEl as HTMLElement)?.isContentEditable;
      if (isInput) {
        digitBuffer = '';
        return;
      }

      if (e.key === ' ' || e.code === 'Space') {
        isSpaceDown = true;
      }

      // Check if Shift or Space is being held while pressing digit
      const digitMatch = e.code?.match(/^Digit([0-9])$/) || e.code?.match(/^Numpad([0-9])$/);
      if (digitMatch && (isSpaceDown || e.shiftKey)) {
        e.preventDefault();
        const num = parseInt(digitMatch[1], 10);
        if (num > 0) {
          digitBuffer = '';
          await triggerQuickSwitch(num);
          return;
        }
      }

      // 2. Accumulate digits for Number + Space sequence
      if (e.key >= '0' && e.key <= '9') {
        digitBuffer += e.key;
        if (bufferTimer) clearTimeout(bufferTimer);
        bufferTimer = setTimeout(() => {
          digitBuffer = '';
        }, 1200);
        return;
      }

      // 3. Trigger on Space
      if ((e.key === ' ' || e.code === 'Space') && digitBuffer.length > 0) {
        e.preventDefault();
        const profileNum = parseInt(digitBuffer, 10);
        digitBuffer = '';
        if (bufferTimer) clearTimeout(bufferTimer);
        await triggerQuickSwitch(profileNum);
      }
    };

    const handleQuickSwitchKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.code === 'Space') {
        isSpaceDown = false;
      }
    };

    window.addEventListener('keydown', handleQuickSwitchKeyDown);
    window.addEventListener('keyup', handleQuickSwitchKeyUp);
    return () => {
      window.removeEventListener('keydown', handleQuickSwitchKeyDown);
      window.removeEventListener('keyup', handleQuickSwitchKeyUp);
    };
  }, []);


  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans">
      {/* â•â•â• AUTH GATE: shown when user is not logged in. Blocks entire app â•â•â• */}


      {/* App Lock PIN Screen */}
      <AppLockModal />

      {/* Navigation Sidebar */}
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          onOpenSearch={() => setIsSearchOpen(true)}
        />

        <main className="flex-1 overflow-hidden bg-slate-50/50 dark:bg-slate-950/60">
          {currentPage === 'dashboard' && <Dashboard onNavigate={setCurrentPage} />}
          {currentPage === 'profiles' && <ProfilesList onNavigate={setCurrentPage} />}
          {currentPage === 'diagnostics' && <Diagnostics />}
          {currentPage === 'workspaces' && <WorkspacesPage />}
          {currentPage === 'captcha' && <CaptchaSettings />}
          {currentPage === 'trash-bin' && <TrashBin onNavigate={setCurrentPage} />}



          {currentPage === 'create-profile' && <CreateProfileWizard onNavigate={setCurrentPage} />}

          {currentPage === 'profile-settings' && <ProfileSettingsPage onNavigate={setCurrentPage} />}
          {currentPage === 'browser-environment' && <BrowserEnvironmentPage onNavigate={setCurrentPage} />}
          {currentPage === 'mobile-rotator' && <MobileRotator />}
          {currentPage === 'proxies' && <ProxyManagerPage onNavigate={setCurrentPage} />}

          {currentPage === 'cookies' && <CookieManagerPage onNavigate={setCurrentPage} />}
          {currentPage === 'history' && <HistoryManagerPage onNavigate={setCurrentPage} />}
          {currentPage === 'extensions' && <ExtensionManagerPage onNavigate={setCurrentPage} />}
          {currentPage === 'automation' && <AutomationListPage onNavigate={setCurrentPage} />}
          {currentPage === 'workflow-builder' && <WorkflowBuilderPage onNavigate={setCurrentPage} />}
          {currentPage === 'import' && <ImportProfilePage onNavigate={setCurrentPage} />}
          {currentPage === 'export' && <ExportProfilePage onNavigate={setCurrentPage} />}
          {currentPage === 'settings' && <AppSettingsPage onNavigate={setCurrentPage} />}

          {currentPage === 'license' && <MahiProLicensePage onNavigate={setCurrentPage} />}
          {currentPage === 'logs' && <ActivityLogsPage onNavigate={setCurrentPage} />}

          {currentPage === 'help' && <HelpAboutPage onNavigate={setCurrentPage} />}
        </main>
      </div>

      {/* Global Modals & Notifications */}
      <WelcomeWizardModal onNavigate={setCurrentPage} />
      <UpdateModal />
      <EngineDownloadModal />
      <CommandPaletteModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={setCurrentPage}
        onOpenCreateProfile={() => setCurrentPage('create-profile')}
        onOpenSynchronizer={() => setIsSynchronizerOpen(true)}
      />
      <SynchronizerModal
        isOpen={isSynchronizerOpen}
        onClose={() => setIsSynchronizerOpen(false)}
      />
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={closeAccountModal}
      />
      <ToastContainer />
    </div>
  );
};


