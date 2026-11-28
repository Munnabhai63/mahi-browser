/**
 * MAHI Browser — Mobile Offline Cache & Idempotent Sync Queue
 * Phase 11 Architecture
 *
 * Capabilities:
 * - Caches read-only state for offline browsing without crashing
 * - Queues idempotent mutation actions for background flush upon reconnection
 */

import type { OfflineQueueItem } from '../../../10_CONFIG/shared/types/mobile.js';

export class OfflineCacheManager {
  private static instance: OfflineCacheManager;
  private isOnlineState = true;
  private cache = new Map<string, { data: unknown; cachedAt: number }>();
  private offlineQueue: OfflineQueueItem[] = [];

  private constructor() {}

  public static getInstance(): OfflineCacheManager {
    if (!OfflineCacheManager.instance) {
      OfflineCacheManager.instance = new OfflineCacheManager();
    }
    return OfflineCacheManager.instance;
  }

  public setOnline(online: boolean): void {
    this.isOnlineState = online;
  }

  public isOnline(): boolean {
    return this.isOnlineState;
  }

  /**
   * Caches read-only snapshot of remote API resource.
   */
  public setCached<T>(key: string, data: T): void {
    this.cache.set(key, { data, cachedAt: Date.now() });
  }

  /**
   * Retrieves cached snapshot when offline.
   */
  public getCached<T>(key: string): T | null {
    const item = this.cache.get(key);
    return item ? (item.data as T) : null;
  }

  /**
   * Queues an idempotent mutation to be retried when online.
   */
  public enqueueAction(item: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'retryCount'>): void {
    const queueItem: OfflineQueueItem = {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      endpoint: item.endpoint,
      method: item.method,
      payload: item.payload,
      timestamp: Date.now(),
      retryCount: 0,
    };
    this.offlineQueue.push(queueItem);
  }

  public getQueue(): OfflineQueueItem[] {
    return [...this.offlineQueue];
  }

  public clearQueue(): void {
    this.offlineQueue = [];
  }
}

export const offlineCacheManager = OfflineCacheManager.getInstance();

export const MobileOfflineCache = {
  setCachedProfiles(profiles: Array<Record<string, unknown>>): void {
    OfflineCacheManager.getInstance().setCached('cached_profiles', profiles);
  },

  getCachedProfiles(): Array<Record<string, unknown>> | null {
    return OfflineCacheManager.getInstance().getCached<Array<Record<string, unknown>>>('cached_profiles');
  },
};
