import type React from 'react';
import { useState, useEffect, Suspense, lazy } from 'react';
import { Sidebar, type NavigationPage } from './components/Sidebar.js';
import { Header } from './components/Header.js';
import { ToastContainer } from './components/ToastContainer.js';
import { AppLockModal } from './components/AppLockModal.js';
import { PageLoadingFallback } from './components/PageFallback.js';
import { useAccountStore } from './stores/useAccountStore.js';

// Lazy-loaded Modals
const CommandPaletteModal = lazy(() =>
  import('./components/CommandPaletteModal.js').then((m) => ({ default: m.CommandPaletteModal }))
);
const SynchronizerModal = lazy(() =>
  import('./components/SynchronizerModal.js').then((m) => ({ default: m.SynchronizerModal }))
);
const WelcomeWizardModal = lazy(() =>
  import('./components/WelcomeWizardModal.js').then((m) => ({ default: m.WelcomeWizardModal }))
);
const UpdateModal = lazy(() =>
  import('./components/UpdateModal.js').then((m) => ({ default: m.UpdateModal }))
);
const EngineDownloadModal = lazy(() =>
  import('./components/EngineDownloadModal.js').then((m) => ({ default: m.EngineDownloadModal }))
);
const AccountModal = lazy(() =>
  import('./components/AccountModal.js').then((m) => ({ default: m.AccountModal }))
);

// Lazy-loaded Pages
const Dashboard = lazy(() => import('./pages/Dashboard.js').then((m) => ({ default: m.Dashboard })));
const ProfilesList = lazy(() => import('./pages/ProfilesList.js').then((m) => ({ default: m.ProfilesList })));
const TrashBin = lazy(() => import('./pages/TrashBin.js').then((m) => ({ default: m.TrashBin })));
const CreateProfileWizard = lazy(() =>
  import('./pages/CreateProfileWizard.js').then((m) => ({ default: m.CreateProfileWizard }))
);
const ProfileSettingsPage = lazy(() =>
  import('./pages/ProfileSettings.js').then((m) => ({ default: m.ProfileSettingsPage }))
);
const BrowserEnvironmentPage = lazy(() =>
  import('./pages/BrowserEnvironment.js').then((m) => ({ default: m.BrowserEnvironmentPage }))
);
const ProxyManagerPage = lazy(() =>
  import('./pages/ProxyManager.js').then((m) => ({ default: m.ProxyManagerPage }))
);
const CookieManagerPage = lazy(() =>
  import('./pages/CookieManager.js').then((m) => ({ default: m.CookieManagerPage }))
);
const HistoryManagerPage = lazy(() =>
  import('./pages/HistoryManager.js').then((m) => ({ default: m.HistoryManagerPage }))
);
const ExtensionManagerPage = lazy(() =>
  import('./pages/ExtensionManager.js').then((m) => ({ default: m.ExtensionManagerPage }))
);
const AutomationListPage = lazy(() =>
  import('./pages/AutomationList.js').then((m) => ({ default: m.AutomationListPage }))
);
const WorkflowBuilderPage = lazy(() =>
  import('./pages/WorkflowBuilder.js').then((m) => ({ default: m.WorkflowBuilderPage }))
);
const Diagnostics = lazy(() => import('./pages/Diagnostics.js').then((m) => ({ default: m.Diagnostics })));
const CaptchaSettings = lazy(() =>
  import('./pages/CaptchaSettings.js').then((m) => ({ default: m.CaptchaSettings }))
);
const WorkspacesPage = lazy(() => import('./pages/Workspaces.js').then((m) => ({ default: m.WorkspacesPage })));
const ImportProfilePage = lazy(() =>
  import('./pages/ImportProfileModal.js').then((m) => ({ default: m.ImportProfilePage }))
);
const ExportProfilePage = lazy(() =>
  import('./pages/ExportProfileModal.js').then((m) => ({ default: m.ExportProfilePage }))
);
const AppSettingsPage = lazy(() => import('./pages/AppSettings.js').then((m) => ({ default: m.AppSettingsPage })));
const ActivityLogsPage = lazy(() =>
  import('./pages/ActivityLogs.js').then((m) => ({ default: m.ActivityLogsPage }))
);
const MahiProLicensePage = lazy(() =>
  import('./pages/MahiProLicensePage.js').then((m) => ({ default: m.MahiProLicensePage }))
);
const MobileRotator = lazy(() => import('./pages/MobileRotator.js').then((m) => ({ default: m.MobileRotator })));
const CloudPhoneManager = lazy(() =>
  import('./pages/CloudPhoneManager.js').then((m) => ({ default: m.CloudPhoneManager }))
);
const HelpAboutPage = lazy(() => import('./pages/HelpAbout.js').then((m) => ({ default: m.HelpAboutPage })));




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
    }).catch((err) => {
      console.warn('[App] Entitlements evaluation notice:', err);
    });

    // Attempt auto-login if saved license exists
    useAccountStore.getState().commercialLogin('AUTO', 'LICENSE_MODE').catch((err) => {
      console.debug('[App] Auto commercial login notice:', err);
    });

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

      const unsubToast = window.mahiAPI.onToastShow?.((data) => {
        useToastStore.getState().showToast(data);
      });

      const unsubTimezoneMismatch = window.mahiAPI.onProfileTimezoneMismatch?.((data) => {
        useToastStore.getState().showToast({
          type: 'warning',
          title: 'Timezone Mismatch Detected',
          message: `Profile "${data.profileName}" uses ${data.profileTimezone}, but proxy exit is ${data.proxyTimezone}.`,
          duration: 10000,
          action: {
            label: 'Sync Timezone',
            onClick: () => {
              const matchedProfile = useProfileStore.getState().profiles.find((p) => p.id === data.profileId);
              useProfileStore.getState().updateProfile(data.profileId, {
                settings: {
                  locale: {
                    timezone: data.proxyTimezone,
                    language: data.suggestedLanguage || matchedProfile?.settings?.locale?.language || 'en-US',
                    languagesList: data.suggestedLanguagesList || matchedProfile?.settings?.locale?.languagesList || [data.suggestedLanguage || 'en-US'],
                  },
                },
              });
            },
          },
        });
      });

      const unsubAccount = window.mahiAPI.onAccountStatusChanged?.(() => {
        useAccountStore.getState().fetchPlanLimits({ force: true }).catch((err) => {
          console.debug('[App] Account limits sync notice:', err);
        });
        fetchProfiles();
      });

      const handleWindowFocus = () => {
        useAccountStore.getState().fetchPlanLimits({ force: true }).catch((err) => {
          console.debug('[App] Focus limits sync notice:', err);
        });
      };
      window.addEventListener('focus', handleWindowFocus);

      return () => {
        unsubStatus();
        unsubLogs();
        unsubToast?.();
        unsubTimezoneMismatch?.();
        unsubAccount?.();
        window.removeEventListener('focus', handleWindowFocus);
      };
    }
  }, [addLog, fetchLogs, fetchProfiles, fetchSettings, handleStatusChange]);


  // When user auth state changes, refresh profiles
  useEffect(() => {
    if (currentUser !== undefined || commercialUser !== undefined) {
      fetchProfiles();
    }
  }, [currentUser, commercialUser, fetchProfiles]);

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
      if (Number.isNaN(profileNum) || profileNum <= 0) return;
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
      } catch (err: unknown) {
        useToastStore.getState().showToast({
          type: 'error',
          title: 'Launch Error',
          message: err instanceof Error ? err.message : 'Failed to switch profile',
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
          <Suspense fallback={<PageLoadingFallback />}>
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
            {currentPage === 'cloud-phone' && <CloudPhoneManager onNavigate={setCurrentPage} />}
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
          </Suspense>
        </main>
      </div>

      {/* Global Modals & Notifications */}
      <Suspense fallback={null}>
        <WelcomeWizardModal onNavigate={setCurrentPage} />
        <UpdateModal />
        <EngineDownloadModal />
        {isSearchOpen && (
          <CommandPaletteModal
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            onNavigate={setCurrentPage}
            onOpenCreateProfile={() => setCurrentPage('create-profile')}
            onOpenSynchronizer={() => setIsSynchronizerOpen(true)}
          />
        )}
        {isSynchronizerOpen && (
          <SynchronizerModal
            isOpen={isSynchronizerOpen}
            onClose={() => setIsSynchronizerOpen(false)}
          />
        )}
        {isAccountModalOpen && (
          <AccountModal
            isOpen={isAccountModalOpen}
            onClose={closeAccountModal}
          />
        )}
      </Suspense>
      <ToastContainer />
    </div>
  );
};


