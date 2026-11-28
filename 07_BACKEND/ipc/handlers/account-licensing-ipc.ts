import * as fs from 'node:fs';
import * as path from 'node:path';
import { ipcMain, shell } from '../../../08_SECURITY/electron-bridge.js';
import {
  deactivateDevice,
  extendLicense,
  getLicenseDevices,
  getLicenses,
  revokeLicense,
  validateCurrentLicense,
} from '../../../04_LICENSING/license-engine.js';
import { setOwnerAdminPin, verifyAdminAccess } from '../../../05_AUTH/admin-auth.js';
import {
  activateTrialFromServer,
  createCheckoutSessionFromServer,
  createDesktopOAuthRequest,
  exchangeDesktopAuthCode,
  fetchAndCacheStatus as accountFetchStatus,
  fetchPaymentStatusFromServer,
  fetchPricingCatalogFromServer,
  forgotPassword as accountForgotPassword,
  getAccountSession,
  getPaymentInfo as accountGetPaymentInfo,
  getTrialStatusFromServer,
  listActiveSessions as accountListActiveSessions,
  login as accountLogin,
  loginWithToken as accountLoginWithToken,
  logout as accountLogout,
  refreshAccountPlanLimits,
  refreshAccountToken,
  resendVerificationEmail as accountResendVerificationEmail,
  resetPassword as accountResetPassword,
  revokeAllSessions as accountRevokeAllSessions,
  revokeSession as accountRevokeSession,
  signup as accountSignup,
  submitManualCryptoPayment as accountSubmitManualCryptoPayment,
  submitManualUpiPayment as accountSubmitManualUpiPayment,
  switchDevice as accountSwitchDevice,
  verifyEmail as accountVerifyEmail,
} from '../../../08_SECURITY/account-service.js';
import {
  acquireCloudLock,
  deleteCloudProfile,
  downloadAndRestoreProfile,
  getAllProfilesSyncStatusAsync,
  getCloudLockStatus,
  getCloudSyncList,
  getCloudSyncUsage,
  getSyncConfigAsync,
  isCloudSyncAllowedAsync,
  releaseCloudLock,
  resolveSyncConflict,
  setSyncConfigAsync,
  syncAllProfilesAsync,
  uploadProfileToCloud,
} from '../../../08_SECURITY/cloud-sync-service.js';
import { assertCanCreateProfile, assertCapability, getPlanLimitsInfo } from '../../../08_SECURITY/freemium-guard.js';
import { getHWID, verifyLicense } from '../../../08_SECURITY/license-service.js';
import { checkLicenseStatusOnline, getOnlineStatusSummary, isGraceExpired, isOnlineRevoked } from '../../../08_SECURITY/license-status-service.js';
import { getDynamicPrice } from '../../../08_SECURITY/price-service.js';
import { sanitizeError } from '../../../08_SECURITY/sanitizer.js';
import type {
  AccountCheckoutPayload,
  CommercialRole,
  CommercialUserStatus,
  FeatureCapability,
} from '../../../10_CONFIG/shared/types/commercial.js';
import type { CloudSyncConfig, CloudSyncConflictResolution, CloudSyncRestoreOptions } from '../../../10_CONFIG/shared/types/sync.js';
import { loginUser, registerUser } from '../../commercial/commercial-auth-service.js';
import { getUserDevices, revokeCommercialDevice } from '../../commercial/commercial-device-service.js';
import { activateCommercialLicenseForUser, checkCapability, evaluateUserEntitlements, activateUserTrial, getUserTrialStatus } from '../../commercial/commercial-entitlement-service.js';
import { getCommercialPlans } from '../../commercial/commercial-plan-service.js';
import { paymentService } from '../../commercial/payment-service.js';
import { buildPlanCatalog } from '../../commercial/pricing-admin-service.js';
import { clearActiveSession, getActiveUserId, setActiveUserId } from '../../commercial/session-context.js';
import { createLogger } from '../../utils/logger.js';
import { getWritableUserDataDir } from '../../utils/runtime-paths.js';
import {
  getActiveOwnerId,
  isEnoentError,
  normalizeBillingCycle,
  toErrMsg,
  type ManualCryptoPaymentInput,
  type ManualUpiPaymentInput,
} from './ipc-shared.js';

const log = createLogger('ipc-account-licensing');

export function registerAccountAndLicensingIpcHandlers(): void {
  // LICENSING & MAHI PRO
  ipcMain.handle('license:getStatus', async () => {
    try {
      const userDataDir = getWritableUserDataDir();
      const licenseFile = path.join(userDataDir, 'offline-license.key');
      let rawKey = '';
      try {
        rawKey = (await fs.promises.readFile(licenseFile, 'utf8')).trim();
      } catch (readErr: unknown) {
        if (!isEnoentError(readErr)) {
          log.warn('Failed reading offline license key in license:getStatus', {
            err: toErrMsg(readErr),
          });
        }
      }
      if (rawKey) {
        const check = verifyLicense(rawKey);
        if (check.valid) {
          if (isOnlineRevoked()) {
            return {
              isValid: false,
              status: 'REVOKED',
              message: 'License revoked. Support se contact karein.',
              license: {
                id: 'local-rsa-license',
                customerName: 'MAHI PRO Subscriber',
                keyMasked: 'MAHI-RSA-REVOKED',
                expiresAt: check.expiresAt,
                maxDevices: 1,
                activeDevicesCount: 1,
              },
            };
          }
          if (isGraceExpired()) {
            return {
              isValid: false,
              status: 'GRACE_EXPIRED',
              message: 'Internet se connect karein — license verify ke liye',
              license: {
                id: 'local-rsa-license',
                customerName: 'MAHI PRO Subscriber',
                keyMasked: 'MAHI-RSA-OFFLINE',
                expiresAt: check.expiresAt,
                maxDevices: 1,
                activeDevicesCount: 1,
              },
            };
          }
          return {
            isValid: true,
            status: 'ACTIVE',
            message: 'MAHI Pro Active',
            license: {
              id: 'local-rsa-license',
              customerName: 'MAHI PRO Subscriber',
              keyMasked: 'MAHI-RSA-ACTIVE',
              expiresAt: check.expiresAt || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
              maxDevices: 1,
              activeDevicesCount: 1,
            },
          };
        } else if (check.error === 'License has expired') {
          return {
            isValid: false,
            status: 'EXPIRED',
            message: 'Your MAHI PRO license has expired. Free plan limits apply.',
            license: {
              id: 'local-rsa-license',
              customerName: 'MAHI PRO Subscriber',
              keyMasked: 'MAHI-RSA-EXPIRED',
              expiresAt: check.expiresAt,
              maxDevices: 1,
              activeDevicesCount: 1,
            },
          };
        }
      }
      return validateCurrentLicense();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('license:getOnlineStatus', async () => {
    try {
      return getOnlineStatusSummary();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('license:checkOnlineNow', async () => {
    try {
      return await checkLicenseStatusOnline();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('app:getDynamicPrice', async () => {
    try {
      return getDynamicPrice();
    } catch (_err) {
      return 599;
    }
  });

  ipcMain.handle('license:activate', async (_event, dto) => {
    try {
      const rawKey = dto?.licenseKey?.trim();
      if (!rawKey) {
        return { success: false, status: 'NOT_ACTIVATED', message: 'License key is required.' };
      }

      // 1. Check RSA signature
      const rsaCheck = verifyLicense(rawKey);
      if (rsaCheck.valid) {
        const userDataDir = getWritableUserDataDir();
        const licenseFile = path.join(userDataDir, 'offline-license.key');
        await fs.promises.writeFile(licenseFile, rawKey, 'utf8');
        setActiveUserId('local-license-user');
        return {
          success: true,
          status: 'ACTIVE',
          message: 'MAHI Pro license successfully activated!',
        };
      }

      // Only RSA-2048 verified licenses can activate
      return {
        success: false,
        status: 'NOT_ACTIVATED',
        message: rsaCheck.error || 'Invalid RSA-2048 license key. A cryptographically signed MAHI- license is required.',
      };
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('license:getLimits', async () => {
    return getPlanLimitsInfo(getActiveOwnerId());
  });

  ipcMain.handle('admin:createLicense', async (_event, _dto, _adminSecret: string) => {
    throw new Error('License minting is disabled in the app. Contact support.');
  });

  ipcMain.handle('admin:getLicenses', async (_event, adminSecret: string, filter) => {
    if (!verifyAdminAccess(adminSecret)) {
      throw new Error('Unauthorized. Admin authentication required.');
    }
    try {
      return getLicenses(filter);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('admin:revokeLicense', async (_event, licenseId: string, adminSecret: string, reason?: string) => {
    if (!verifyAdminAccess(adminSecret)) {
      throw new Error('Unauthorized. Admin authentication required to revoke licenses.');
    }
    try {
      return await revokeLicense(licenseId, reason);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('admin:extendLicense', async (_event, dto, adminSecret: string) => {
    if (!verifyAdminAccess(adminSecret)) {
      throw new Error('Unauthorized. Admin authentication required to extend licenses.');
    }
    try {
      return await extendLicense(dto);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('admin:getDevices', async (_event, licenseId: string, adminSecret: string) => {
    if (!verifyAdminAccess(adminSecret)) {
      throw new Error('Unauthorized. Admin authentication required.');
    }
    try {
      return getLicenseDevices(licenseId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('admin:deactivateDevice', async (_event, licenseId: string, deviceId: string, adminSecret: string) => {
    if (!verifyAdminAccess(adminSecret)) {
      throw new Error('Unauthorized. Admin authentication required.');
    }
    try {
      return deactivateDevice(licenseId, deviceId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('admin:setPin', async (_event, newPin: string, adminSecret: string) => {
    if (!verifyAdminAccess(adminSecret)) {
      throw new Error('Unauthorized. Admin authentication required.');
    }
    try {
      return setOwnerAdminPin(newPin, adminSecret);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  // COMMERCIAL ARCHITECTURE IPC HANDLERS
  ipcMain.handle('commercial:register', async (_event, dto) => {
    try {
      return registerUser(dto);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('commercial:getHwid', async () => getHWID());

  ipcMain.handle('commercial:login', async (_event, dto) => {
    try {
      const claimedFile = path.join(getWritableUserDataDir(), 'claimed-licenses.json');
      const licenseFile = path.join(getWritableUserDataDir(), 'offline-license.key');

      async function readClaimed(): Promise<Record<string, string>> {
        try { return JSON.parse(await fs.promises.readFile(claimedFile, 'utf8')); } catch { return {}; }
      }
      async function writeClaimed(data: Record<string, string>) {
        await fs.promises.writeFile(claimedFile, JSON.stringify(data), 'utf8');
      }

      if (dto.mode === 'CHECK_LICENSE') {
        const claimed = await readClaimed();
        const storedKey = claimed[dto.email?.toLowerCase()];
        if (storedKey) {
          const check = verifyLicense(storedKey);
          if (check.valid) {
            setActiveUserId('local-license-user');
            return { success: true, licenseKey: storedKey };
          }
          delete claimed[dto.email?.toLowerCase()];
          await writeClaimed(claimed);
          return { needsLicense: true, error: 'License expired. Please enter a new key.' };
        }
        return { needsLicense: true };
      }

      if (dto.mode === 'ACTIVATE_LICENSE') {
        const { email, licenseKey: rawKey } = dto;
        if (!email || !rawKey) return { success: false, error: 'Missing email or license key.' };

        const check = verifyLicense(rawKey);
        if (!check.valid) return { success: false, error: check.error || 'Invalid license key.' };

        const claimed = await readClaimed();
        const emailLower = email.toLowerCase();
        const alreadyClaimedBy = claimed[Object.keys(claimed).find((k) => claimed[k] === rawKey) || ''];
        if (alreadyClaimedBy && alreadyClaimedBy !== emailLower) {
          return { success: false, error: 'This license key is already activated on another account.' };
        }

        claimed[emailLower] = rawKey;
        await writeClaimed(claimed);
        await fs.promises.writeFile(licenseFile, rawKey, 'utf8');

        setActiveUserId('local-license-user');
        return { success: true, licenseKey: rawKey };
      }

      if (dto.password === 'LICENSE_MODE') {
        let licenseKey = dto.email;
        if (licenseKey === 'AUTO') {
          try {
            licenseKey = (await fs.promises.readFile(licenseFile, 'utf8')).trim();
          } catch {
            return { success: false, error: 'NO_SAVED_LICENSE' };
          }
        }
        const check = verifyLicense(licenseKey);
        if (check.valid) {
          setActiveUserId('local-license-user');
          const user = { id: 'local-license-user', email: 'Enterprise License', name: 'MAHI PRO', role: 'PRO' as unknown as CommercialRole, status: 'ACTIVE' as CommercialUserStatus, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
          return { success: true, user, token: licenseKey };
        }
        return { success: false, error: check.error };
      }

      const result = loginUser(dto);
      if (result.success && result.user) setActiveUserId(result.user.id);
      return result;
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('commercial:getEntitlements', async (_event, userId?: string, deviceId?: string) => {
    try {
      const uid = userId || getActiveUserId() || getAccountSession()?.account_id || 'anonymous';
      return evaluateUserEntitlements(uid, deviceId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('entitlements:get', async (_event, userId?: string, deviceId?: string) => {
    try {
      const uid = userId || getActiveUserId() || getAccountSession()?.account_id || 'anonymous';
      return evaluateUserEntitlements(uid, deviceId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('entitlements:checkCapability', async (_event, capability: FeatureCapability, userId?: string) => {
    try {
      const uid = userId || getActiveUserId() || getAccountSession()?.account_id || 'anonymous';
      return checkCapability(uid, capability);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('commercial:getDevices', async (_event, userId: string) => {
    try {
      return getUserDevices(userId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('commercial:revokeDevice', async (_event, deviceId: string, userId: string) => {
    try {
      return revokeCommercialDevice(deviceId, { id: userId, name: 'User', role: 'USER' }, userId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('commercial:getPlans', async () => {
    try {
      return getCommercialPlans();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('commercial:activateKey', async (_event, userId: string, rawKey: string) => {
    try {
      return activateCommercialLicenseForUser(userId, rawKey);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  // Cloud Profile Sync Handlers (GoLogin-style)
  ipcMain.handle('sync:isAllowed', async () => isCloudSyncAllowedAsync());
  ipcMain.handle('sync:getUsage', async () => getCloudSyncUsage());
  ipcMain.handle('sync:list', async () => getCloudSyncList());
  ipcMain.handle('sync:upload', async (_e, profileId: string, options?: { force?: boolean; baseVersion?: number; mode?: 'full' | 'cookies_only' }) => {
    assertCapability('cloud.sync');
    return uploadProfileToCloud(profileId, options);
  });
  ipcMain.handle('sync:restore', async (_e, cloudProfileId: string, options?: CloudSyncRestoreOptions) => {
    assertCapability('cloud.sync');
    const activeOwnerId = getActiveOwnerId();
    assertCanCreateProfile(1, activeOwnerId);
    return downloadAndRestoreProfile(cloudProfileId, options);
  });
  ipcMain.handle('sync:delete', async (_e, cloudProfileId: string) => deleteCloudProfile(cloudProfileId));
  ipcMain.handle('sync:getConfig', async () => getSyncConfigAsync());
  ipcMain.handle('sync:setConfig', async (_e, config: Partial<CloudSyncConfig>) => setSyncConfigAsync(config));
  ipcMain.handle('sync:syncAll', async () => {
    assertCapability('cloud.sync');
    return syncAllProfilesAsync();
  });
  ipcMain.handle('sync:getAllStatuses', async () => getAllProfilesSyncStatusAsync());
  ipcMain.handle('sync:resolveConflict', async (_e, profileId: string, resolution: CloudSyncConflictResolution) => resolveSyncConflict(profileId, resolution));
  ipcMain.handle('sync:lock:acquire', async (_e, cloudProfileId: string, ttlSeconds?: number) => acquireCloudLock(cloudProfileId, ttlSeconds));
  ipcMain.handle('sync:lock:release', async (_e, cloudProfileId: string) => releaseCloudLock(cloudProfileId));
  ipcMain.handle('sync:lock:status', async (_e, cloudProfileId: string) => getCloudLockStatus(cloudProfileId));

  // Account & Subscription IPC Handlers (v1.1.0+)
  ipcMain.handle('account:signup', async (_e, dto: { email: string; password: string }) => {
    const res = await accountSignup(dto.email, dto.password);
    if (res.success && res.user?.id) {
      setActiveUserId(res.user.id);
    }
    return res;
  });
  ipcMain.handle('account:login', async (_e, dto: { email: string; password: string }) => {
    const res = await accountLogin(dto.email, dto.password);
    if (res.success && res.user?.id) {
      setActiveUserId(res.user.id);
    }
    return res;
  });
  ipcMain.handle('account:loginWithToken', async (_e, dto: { token: string } | string) => {
    const token = typeof dto === 'string' ? dto : dto.token;
    const res = await accountLoginWithToken(token);
    if (res.success && res.user?.id) {
      setActiveUserId(res.user.id);
    }
    return res;
  });
  ipcMain.handle('commercial:logout', async () => {
    clearActiveSession();
    return accountLogout();
  });
  ipcMain.handle('account:logout', async () => {
    clearActiveSession();
    return accountLogout();
  });
  ipcMain.handle('account:getStatus', async () => {
    return accountFetchStatus();
  });
  ipcMain.handle('account:switchDevice', async () => {
    return accountSwitchDevice();
  });
  ipcMain.handle('account:getPaymentInfo', async () => {
    return accountGetPaymentInfo();
  });
  ipcMain.handle('account:getPricingCatalog', async () => {
    if (process.env.MAHI_LOCAL_COMMERCIAL_MODE === 'true') {
      try {
        return { success: true, catalog: buildPlanCatalog() };
      } catch (err: unknown) {
        return { success: false, error: toErrMsg(err) };
      }
    }
    const remoteRes = await fetchPricingCatalogFromServer();
    if (remoteRes.success && remoteRes.catalog) {
      return remoteRes;
    }
    // Offline / fallback to local builder
    try {
      return { success: true, catalog: buildPlanCatalog() };
    } catch (err: unknown) {
      return { success: false, error: toErrMsg(err) };
    }
  });

  ipcMain.handle('account:createCheckoutSession', async (_e, payload: AccountCheckoutPayload) => {
    if (process.env.MAHI_LOCAL_COMMERCIAL_MODE === 'true') {
      try {
        const session = getAccountSession();
        const userId = session?.account_id || getActiveUserId() || 'SYSTEM_OWNER';
        const result = await paymentService.createCheckoutSession({
          userId,
          planId: payload.planId || payload.plan_id || 'free',
          billingCycle: normalizeBillingCycle(payload.billingCycle || payload.billing_cycle, 'ANNUAL'),
          currency: (payload.currency || 'INR').toUpperCase() === 'USD' ? 'USD' : 'INR',
          extraMembers: payload.extraMembers,
          extraProxyGb: payload.extraProxyGb,
          successUrl: payload.successUrl,
          cancelUrl: payload.cancelUrl,
        }, (payload.provider || 'youpi_pg') as 'stripe' | 'razorpay' | 'youpi_pg' | 'simulation');
        return { success: true, session: result };
      } catch (err: unknown) {
        return { success: false, error: toErrMsg(err) };
      }
    }

    const remoteRes = await createCheckoutSessionFromServer(payload);
    if (remoteRes.success && remoteRes.session?.checkoutUrl) {
      const url = remoteRes.session.checkoutUrl;
      if (url.startsWith('https://') || url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) {
        try {
          await shell.openExternal(url);
        } catch (shellErr) {
          log.warn('Failed opening checkout URL in external browser', {
            err: shellErr instanceof Error ? shellErr.message : String(shellErr),
          });
        }
      }
    }
    return remoteRes;
  });

  ipcMain.handle('account:submitManualUpiPayment', async (_e, payload: ManualUpiPaymentInput) => {
    if (process.env.MAHI_LOCAL_COMMERCIAL_MODE === 'true') {
      try {
        const session = getAccountSession();
        const userId = session?.account_id || getActiveUserId() || 'SYSTEM_OWNER';
        const res = await paymentService.submitManualUpiPayment({
          userId,
          planId: payload.plan_id || payload.planId || 'free',
          billingCycle: normalizeBillingCycle(payload.billing_cycle || payload.billingCycle, 'MONTHLY'),
          utr: payload.utr,
          proofAsset: payload.proof_asset || payload.proofAsset,
          extraMembers: payload.extra_members || payload.extraMembers,
          extraProxyGb: payload.extra_proxy_gb || payload.extraProxyGb,
        });
        return {
          success: true,
          payment_id: res.paymentId,
          status: res.status,
          utr: res.utr,
          amount_paise: res.amountPaise,
          message: 'Payment submitted successfully for verification.',
        };
      } catch (err: unknown) {
        return { success: false, error: toErrMsg(err) };
      }
    }

    return await accountSubmitManualUpiPayment({
      plan_id: payload.plan_id || payload.planId || 'free',
      billing_cycle: payload.billing_cycle || payload.billingCycle,
      utr: payload.utr,
      proof_asset: payload.proof_asset || payload.proofAsset,
      extra_members: payload.extra_members || payload.extraMembers,
      extra_proxy_gb: payload.extra_proxy_gb || payload.extraProxyGb,
    });
  });

  ipcMain.handle('account:submitManualCryptoPayment', async (_e, payload: ManualCryptoPaymentInput) => {
    if (process.env.MAHI_LOCAL_COMMERCIAL_MODE === 'true') {
      try {
        const session = getAccountSession();
        const userId = session?.account_id || getActiveUserId() || 'SYSTEM_OWNER';
        const res = await paymentService.submitManualCryptoPayment({
          userId,
          planId: payload.plan_id || payload.planId || 'free',
          billingCycle: normalizeBillingCycle(payload.billing_cycle || payload.billingCycle, 'SEMI_ANNUAL'),
          txHash: payload.tx_hash || payload.txHash || payload.utr || '',
          network: payload.network,
          proofAsset: payload.proof_asset || payload.proofAsset,
          extraMembers: payload.extra_members || payload.extraMembers,
          extraProxyGb: payload.extra_proxy_gb || payload.extraProxyGb,
        });
        return {
          success: true,
          payment_id: res.paymentId,
          status: res.status,
          tx_hash: res.txHash,
          amount_cents: res.amountCents,
          message: 'USDT (TRC-20) transaction submitted for verification.',
        };
      } catch (err: unknown) {
        return { success: false, error: toErrMsg(err) };
      }
    }

    return await accountSubmitManualCryptoPayment({
      plan_id: payload.plan_id || payload.planId || 'free',
      billing_cycle: payload.billing_cycle || payload.billingCycle,
      tx_hash: payload.tx_hash || payload.txHash || payload.utr || '',
      network: payload.network,
      proof_asset: payload.proof_asset || payload.proofAsset,
      extra_members: payload.extra_members || payload.extraMembers,
      extra_proxy_gb: payload.extra_proxy_gb || payload.extraProxyGb,
    });
  });

  ipcMain.handle('account:getPaymentStatus', async () => {
    if (process.env.MAHI_LOCAL_COMMERCIAL_MODE === 'true') {
      try {
        const session = getAccountSession();
        const userId = session?.account_id || getActiveUserId() || 'SYSTEM_OWNER';
        const history = paymentService.getUserPaymentHistory(userId);
        return { success: true, payments: history };
      } catch (err: unknown) {
        return { success: false, error: toErrMsg(err) };
      }
    }

    return await fetchPaymentStatusFromServer();
  });
  ipcMain.handle('account:getSession', async () => {
    return getAccountSession();
  });
  ipcMain.handle('account:getPlanLimits', async (_e, dto?: { force?: boolean }) => {
    return refreshAccountPlanLimits(dto?.force);
  });
  ipcMain.handle('account:refreshPlanLimits', async () => {
    return refreshAccountPlanLimits(true);
  });
  ipcMain.handle('account:verifyEmail', async (_e, dto: { token: string }) => {
    return accountVerifyEmail(dto.token);
  });
  ipcMain.handle('account:resendVerification', async (_e, dto: { email: string }) => {
    return accountResendVerificationEmail(dto.email);
  });
  ipcMain.handle('account:forgotPassword', async (_e, dto: { email: string }) => {
    return accountForgotPassword(dto.email);
  });
  ipcMain.handle('account:resetPassword', async (_e, dto: { token: string; newPassword: string }) => {
    return accountResetPassword(dto.token, dto.newPassword);
  });
  ipcMain.handle('account:listSessions', async () => {
    return accountListActiveSessions();
  });
  ipcMain.handle('account:revokeSession', async (_e, dto: { sessionId: string }) => {
    return accountRevokeSession(dto.sessionId);
  });
  ipcMain.handle('account:revokeAllSessions', async (_e, dto?: { keepCurrent?: boolean }) => {
    return accountRevokeAllSessions(dto?.keepCurrent ?? true);
  });
  ipcMain.handle('account:refreshToken', async () => {
    return refreshAccountToken();
  });
  ipcMain.handle('account:startDesktopOAuth', async (_e, planId?: string) => {
    return createDesktopOAuthRequest(planId);
  });
  ipcMain.handle('account:exchangeDesktopCode', async (_e, dto: { ticket: string; code: string }) => {
    return exchangeDesktopAuthCode(dto.ticket, dto.code);
  });
  ipcMain.handle('account:activateTrial', async (_e, planId?: string) => {
    if (process.env.MAHI_LOCAL_COMMERCIAL_MODE === 'true') {
      const activeUserId = getActiveUserId() || 'local-license-user';
      return activateUserTrial(activeUserId, planId || 'professional_50');
    }
    return activateTrialFromServer(planId || 'professional_50');
  });
  ipcMain.handle('account:getTrialStatus', async () => {
    if (process.env.MAHI_LOCAL_COMMERCIAL_MODE === 'true') {
      const activeUserId = getActiveUserId() || 'local-license-user';
      return { success: true, ...getUserTrialStatus(activeUserId) };
    }
    return getTrialStatusFromServer();
  });
}
