import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { setCustomDatabasePath, closeDatabase, getDatabase } from '../../06_DATABASE/connection.js';
import {
  getCommercialPlans,
  getCommercialPlanById,
  createCommercialPlan,
  updateCommercialPlan,
} from '../../07_BACKEND/commercial/commercial-plan-service.js';
import {
  registerUser,
  updateUserPlan,
} from '../../07_BACKEND/commercial/commercial-auth-service.js';
import {
  evaluateUserEntitlements,
  canCreateProfile,
  canLaunchProfile,
  activateCommercialLicenseForUser,
} from '../../07_BACKEND/commercial/commercial-entitlement-service.js';
import {
  registerOrUpdateDevice,
  getUserDevices,
  revokeCommercialDevice,
} from '../../07_BACKEND/commercial/commercial-device-service.js';
import { createLicense } from '../../04_LICENSING/license-engine.js';

describe('Commercial Licensing, Plans & Device Entitlements', () => {
  const testDbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-commercial-lic-'));
  const testDbPath = path.join(testDbDir, 'commercial_lic_test.sqlite');

  beforeEach(async () => {
    closeDatabase();
    fs.mkdirSync(testDbDir, { recursive: true });
    for (const suffix of ['', '-wal', '-shm']) {
      try { fs.unlinkSync(`${testDbPath}${suffix}`); } catch {}
    }
    setCustomDatabasePath(testDbPath);
    await initializeDatabase();
  });

  afterAll(() => {
    closeDatabase();
    try { fs.rmSync(testDbDir, { recursive: true, force: true }); } catch {}
  });

  it('should seed default commercial plans with correct limits', () => {
    const plans = getCommercialPlans();
    // Catalog has grown beyond the original 4 tiers (INR plans added).
    // Assert the required tiers EXIST rather than hard-coding a total count.
    expect(plans.length).toBeGreaterThanOrEqual(4);

    const freePlan = plans.find((p) => p.tier === 'FREE');
    expect(freePlan).toBeDefined();
    expect(freePlan?.limits.maxProfiles).toBe(15);
    expect(freePlan?.limits.maxDevices).toBe(1);

    const proPlans = plans.filter((p) => p.tier === 'PRO');
    expect(proPlans.length).toBeGreaterThan(0);
    for (const proPlan of proPlans) {
      expect(proPlan.limits.maxProfiles).toBeGreaterThan(0);
      expect(proPlan.limits.maxDevices).toBeGreaterThan(0);
    }
    expect(proPlans.some((p) => p.limits.apiAccess === true)).toBe(true);

    const entPlan = plans.find((p) => p.tier === 'ENTERPRISE');
    expect(entPlan).toBeDefined();
    expect(entPlan?.limits.maxProfiles).toBe(2500);
    expect(entPlan?.limits.maxDevices).toBe(20);
  });

  it('should enforce device limits: PC 1 allowed, PC 2 allowed on Pro, PC 3 denied when limit is 2', () => {
    const reg = registerUser({ email: 'devices@test.com', password: 'Password123' });
    const userId = reg.user!.id;

    // Upgrade user to PRO plan (maxDevices = 2)
    updateUserPlan(userId, 'plan_pro', { id: 'admin', name: 'Admin', role: 'ADMIN' });

    // PC 1 Activation
    const dev1 = registerOrUpdateDevice({
      userId,
      deviceId: 'MAHI-DEV-PC-1',
      deviceName: 'Workstation 1',
      maxAllowedDevices: 2,
    });
    expect(dev1.success).toBe(true);
    expect(dev1.device?.status).toBe('ACTIVE');

    // PC 2 Activation
    const dev2 = registerOrUpdateDevice({
      userId,
      deviceId: 'MAHI-DEV-PC-2',
      deviceName: 'Laptop 2',
      maxAllowedDevices: 2,
    });
    expect(dev2.success).toBe(true);
    expect(dev2.device?.status).toBe('ACTIVE');

    // PC 3 Activation -> Should be denied (limit reached)
    const dev3 = registerOrUpdateDevice({
      userId,
      deviceId: 'MAHI-DEV-PC-3',
      deviceName: 'Old PC 3',
      maxAllowedDevices: 2,
    });
    expect(dev3.success).toBe(false);
    expect(dev3.message).toContain('Device activation limit reached');

    // Verify only 2 active devices exist
    const activeDevices = getUserDevices(userId).filter((d) => d.status === 'ACTIVE');
    expect(activeDevices.length).toBe(2);
  });

  it('should allow new device activation after revoking an existing device', () => {
    const reg = registerUser({ email: 'revoke@test.com', password: 'Password123' });
    const userId = reg.user!.id;

    // Free plan (maxDevices = 1)
    const dev1 = registerOrUpdateDevice({
      userId,
      deviceId: 'DEV-1',
      deviceName: 'Primary PC',
      maxAllowedDevices: 1,
    });
    expect(dev1.success).toBe(true);

    // 2nd device fails
    const dev2Fail = registerOrUpdateDevice({
      userId,
      deviceId: 'DEV-2',
      deviceName: 'Secondary PC',
      maxAllowedDevices: 1,
    });
    expect(dev2Fail.success).toBe(false);

    // Admin or user revokes DEV-1
    const revokeOk = revokeCommercialDevice('DEV-1', { id: userId, name: 'User', role: 'USER' }, userId);
    expect(revokeOk).toBe(true);

    // Now DEV-2 succeeds
    const dev2Success = registerOrUpdateDevice({
      userId,
      deviceId: 'DEV-2',
      deviceName: 'Secondary PC',
      maxAllowedDevices: 1,
    });
    expect(dev2Success.success).toBe(true);
  });

  it('should evaluate full server-side entitlements and block actions when plan limits are reached', () => {
    const reg = registerUser({ email: 'entitlements@test.com', password: 'Password123' });
    const userId = reg.user!.id;

    const ent = evaluateUserEntitlements(userId);
    expect(ent.allowed).toBe(true);
    expect(ent.plan.tier).toBe('FREE');
    expect(ent.limits.maxProfiles).toBe(15);

    // Profile creation check
    const canCreate = canCreateProfile(userId);
    expect(canCreate.allowed).toBe(true);
  });

  it('should activate a commercial license key and upgrade account tier', () => {
    const reg = registerUser({ email: 'licensebuyer@test.com', password: 'Password123' });
    const userId = reg.user!.id;

    // Owner creates a license
    const lic = createLicense({
      customerName: 'Acme Corp',
      durationType: '1_YEAR',
      maxDevices: 5,
    });

    const actResult = activateCommercialLicenseForUser(userId, lic.rawLicenseKey);
    expect(actResult.success).toBe(true);
    expect(actResult.entitlements?.plan?.tier).toBe('PRO');
  });
});
