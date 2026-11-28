import http from 'node:http';
import { EventEmitter } from 'node:events';
import { logActivity } from '../07_BACKEND/services/audit-service.js';
import { isTrustedOrigin } from '../07_BACKEND/server/cloud-gateway.js';
import { cdpSynchronizer } from './cdp-synchronizer.js';
import { createLogger } from '../07_BACKEND/utils/logger.js';

const log = createLogger('sync-hub');


export interface SyncAction {
  type: 'CLICK' | 'TYPE' | 'KEY' | 'SCROLL' | 'NAVIGATE' | 'START_WARMUP';
  payload: any;
  timestamp: number;
}

export interface SynchronizerConfig {
  syncClicks: boolean;
  syncTyping: boolean;
  syncScroll: boolean;
  syncNavigation: boolean;
  humanDelayMinMs: number;
  humanDelayMaxMs: number;
}

export interface SynchronizerState {
  enabled: boolean;
  masterProfileId: string | null;
  activeProfiles: string[];
  config: SynchronizerConfig;
  mirroredActionCount: number;
  startedAt: string | null;
}

const DEFAULT_CONFIG: SynchronizerConfig = {
  syncClicks: true,
  syncTyping: true,
  syncScroll: true,
  syncNavigation: true,
  humanDelayMinMs: 0,
  humanDelayMaxMs: 0,
};

class SynchronizerHub extends EventEmitter {
  private state: SynchronizerState = {
    enabled: false,
    masterProfileId: null,
    activeProfiles: [],
    config: { ...DEFAULT_CONFIG },
    mirroredActionCount: 0,
    startedAt: null,
  };

  // Support multiple active tabs / windows per profile
  private sseClients: Map<string, Set<http.ServerResponse>> = new Map();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
    // Record actions from CDP engine
    cdpSynchronizer.on('action-mirrored', () => {
      this.recordAction();
    });

    // Keep-alive heartbeat every 15s to prevent connection timeouts

    this.heartbeatTimer = setInterval(() => {
      for (const [pId, clientSet] of this.sseClients.entries()) {
        for (const res of clientSet) {
          try {
            res.write(':ping\n\n');
          } catch {
            clientSet.delete(res);
          }
        }
        if (clientSet.size === 0) {
          this.sseClients.delete(pId);
        }
      }
    }, 15000);
  }

  public getState(): SynchronizerState {
    return {
      ...this.state,
      config: { ...this.state.config },
      activeProfiles: [...this.state.activeProfiles],
    };
  }

  public startSync(
    masterProfileId?: string,
    activeProfiles?: string[],
    config?: Partial<SynchronizerConfig>
  ): SynchronizerState {
    this.state.enabled = true;
    this.state.masterProfileId = masterProfileId || null;
    this.state.activeProfiles = activeProfiles || [];
    this.state.config = { ...DEFAULT_CONFIG, ...(config || {}) };
    this.state.startedAt = new Date().toISOString();
    this.state.mirroredActionCount = 0;

    if (masterProfileId) {
      cdpSynchronizer.start(masterProfileId, activeProfiles || []);
    }

    try {
      logActivity(
        'SYSTEM',
        'INFO',
        'SYNCHRONIZER_STARTED',
        `Synchronizer activated with Master Profile: "${masterProfileId || 'First Active'}" across ${this.state.activeProfiles.length} target windows.`
      );
    } catch (err) {
      log.debug('sync-hub startSync audit log skipped', { err });
    }

    // Broadcast state update to all connected tabs
    this.broadcastSystemNotification({
      type: 'SYNC_STATE_CHANGED',
      state: this.getState(),
    });

    this.emit('state-changed', this.getState());
    return this.getState();
  }

  public stopSync(): SynchronizerState {
    const prevCount = this.state.mirroredActionCount;
    this.state.enabled = false;
    this.state.masterProfileId = null;
    this.state.activeProfiles = [];
    this.state.startedAt = null;

    cdpSynchronizer.stop();

    try {
      logActivity(
        'SYSTEM',
        'INFO',
        'SYNCHRONIZER_STOPPED',
        `Synchronizer stopped after mirroring ${prevCount} actions.`
      );
    } catch (err) {
      log.debug('sync-hub stopSync audit log skipped', { err });
    }

    this.broadcastSystemNotification({
      type: 'SYNC_STATE_CHANGED',
      state: this.getState(),
    });

    this.emit('state-changed', this.getState());
    return this.getState();
  }

  public updateConfig(config: Partial<SynchronizerConfig>): SynchronizerState {
    this.state.config = { ...this.state.config, ...config };
    this.emit('state-changed', this.getState());
    return this.getState();
  }

  public recordAction(): void {
    if (this.state.enabled) {
      this.state.mirroredActionCount++;
      this.emit('state-changed', this.getState());
    }
  }


  public registerClient(profileId: string, res: http.ServerResponse, origin?: string): void {
    if (!this.sseClients.has(profileId)) {
      this.sseClients.set(profileId, new Set());
    }
    const clientSet = this.sseClients.get(profileId)!;
    clientSet.add(res);

    const requestOrigin =
      origin ||
      ((res as any).__req?.headers?.origin as string | undefined) ||
      ((res as any).req?.headers?.origin as string | undefined) ||
      '';
    const headers: Record<string, string> = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Vary': 'Origin',
    };
    if (requestOrigin && isTrustedOrigin(requestOrigin)) {
      headers['Access-Control-Allow-Origin'] = requestOrigin;
      headers['Access-Control-Allow-Credentials'] = 'true';
      headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type, X-API-Key, X-Mahi-Token';
    }

    res.writeHead(200, headers);

    const isMaster = this.state.masterProfileId === profileId;
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', profileId, isMaster, syncEnabled: this.state.enabled })}\n\n`);

    res.on('close', () => {
      clientSet.delete(res);
      if (clientSet.size === 0) {
        this.sseClients.delete(profileId);
      }
    });
  }

  public isClientConnected(profileId: string): boolean {
    const set = this.sseClients.get(profileId);
    return Boolean(set && set.size > 0);
  }

  public getConnectedProfileCount(): number {
    return this.sseClients.size;
  }

  private broadcastSystemNotification(payload: any): void {
    const dataStr = JSON.stringify(payload);
    for (const [pId, clientSet] of this.sseClients.entries()) {
      for (const res of clientSet) {
        try {
          res.write(`data: ${dataStr}\n\n`);
        } catch {
          clientSet.delete(res);
        }
      }
    }
  }

  public broadcastAction(sourceProfileId: string, action: SyncAction): void {
    if (!this.state.enabled && action.type !== 'START_WARMUP') return;

    // Check feature filters
    if (action.type === 'CLICK' && !this.state.config.syncClicks) return;
    if ((action.type === 'TYPE' || action.type === 'KEY') && !this.state.config.syncTyping) return;
    if (action.type === 'SCROLL' && !this.state.config.syncScroll) return;
    if (action.type === 'NAVIGATE' && !this.state.config.syncNavigation) return;

    // If master window is specified, only accept events from master (or system)
    const isMaster =
      !this.state.masterProfileId ||
      sourceProfileId === 'system' ||
      sourceProfileId === this.state.masterProfileId;
    if (!isMaster) {
      return;
    }

    this.recordAction();


    // Native CDP Dispatching (Zero Mixed Content restrictions, full OS-level simulation)
    if (action.type === 'CLICK' && action.payload) {
      cdpSynchronizer.dispatchCdpClick(action.payload.xRatio, action.payload.yRatio, action.payload.button || 0);
    } else if (action.type === 'TYPE' && action.payload) {
      cdpSynchronizer.dispatchCdpType(action.payload.value || '', false);
    } else if (action.type === 'KEY' && action.payload) {
      cdpSynchronizer.dispatchCdpType('', action.payload.key === 'Enter');
    } else if (action.type === 'SCROLL' && action.payload) {
      cdpSynchronizer.dispatchCdpScroll(action.payload.scrollYRatio || 0);
    } else if (action.type === 'NAVIGATE' && action.payload && action.payload.url) {
      cdpSynchronizer.replicateUrlToSlaves(action.payload.url);
    }

    const payload = JSON.stringify(action);


    for (const [pId, clientSet] of this.sseClients.entries()) {
      // Don't echo action back to sender
      if (pId !== sourceProfileId) {
        // If specific target activeProfiles are listed, filter
        if (this.state.activeProfiles.length > 0 && !this.state.activeProfiles.includes(pId)) {
          continue;
        }

        // Apply human delay jitter
        const delay =
          this.state.config.humanDelayMinMs > 0
            ? Math.floor(
                this.state.config.humanDelayMinMs +
                  Math.random() *
                    Math.max(1, this.state.config.humanDelayMaxMs - this.state.config.humanDelayMinMs)
              )
            : 0;

        for (const client of clientSet) {
          if (delay > 0) {
            setTimeout(() => {
              try {
                client.write(`data: ${payload}\n\n`);
              } catch {
                clientSet.delete(client);
              }
            }, delay);
          } else {
            try {
              client.write(`data: ${payload}\n\n`);
            } catch {
              clientSet.delete(client);
            }
          }
        }
      }
    }
  }
}

export const synchronizerHub = new SynchronizerHub();
