import { getDeviceId, getDeviceName } from '../../03_HARDWARE/device-id.js';
import { log, getApiBaseUrl, getSyncAuthHeadersAsync } from './sync-auth-config.js';
import { requestApi } from './sync-state.js';

// ============================================================================
// DISTRIBUTED PROFILE LOCKING (Client-side coordination)
// ============================================================================
const activeLockHeartbeats = new Map<string, NodeJS.Timeout>();

export function getActiveLockHeartbeatCount(): number {
  return activeLockHeartbeats.size;
}

export async function acquireCloudLock(
  cloudProfileId: string,
  ttlSeconds = 300
): Promise<{ acquired: boolean; heldBy?: string; expiresAt?: string; statusCode?: number }> {
  try {
    const authHeaders = await getSyncAuthHeadersAsync();
    const baseUrl = getApiBaseUrl();

    const payload = JSON.stringify({
      cloudProfileId,
      deviceId: getDeviceId(),
      deviceName: getDeviceName(),
      ttlSeconds,
    });

    const res = await requestApi(`${baseUrl}/api/v1/sync/lock/acquire`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...authHeaders,
      },
    }, Buffer.from(payload));

    const data = JSON.parse(res.body.toString('utf8'));
    if (res.statusCode === 200 && data.acquired) {
      // Clear any existing heartbeat interval strictly for this specific profile
      const existing = activeLockHeartbeats.get(cloudProfileId);
      if (existing) {
        clearInterval(existing);
        activeLockHeartbeats.delete(cloudProfileId);
      }
      // Start dedicated background heartbeat renewal every 60 seconds for this profile
      const timer = setInterval(() => {
        renewCloudLock(cloudProfileId).catch((renewErr) => {
          log.debug('Cloud lock heartbeat renewal failed', {
            cloudProfileId,
            err: renewErr instanceof Error ? renewErr.message : String(renewErr),
          });
        });
      }, 60000);
      activeLockHeartbeats.set(cloudProfileId, timer);
      return { acquired: true, expiresAt: data.expiresAt, statusCode: 200 };
    }

    return { acquired: false, heldBy: data.heldBy, expiresAt: data.expiresAt, statusCode: res.statusCode };
  } catch (err) {
    // Offline mode or network error: never block local launch!
    log.debug('Cloud lock acquisition skipped (offline or unreachable)', {
      cloudProfileId,
      err: err instanceof Error ? err.message : String(err),
    });
    return { acquired: true };
  }
}

export async function withProfileCloudSyncLock<T>(
  cloudProfileId: string | undefined,
  fn: () => Promise<T>
): Promise<T> {
  if (!cloudProfileId) {
    return fn();
  }

  const alreadyHeldLocally = activeLockHeartbeats.has(cloudProfileId);
  if (alreadyHeldLocally) {
    await renewCloudLock(cloudProfileId).catch(() => false);
    return fn();
  }

  const lockRes = await acquireCloudLock(cloudProfileId);
  if (!lockRes.acquired && lockRes.statusCode === 423) {
    throw new Error(`Profile is currently locked by another device (${lockRes.heldBy || 'active session'}).`);
  }

  const acquiredTempLock = Boolean(lockRes.acquired && lockRes.statusCode === 200);
  try {
    return await fn();
  } finally {
    if (acquiredTempLock) {
      await releaseCloudLock(cloudProfileId).catch(() => false);
    }
  }
}

export async function renewCloudLock(cloudProfileId: string, ttlSeconds = 300): Promise<boolean> {
  try {
    const authHeaders = await getSyncAuthHeadersAsync();
    const baseUrl = getApiBaseUrl();

    const payload = JSON.stringify({
      cloudProfileId,
      deviceId: getDeviceId(),
      ttlSeconds,
    });

    const res = await requestApi(`${baseUrl}/api/v1/sync/lock/renew`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...authHeaders,
      },
    }, Buffer.from(payload));

    return res.statusCode === 200;
  } catch {
    return false;
  }
}

export async function releaseCloudLock(cloudProfileId: string): Promise<boolean> {
  const timer = activeLockHeartbeats.get(cloudProfileId);
  if (timer) {
    clearInterval(timer);
    activeLockHeartbeats.delete(cloudProfileId);
  }

  try {
    const authHeaders = await getSyncAuthHeadersAsync();
    const baseUrl = getApiBaseUrl();

    const payload = JSON.stringify({
      cloudProfileId,
      deviceId: getDeviceId(),
    });

    const res = await requestApi(`${baseUrl}/api/v1/sync/lock/release`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...authHeaders,
      },
    }, Buffer.from(payload));

    return res.statusCode === 200;
  } catch {
    return false;
  }
}

export async function releaseAllCloudLocks(): Promise<void> {
  const profileIds = Array.from(activeLockHeartbeats.keys());
  for (const pid of profileIds) {
    const timer = activeLockHeartbeats.get(pid);
    if (timer) {
      clearInterval(timer);
      activeLockHeartbeats.delete(pid);
    }
  }
  await Promise.allSettled(profileIds.map((pid) => releaseCloudLock(pid)));
}

export async function getCloudLockStatus(
  cloudProfileId: string
): Promise<{ isLocked: boolean; heldBy?: string; expiresAt?: string }> {
  try {
    const authHeaders = await getSyncAuthHeadersAsync();
    const baseUrl = getApiBaseUrl();

    const res = await requestApi(
      `${baseUrl}/api/v1/sync/lock/status?cloudProfileId=${encodeURIComponent(cloudProfileId)}`,
      {
        method: 'GET',
        headers: authHeaders,
      }
    );

    if (res.statusCode === 200) {
      const data = JSON.parse(res.body.toString('utf8'));
      return data.data;
    }
  } catch (err) {
    log.debug('Cloud lock status query fell back to unlocked', {
      cloudProfileId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
  return { isLocked: false };
}
