import { ChildProcess, exec } from 'node:child_process';
import { BrowserWindow } from '../08_SECURITY/electron-bridge.js';
import { Profile, ProfileStatus } from '../10_CONFIG/shared/types/profile.js';
import { getProfileById, updateProfileStatus, findProfileByNumber } from './services/profile-service.js';

import { logActivity } from '../07_BACKEND/services/audit-service.js';
import { recordSessionStart, recordSessionStop } from '../07_BACKEND/services/stats-service.js';
import { launchBrowser, markCleanExit } from './launcher.js';
import { synchronizerHub } from '../09_AUTOMATION/sync-hub.js';
import { platformAdapter } from './services/platform-adapter.js';
import { ProxyTunnelHandle } from './proxy-tunnel.js';

function debugLog(msg: string) {
  const fn = (globalThis as any).__mahiDebugLog;
  if (fn) fn(msg);
  else console.log(msg);
}

interface ActiveProcessEntry {
  process: ChildProcess;
  pid: number;
  profileId: string;
  profileName: string;
  storageDir: string;
  proxyTunnel?: ProxyTunnelHandle;
  launchedAt: number;
  closed?: boolean;
}

type StatusChangeListener = (event: { profileId: string; status: ProfileStatus; pid?: number; error?: string }) => void;

/**
 * Ensures the main MAHI application window remains active on the user's screen
 * when background profiles are launched, preventing focus stealing or screen switching.
 */
export function keepMainWindowActive(): void {
  try {
    const windows = BrowserWindow.getAllWindows();
    const mainWin = windows.find((w) => !w.isDestroyed() && (w.getTitle().includes('MAHI') || !w.getParentWindow()));
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.show();
      mainWin.focus();
      mainWin.moveTop();

      // Timed refocus loop across 1800ms to handle Chrome's window creation delay on Windows
      const delays = [50, 150, 300, 500, 800, 1200, 1800];
      for (const d of delays) {
        setTimeout(() => {
          if (mainWin && !mainWin.isDestroyed()) {
            mainWin.moveTop();
            mainWin.focus();
          }
        }, d);
      }
    }
  } catch {}
}


class ProcessManager {
  private activeProcesses = new Map<string, ActiveProcessEntry>();
  private startingProfiles = new Set<string>();
  private statusListeners = new Set<StatusChangeListener>();

  public addStatusListener(listener: StatusChangeListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  public onStatusChange(listener: StatusChangeListener): () => void {
    return this.addStatusListener(listener);
  }

  public isRunning(profileId: string): boolean {
    return this.activeProcesses.has(profileId);
  }

  public getActivePid(profileId: string): number | undefined {
    return this.activeProcesses.get(profileId)?.pid;
  }

  public getRunningCount(): number {
    return this.activeProcesses.size;
  }

  public getRunningProfileIds(): string[] {
    return Array.from(this.activeProcesses.keys());
  }

  public getRunningProfiles(): { profileId: string; name: string; pid: number }[] {
    return Array.from(this.activeProcesses.values()).map((e) => ({
      profileId: e.profileId,
      name: e.profileName,
      pid: e.pid,
    }));
  }


  private notifyStatus(profileId: string, status: ProfileStatus, pid?: number, error?: string): void {
    try {
      updateProfileStatus(profileId, status);
    } catch (dbErr) {
      debugLog(`[ProcessManager] DB status update note for ${profileId}: ${dbErr}`);
    }

    for (const listener of this.statusListeners) {
      try {
        listener({ profileId, status, pid, error });
      } catch (listenerErr) {
        debugLog(`[ProcessManager] Status listener error: ${listenerErr}`);
      }
    }
  }

  private handleProcessClosed(profileId: string, entry: ActiveProcessEntry, errorMsg?: string): void {
    if (entry.closed) return;
    entry.closed = true;

    this.activeProcesses.delete(profileId);
    try { recordSessionStop(profileId); } catch {}
    if (entry.proxyTunnel) {
      try { entry.proxyTunnel.close(); } catch {}
    }

    if (errorMsg) {
      this.notifyStatus(profileId, 'ERROR', undefined, errorMsg);
      try { logActivity('PROFILE', 'ERROR', 'Browser Error', `"${entry.profileName}" error: ${errorMsg}`, profileId, entry.profileName); } catch {}
    } else {
      this.notifyStatus(profileId, 'STOPPED');
      try { logActivity('PROFILE', 'INFO', 'Stop Browser', `Profile "${entry.profileName}" closed cleanly`, profileId, entry.profileName); } catch {}

      // Auto-Sync and Cloud Lock Release Hook on profile close
      try {
        import('../08_SECURITY/cloud-sync-service.js').then(({ enqueueSync, getSyncConfig, releaseCloudLock, getProfileCloudBinding }) => {
          const binding = getProfileCloudBinding(profileId);
          if (binding?.cloudProfileId) {
            releaseCloudLock(binding.cloudProfileId).catch(() => {});
          }
          if (getSyncConfig().autoSync) {
            enqueueSync(profileId);
          }
        }).catch(() => {});
      } catch {}
    }

    // Auto-stop synchronizer if active profiles drop below 2 or master profile closed
    try {
      if (synchronizerHub.getState().enabled) {
        const remaining = this.getRunningCount();
        const masterId = synchronizerHub.getState().masterProfileId;
        if (remaining < 2 || masterId === profileId) {
          synchronizerHub.stopSync();
          debugLog(`[ProcessManager] Auto-stopped synchronizer as running profiles count is now ${remaining}.`);
        }
      }
    } catch {}
  }

  /**
   * Starts a profile quickly and reliably in the background without stealing user focus from MAHI.
   */
  public async startProfile(profileId: string): Promise<{ success: boolean; pid?: number; error?: string }> {
    debugLog(`[ProcessManager] Request received to start profile ID: ${profileId}`);

    if (this.startingProfiles.has(profileId)) {
      debugLog(`[ProcessManager] Profile ID ${profileId} is already in the process of starting.`);
      return { success: false, error: `Profile ${profileId} is already starting` };
    }

    if (this.isRunning(profileId)) {
      const active = this.activeProcesses.get(profileId);
      debugLog(`[ProcessManager] Profile ID ${profileId} is already running with PID: ${active?.pid}`);
      return { success: true, pid: active?.pid };
    }

    this.startingProfiles.add(profileId);

    try {
      const profile = getProfileById(profileId);
      if (!profile) {
        const errorMsg = `Profile ${profileId} not found in database.`;
        debugLog(`[ProcessManager ERROR] ${errorMsg}`);
        return { success: false, error: errorMsg };
      }

      debugLog(`[ProcessManager] Preparing to launch "${profile.name}"...`);

      // Cloud lock coordination & pre-launch cloud sync pull
      try {
        const {
          getProfileCloudBinding,
          acquireCloudLock,
          syncProfileIfCloudNewer,
          getSyncConfig
        } = await import('../08_SECURITY/cloud-sync-service.js');

        const binding = getProfileCloudBinding(profileId);
        if (binding?.cloudProfileId) {
          const lockRes = await acquireCloudLock(binding.cloudProfileId);
          if (!lockRes.acquired) {
            const errorMsg = `Profile is currently active on ${lockRes.heldBy || 'another device'}. Lock active until ${lockRes.expiresAt}`;
            debugLog(`[ProcessManager ERROR] ${errorMsg}`);
            this.notifyStatus(profileId, 'STOPPED', undefined, errorMsg);
            return { success: false, error: errorMsg };
          }

          // Launch-time cloud pull: pull latest cloud version if updated remotely
          if (getSyncConfig().autoSync) {
            try {
              await syncProfileIfCloudNewer(profileId);
            } catch (syncPullErr) {
              debugLog(`[ProcessManager] Pre-launch cloud sync notice: ${syncPullErr}`);
            }
          }
        }
      } catch {
        // Offline mode: never block local launch!
      }

      this.notifyStatus(profileId, 'STARTING');

      try {
        const info = await launchBrowser(profile);
        const child = info.process;
        const pid = info.pid;

        const entry: ActiveProcessEntry = {
          process: child,
          pid,
          profileId,
          profileName: profile.name,
          storageDir: info.storageDir,
          proxyTunnel: info.proxyTunnel,
          launchedAt: Date.now(),
        };

        this.activeProcesses.set(profileId, entry);
        this.notifyStatus(profileId, 'RUNNING', pid);

        // Keep MAHI Browser application window in focus so user screen does not shift away
        keepMainWindowActive();

        try { recordSessionStart(profileId); } catch {}
        logActivity('PROFILE', 'SUCCESS', 'Start Browser', `Started "${profile.name}" [PID: ${pid}]`, profileId, profile.name);

        // Handle process termination cleanly
        child.on('exit', (code, signal) => {
          debugLog(`[ProcessManager] Profile "${profile.name}" exited with code: ${code}, signal: ${signal}`);
          if (code !== 0 && code !== null) {
            this.handleProcessClosed(profileId, entry, `Process exited abnormally with code ${code}`);
          } else if (signal) {
            this.handleProcessClosed(profileId, entry, `Process terminated by signal ${signal}`);
          } else {
            this.handleProcessClosed(profileId, entry);
          }
        });

        child.on('error', (err) => {
          debugLog(`[ProcessManager ERROR] Profile "${profile.name}" process error: ${err.message}`);
          this.handleProcessClosed(profileId, entry, err.message);
        });

        return { success: true, pid };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        debugLog(`[ProcessManager ERROR] Failed to start profile "${profile.name}": ${message}`);
        this.notifyStatus(profileId, 'ERROR', undefined, message);
        logActivity('PROFILE', 'ERROR', 'Launch Failed', `Launch failed for "${profile.name}": ${message}`, profileId, profile.name);
        return { success: false, error: message };
      }
    } finally {
      this.startingProfiles.delete(profileId);
    }
  }

  public isProfileRunning(profileId: string): boolean {
    return this.activeProcesses.has(profileId);
  }

  public getActiveProcess(profileId: string): ActiveProcessEntry | undefined {
    return this.activeProcesses.get(profileId);
  }

  /**
   * Stops a running browser profile and terminates its child process.
   */
  public async stopProfile(profileId: string): Promise<{ success: boolean; error?: string }> {

    debugLog(`[ProcessManager] Request received to stop profile ID: ${profileId}`);
    const entry = this.activeProcesses.get(profileId);

    if (!entry) {
      debugLog(`[ProcessManager] Profile ID ${profileId} not in active map. Setting status to STOPPED.`);
      this.notifyStatus(profileId, 'STOPPED');
      return { success: true };
    }

    try {
      markCleanExit(entry.storageDir, entry.profileName);

      if (process.platform === 'win32') {
        exec(`taskkill /F /T /PID ${entry.pid}`, () => {});
      } else {
        platformAdapter.terminateProcess(entry.pid).catch(() => {});
      }

      this.handleProcessClosed(profileId, entry);
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      debugLog(`[ProcessManager ERROR] Error stopping profile ID ${profileId}: ${message}`);
      this.handleProcessClosed(profileId, entry, message);
      return { success: false, error: message };
    }
  }

  /**
   * Brings an already running profile window to the foreground.
   */
  public async focusProfile(profileId: string): Promise<boolean> {
    const entry = this.activeProcesses.get(profileId);
    if (!entry) return false;

    debugLog(`[ProcessManager] Focusing existing profile window for "${entry.profileName}" (PID: ${entry.pid})`);

    if (process.platform === 'win32') {
      try {
        const script = `
          $wshell = New-Object -ComObject WScript.Shell
          $ok = $wshell.AppActivate(${entry.pid})
          if (-not $ok) {
            $wshell.AppActivate("${entry.profileName}")
          }
        `;
        exec(`powershell -NoProfile -NonInteractive -Command "${script.replace(/\r?\n\s*/g, ' ')}"`, () => {});
        return true;
      } catch (err) {
        debugLog(`[ProcessManager] Note: AppActivate threw: ${err}`);
      }
    } else {
      platformAdapter.focusWindow(entry.pid, entry.profileName).catch(() => {});
    }
    return true;
  }

  /**
   * Fast Profile Launch / Switch:
   * If already running -> Brings existing window to front without duplicate launch.
   * If not running -> Launches profile in independent window.
   */
  public async quickSwitchProfile(num: number): Promise<{ success: boolean; action?: 'FOCUSED' | 'LAUNCHED'; profile?: Profile; error?: string }> {
    debugLog(`[ProcessManager] Quick switch requested for profile number: ${num}`);
    const profile = findProfileByNumber(num);
    if (!profile) {
      const errorMsg = `Profile ${num} does not exist.`;
      debugLog(`[ProcessManager WARNING] ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    if (this.isRunning(profile.id)) {
      debugLog(`[ProcessManager] Profile ${num} ("${profile.name}") is already running. Switching focus...`);
      await this.focusProfile(profile.id);
      return { success: true, action: 'FOCUSED', profile };
    }

    debugLog(`[ProcessManager] Profile ${num} ("${profile.name}") is not running. Launching...`);
    const res = await this.startProfile(profile.id);
    if (!res.success) {
      return { success: false, error: res.error };
    }

    setTimeout(() => {
      this.focusProfile(profile.id);
    }, 400);

    return { success: true, action: 'LAUNCHED', profile };
  }

  /**
   * Batch launches multiple profiles sequentially with configurable stagger delay (default 1500ms)
   * to protect CPU/RAM from sudden spikes.
   */
  public async startProfilesBatch(
    profileIds: string[],
    delayMs = 1500,
    onProgress?: (info: { completed: number; total: number; profileId: string; success: boolean; pid?: number; error?: string }) => void
  ): Promise<{ results: { profileId: string; success: boolean; pid?: number; error?: string }[] }> {
    debugLog(`[ProcessManager] Staggered batch launch requested for ${profileIds.length} profiles with ${delayMs}ms delay.`);
    const results: { profileId: string; success: boolean; pid?: number; error?: string }[] = [];

    for (let i = 0; i < profileIds.length; i++) {
      const pid = profileIds[i];
      try {
        const res = await this.startProfile(pid);
        const entry = {
          profileId: pid,
          success: res.success,
          pid: res.pid,
          error: res.error,
        };
        results.push(entry);
        if (onProgress) {
          onProgress({
            completed: i + 1,
            total: profileIds.length,
            ...entry,
          });
        }
      } catch (err: any) {
        const entry = {
          profileId: pid,
          success: false,
          error: err.message,
        };
        results.push(entry);
        if (onProgress) {
          onProgress({
            completed: i + 1,
            total: profileIds.length,
            ...entry,
          });
        }
      }

      // Delay between sequential launches if not the last item
      if (i < profileIds.length - 1 && delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return { results };
  }

  /**
   * Stops multiple profiles in parallel.
   */
  public async stopProfilesBatch(profileIds: string[]): Promise<{ results: { profileId: string; success: boolean }[] }> {
    debugLog(`[ProcessManager] Batch stop requested for ${profileIds.length} profiles.`);
    const results = await Promise.all(
      profileIds.map(async (id) => {
        const res = await this.stopProfile(id);
        return { profileId: id, success: res.success };
      })
    );
    return { results };
  }

  /**
   * Stops all active profiles on application shutdown.
   */
  public async stopAll(): Promise<void> {


    debugLog(`[ProcessManager] Stopping all running profiles (${this.activeProcesses.size})...`);
    for (const [profileId, entry] of this.activeProcesses.entries()) {
      try {
        markCleanExit(entry.storageDir, entry.profileName);
        if (process.platform === 'win32') {
          exec(`taskkill /F /T /PID ${entry.pid}`, () => {});
        } else {
          platformAdapter.terminateProcess(entry.pid).catch(() => {});
        }
        if (entry.proxyTunnel) {
          try { entry.proxyTunnel.close(); } catch {}
        }
        this.notifyStatus(profileId, 'STOPPED');
      } catch {}
    }
    this.activeProcesses.clear();

    try {
      if (synchronizerHub.getState().enabled) {
        synchronizerHub.stopSync();
      }
    } catch {}
  }

  public getRunningPids(): number[] {
    return Array.from(this.activeProcesses.values()).map((e) => e.pid);
  }
}

export const processManager = new ProcessManager();
