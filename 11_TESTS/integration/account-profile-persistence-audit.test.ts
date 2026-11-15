import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import {
  initSqlEngine,
  setCustomDatabasePath,
  closeDatabase,
  getDatabase,
} from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  createProfile,
  getProfiles,
  getProfileById,
  updateProfile,
  deleteProfile,
  softDeleteProfile,
  restoreProfile,
  emptyTrash,
  getTrashProfiles,
  getProfileStoragePath,
  cloneProfile,
  bulkCreateProfiles,
  claimLegacyProfiles,
  getUnassignedLegacyProfiles,
} from '../../02_BROWSER/services/profile-service.js';
import {
  exportProfileToArchive,
  importProfileFromArchive,
  collectEssentialStorageFiles,
  restoreStorageFiles,
} from '../../02_BROWSER/services/archive-service.js';
import {
  encryptProfileArchive,
  decryptProfileArchive,
} from '../../08_SECURITY/cloud-profile-crypto.js';
import { importCookies, getCookies } from '../../02_BROWSER/services/cookie-service.js';
import { setActiveUserId, getActiveUserId, clearActiveSession } from '../../07_BACKEND/commercial/session-context.js';
import { AccountSession, clearEncryptedSession } from '../../08_SECURITY/account-service.js';
import { startApiServer, stopApiServer } from '../../07_BACKEND/api/local-api-server.js';
import { saveAppSettings } from '../../07_BACKEND/services/settings-service.js';
import { getInstallSecrets } from '../../08_SECURITY/install-secrets.js';

describe('MAHI BROWSER — ACCOUNT PROFILE PERSISTENCE & CLOUD RESTORE AUDIT', () => {
  let tempBaseDir: string;
  let dbPath: string;

  const EMAIL_A = 'test_user_a@mahibrowser.com';
  const USER_A_ID = 'usr_uuid_account_a_9981';

  const EMAIL_B = 'test_user_b@mahibrowser.com';
  const USER_B_ID = 'usr_uuid_account_b_1142';

  beforeAll(async () => {
    clearEncryptedSession();
    clearActiveSession();
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-audit-lifecycle-'));
    dbPath = path.join(tempBaseDir, 'mahi_audit.sqlite');
    setCustomDatabasePath(dbPath);
    await initSqlEngine();
    await initializeDatabase();
  });

  afterAll(() => {
    closeDatabase();
    clearActiveSession();
    try {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    } catch {}
  });

  // --------------------------------------------------------------------------
  // TEST 1: Same-PC Account Lifecycle & Data Isolation (Email A -> Logout -> Email B -> Email A)
  // --------------------------------------------------------------------------
  it('STAGE 1-7: Full Account A/B Lifecycle: 10 profiles, browsing data, isolation, restore & restart persistence', async () => {
    // ------------------------------------------------------------------------
    // Step 1: Login with Email A and create 10 browser profiles
    // ------------------------------------------------------------------------
    setActiveUserId(USER_A_ID);
    expect(getActiveUserId()).toBe(USER_A_ID);

    const emailAProfiles: any[] = [];
    for (let i = 1; i <= 10; i++) {
      const p = createProfile({
        name: `EmailA-Profile-${i}`,
        folder: i <= 5 ? 'Work' : 'Personal',
        tags: [`tag-${i}`, 'AccountA'],
        notes: `Confidential note for Profile ${i} belonging to User A`,
        ownerId: USER_A_ID,
        settings: {
          browser: {
            engine: 'chrome',
            userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/138.0.0.${i}`,
          },
          display: {
            resolution: '1920x1080',
            scale: 1,
          },
          fingerprint: {
            canvas: 'noise',
            webgl: 'noise',
            audio: 'noise',
            hardwareConcurrency: 8,
            deviceMemory: 16,
          },
        },
      });
      emailAProfiles.push(p);
    }

    expect(emailAProfiles.length).toBe(10);

    // ------------------------------------------------------------------------
    // Step 2: Save real browsing data inside all 10 profiles (cookies, session, local storage)
    // ------------------------------------------------------------------------
    for (let i = 0; i < emailAProfiles.length; i++) {
      const p = emailAProfiles[i];
      const storageDir = p.storagePath;

      // 1. Cookies via SQLite / custom cookie service
      const testCookies = [
        {
          name: `auth_session_${i + 1}`,
          value: `jwt_token_secret_value_${i + 1}_abcdef123456`,
          domain: '.google.com',
          path: '/',
          secure: true,
          httpOnly: true,
        },
        {
          name: `account_pref_${i + 1}`,
          value: `theme=dark&lang=en-US`,
          domain: '.example.com',
          path: '/',
          secure: false,
          httpOnly: false,
        },
      ];
      importCookies(p.id, JSON.stringify(testCookies));

      // 2. Real Chromium storage directory structure
      const defDir = path.join(storageDir, 'Default');
      const localStoreDir = path.join(defDir, 'Local Storage', 'leveldb');
      const sessionStoreDir = path.join(defDir, 'Session Storage');
      fs.mkdirSync(localStoreDir, { recursive: true });
      fs.mkdirSync(sessionStoreDir, { recursive: true });

      fs.writeFileSync(
        path.join(defDir, 'Preferences'),
        JSON.stringify({
          account_id: USER_A_ID,
          profile_index: i + 1,
          homepage: 'https://app.mahibrowser.com',
        }),
        'utf8'
      );

      fs.writeFileSync(
        path.join(localStoreDir, '000001.ldb'),
        Buffer.from(`leveldb-user-data-record-profile-${i + 1}-${USER_A_ID}`),
        'utf8'
      );

      fs.writeFileSync(
        path.join(sessionStoreDir, '000002.log'),
        Buffer.from(`session-tab-state-data-profile-${i + 1}`),
        'utf8'
      );
    }

    // Verify Email A sees all 10 profiles
    const emailAProfilesQueried = getProfiles({ ownerId: USER_A_ID });
    expect(emailAProfilesQueried.length).toBe(10);
    expect(emailAProfilesQueried.every((p) => p.ownerId === USER_A_ID)).toBe(true);

    // ------------------------------------------------------------------------
    // Step 3: Log out of Email A without deleting its profiles or browser data
    // ------------------------------------------------------------------------
    clearActiveSession();
    expect(getActiveUserId()).toBeNull();

    // When logged out, an unauthenticated / guest query (ownerId = SYSTEM_OWNER) MUST NOT leak Email A profiles
    const loggedOutProfiles = getProfiles({ ownerId: 'SYSTEM_OWNER' });
    expect(loggedOutProfiles.some((p) => p.ownerId === USER_A_ID)).toBe(false);

    // Verify that files on disk for Email A were NOT wiped
    for (const p of emailAProfiles) {
      expect(fs.existsSync(p.storagePath)).toBe(true);
      expect(fs.existsSync(path.join(p.storagePath, 'Default', 'Preferences'))).toBe(true);
      expect(fs.existsSync(path.join(p.storagePath, 'Default', 'Local Storage', 'leveldb', '000001.ldb'))).toBe(true);
    }

    // ------------------------------------------------------------------------
    // Step 4: Log in with Email B and confirm Email A's private profiles are strictly inaccessible
    // ------------------------------------------------------------------------
    setActiveUserId(USER_B_ID);
    expect(getActiveUserId()).toBe(USER_B_ID);

    // Email B queries profiles
    const emailBProfiles = getProfiles({ ownerId: USER_B_ID });
    // Email B has not created any profiles yet, must NOT see Email A's profiles!
    expect(emailBProfiles.some((p) => p.ownerId === USER_A_ID)).toBe(false);
    expect(emailBProfiles.length).toBe(0);

    // Email B attempts direct access to Email A's profile by ID: MUST RETURN NULL (ACCESS DENIED)
    const targetProfileA1 = emailAProfiles[0];
    const directAccess = getProfileById(targetProfileA1.id, USER_B_ID);
    expect(directAccess).toBeNull();

    // Email B attempts direct access to Trash: MUST NOT LEAK Email A's deleted items
    const trashForB = getTrashProfiles(USER_B_ID);
    expect(trashForB.some((p) => p.ownerId === USER_A_ID)).toBe(false);

    // Email B creates 2 of their own profiles
    const emailBProfile1 = createProfile({
      name: 'EmailB-Work-1',
      folder: 'Work',
      ownerId: USER_B_ID,
    });
    const emailBProfile2 = createProfile({
      name: 'EmailB-Work-2',
      folder: 'Work',
      ownerId: USER_B_ID,
    });

    const emailBUpdatedList = getProfiles({ ownerId: USER_B_ID });
    expect(emailBUpdatedList.length).toBe(2);
    expect(emailBUpdatedList.every((p) => p.ownerId === USER_B_ID)).toBe(true);
    expect(emailBUpdatedList.some((p) => p.ownerId === USER_A_ID)).toBe(false);

    // ------------------------------------------------------------------------
    // Step 5: Log out of Email B and log back into Email A
    // ------------------------------------------------------------------------
    clearActiveSession();
    setActiveUserId(USER_A_ID);
    expect(getActiveUserId()).toBe(USER_A_ID);

    // ------------------------------------------------------------------------
    // Step 6: Verify all 10 profiles, metadata, cookies, sessions, storage & settings remain available
    // ------------------------------------------------------------------------
    const emailAReloginProfiles = getProfiles({ ownerId: USER_A_ID });
    expect(emailAReloginProfiles.length).toBe(10);
    // User A should NOT see User B's profiles
    expect(emailAReloginProfiles.some((p) => p.ownerId === USER_B_ID)).toBe(false);

    // Check every profile's metadata and data integrity
    for (let i = 0; i < 10; i++) {
      const orig = emailAProfiles[i];
      const found = emailAReloginProfiles.find((p) => p.id === orig.id);
      expect(found).toBeDefined();
      expect(found.name).toBe(`EmailA-Profile-${i + 1}`);
      expect(found.folder).toBe(i < 5 ? 'Work' : 'Personal');
      expect(found.tags).toContain(`tag-${i + 1}`);
      expect(found.tags).toContain('AccountA');
      expect(found.notes).toContain(`User A`);
      expect(found.settings.fingerprint?.canvas).toBe('noise');
      expect(found.settings.browser?.userAgent).toBe(`Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/138.0.0.${i + 1}`);

      // Verify cookies remain accessible for User A
      const cookies = getCookies({ profileId: orig.id });
      expect(cookies.length).toBe(2);
      expect(cookies[0].name).toBe(`auth_session_${i + 1}`);
      expect(cookies[0].value).toBe(`jwt_token_secret_value_${i + 1}_abcdef123456`);

      // Verify files and local storage exist on disk
      const prefContent = fs.readFileSync(path.join(orig.storagePath, 'Default', 'Preferences'), 'utf8');
      expect(prefContent).toContain(USER_A_ID);

      const ldbContent = fs.readFileSync(path.join(orig.storagePath, 'Default', 'Local Storage', 'leveldb', '000001.ldb'), 'utf8');
      expect(ldbContent).toContain(`profile-${i + 1}-${USER_A_ID}`);
    }

    // ------------------------------------------------------------------------
    // Step 7: Restart MAHI Browser (Simulate full DB & process reload)
    // ------------------------------------------------------------------------
    // Close DB connection and re-open from the same SQLite file
    closeDatabase();
    setCustomDatabasePath(dbPath);
    await initSqlEngine();
    await initializeDatabase();

    // Session remains User A
    setActiveUserId(USER_A_ID);
    const postRestartProfiles = getProfiles({ ownerId: USER_A_ID });
    expect(postRestartProfiles.length).toBe(10);
    expect(postRestartProfiles.every((p) => p.ownerId === USER_A_ID)).toBe(true);

    const targetCookiePostRestart = getCookies({ profileId: emailAProfiles[0].id });
    expect(targetCookiePostRestart.length).toBe(2);
    expect(targetCookiePostRestart[0].value).toBe('jwt_token_secret_value_1_abcdef123456');
  });

  // --------------------------------------------------------------------------
  // TEST 2: Cloud Sync & Second-PC Restore Simulation with Zero-Knowledge Encryption
  // --------------------------------------------------------------------------
  it('STAGE 8-9: Cloud Package & Second-PC Restore: metadata, fingerprints, proxies, cookies, storage, extensions', async () => {
    // Machine 1: Email A creates a rich profile with all browser data
    const pc1Profile = createProfile({
      name: 'PRO-Cloud-Sync-Source',
      folder: 'Finance',
      tags: ['Crypto', 'High-Priority'],
      notes: 'Contains trading session and wallet state',
      ownerId: USER_A_ID,
      settings: {
        browser: {
          engine: 'chrome',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/138.0.7204.0 Safari/537.36',
          webrtc: 'fake',
        },
        display: {
          resolution: '2560x1440',
          scale: 1.25,
          timezone: 'America/New_York',
        },
        network: {
          directConnection: false,
          proxyId: 'mock_proxy_123',
        },
        fingerprint: {
          canvas: 'noise',
          webgl: 'noise',
          audio: 'noise',
          clientRects: 'noise',
          webglVendor: 'Google Inc. (NVIDIA)',
          webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Direct3D11 vs_5_0 ps_5_0, D3D11)',
          hardwareConcurrency: 16,
          deviceMemory: 32,
        },
      },
    });

    // Populate cookies
    const sourceCookies = [
      {
        name: 'cloud_session_token',
        value: 'tok_live_trading_session_secret_777888',
        domain: '.binance.com',
        path: '/',
        secure: true,
        httpOnly: true,
      },
    ];
    importCookies(pc1Profile.id, JSON.stringify(sourceCookies));

    // Populate storage files
    const pc1Dir = pc1Profile.storagePath;
    const pc1DefDir = path.join(pc1Dir, 'Default');
    const pc1LocalDir = path.join(pc1DefDir, 'Local Storage', 'leveldb');
    const pc1SessionDir = path.join(pc1DefDir, 'Session Storage');
    fs.mkdirSync(pc1LocalDir, { recursive: true });
    fs.mkdirSync(pc1SessionDir, { recursive: true });

    fs.writeFileSync(path.join(pc1DefDir, 'Preferences'), JSON.stringify({ theme: 'dark', session_active: true }), 'utf8');
    fs.writeFileSync(path.join(pc1LocalDir, '000001.ldb'), 'local-storage-wallet-keys-encrypted-state', 'utf8');
    fs.writeFileSync(path.join(pc1SessionDir, '000002.log'), 'active-tabs-order-url-history', 'utf8');

    // Export archive (exactly what uploadProfileToCloud packages)
    const exportPath = path.join(tempBaseDir, 'synced_profile.mahi-profile');
    const userMasterSyncPassphrase = 'UserA_EndToEnd_ZeroKnowledge_Key!2026';

    const exportResult = exportProfileToArchive({
      profileId: pc1Profile.id,
      targetFilePath: exportPath,
      includeCookies: true,
      includeHistory: true,
      includeExtensions: true,
      includeBrowserSettings: true,
      includeStorage: true,
      password: userMasterSyncPassphrase,
    });

    expect(exportResult.success).toBe(true);
    expect(fs.existsSync(exportPath)).toBe(true);

    const archiveRawBytes = fs.readFileSync(exportPath);

    // Step 2: Zero-knowledge AES-256-GCM envelope encryption for cloud transit
    const encryptedCloudBlob = encryptProfileArchive(archiveRawBytes, userMasterSyncPassphrase);

    expect(encryptedCloudBlob.ciphertext).toBeInstanceOf(Buffer);
    expect(encryptedCloudBlob.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(encryptedCloudBlob.encryptedDataKey).toBeDefined();
    expect(encryptedCloudBlob.iv).toHaveLength(24);
    expect(encryptedCloudBlob.authTag).toHaveLength(32);

    // VERIFY ZERO-KNOWLEDGE: The encrypted ciphertext transmitted to cloud server contains NO plaintext!
    const rawCiphertextStr = encryptedCloudBlob.ciphertext.toString('binary');
    expect(rawCiphertextStr).not.toContain('PRO-Cloud-Sync-Source');
    expect(rawCiphertextStr).not.toContain('Finance');
    expect(rawCiphertextStr).not.toContain('tok_live_trading_session_secret_777888');
    expect(rawCiphertextStr).not.toContain('binance.com');

    // ========================================================================
    // SECOND MACHINE (ISOLATED WINDOWS MACHINE RESTORE SIMULATION)
    // ========================================================================
    const pc2BaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-pc2-isolated-'));
    const pc2DbPath = path.join(pc2BaseDir, 'pc2_database.sqlite');

    // Switch to isolated PC2 database
    closeDatabase();
    setCustomDatabasePath(pc2DbPath);
    await initSqlEngine();
    await initializeDatabase();

    // On PC2, User A logs in
    setActiveUserId(USER_A_ID);

    // Initial PC2 database is fresh and completely empty
    expect(getProfiles({ ownerId: USER_A_ID }).length).toBe(0);

    // Step 3: Decrypt cloud blob on PC2 using zero-knowledge client decryption
    const decryptedArchiveBuffer = decryptProfileArchive({
      ciphertext: encryptedCloudBlob.ciphertext,
      expectedChecksum: encryptedCloudBlob.checksumSha256,
      encryptedDataKey: encryptedCloudBlob.encryptedDataKey,
      iv: encryptedCloudBlob.iv,
      authTag: encryptedCloudBlob.authTag,
      userMasterKey: userMasterSyncPassphrase,
    });

    const pc2TempArchiveFile = path.join(pc2BaseDir, 'received_cloud_archive.mahi-profile');
    fs.writeFileSync(pc2TempArchiveFile, decryptedArchiveBuffer);

    // Step 4: Atomically restore on PC2
    const pc2RestoredProfile = importProfileFromArchive({
      sourceFilePath: pc2TempArchiveFile,
      password: userMasterSyncPassphrase,
      overrideName: 'PRO-Cloud-Sync-Source (Restored on PC2)',
      targetFolder: 'Finance',
      ownerId: USER_A_ID,
    });

    expect(pc2RestoredProfile).toBeDefined();
    expect(pc2RestoredProfile.name).toBe('PRO-Cloud-Sync-Source (Restored on PC2)');
    expect(pc2RestoredProfile.ownerId).toBe(USER_A_ID);
    expect(pc2RestoredProfile.folder).toBe('Finance');
    expect(pc2RestoredProfile.tags).toContain('Crypto');

    // Verify fingerprint restored exactly on PC2
    expect(pc2RestoredProfile.settings.browser?.userAgent).toContain('Chrome/138.0.7204.0');
    expect(pc2RestoredProfile.settings.display?.resolution).toBe('2560x1440');
    expect(pc2RestoredProfile.settings.fingerprint?.canvas).toBe('noise');
    expect(pc2RestoredProfile.settings.fingerprint?.webglVendor).toBe('Google Inc. (NVIDIA)');
    expect(pc2RestoredProfile.settings.fingerprint?.hardwareConcurrency).toBe(16);
    expect(pc2RestoredProfile.settings.fingerprint?.deviceMemory).toBe(32);

    // Verify cookies restored on PC2
    const pc2Cookies = getCookies({ profileId: pc2RestoredProfile.id });
    expect(pc2Cookies.length).toBe(1);
    expect(pc2Cookies[0].name).toBe('cloud_session_token');
    expect(pc2Cookies[0].value).toBe('tok_live_trading_session_secret_777888');
    expect(pc2Cookies[0].domain).toBe('.binance.com');

    // Verify local storage & preferences files restored on PC2
    const pc2ProfileDir = pc2RestoredProfile.storagePath;
    const pc2PrefPath = path.join(pc2ProfileDir, 'Default', 'Preferences');
    const pc2LdbPath = path.join(pc2ProfileDir, 'Default', 'Local Storage', 'leveldb', '000001.ldb');
    const pc2SessionPath = path.join(pc2ProfileDir, 'Default', 'Session Storage', '000002.log');

    expect(fs.existsSync(pc2PrefPath)).toBe(true);
    expect(fs.existsSync(pc2LdbPath)).toBe(true);
    expect(fs.existsSync(pc2SessionPath)).toBe(true);

    expect(fs.readFileSync(pc2LdbPath, 'utf8')).toBe('local-storage-wallet-keys-encrypted-state');
    expect(fs.readFileSync(pc2SessionPath, 'utf8')).toBe('active-tabs-order-url-history');

    // Cleanup PC2
    closeDatabase();
    try {
      fs.rmSync(pc2BaseDir, { recursive: true, force: true });
    } catch {}

    // Switch back to test DB
    setCustomDatabasePath(dbPath);
    await initSqlEngine();
    await initializeDatabase();
  });

  // --------------------------------------------------------------------------
  // TEST 3: Edge Cases: Tampering, Wrong Passphrase, Conflicting Edits & Accidental Deletion
  // --------------------------------------------------------------------------
  it('STAGE 10-12: Integrity check failure on corrupted payload, conflict detection, and accidental deletion prevention', () => {
    setActiveUserId(USER_A_ID);

    const testProfile = createProfile({
      name: 'Integrity-Test-Profile',
      ownerId: USER_A_ID,
    });

    const exportFile = path.join(tempBaseDir, 'integrity_test.mahi-profile');
    const passphrase = 'CorrectPassphrase999!';

    exportProfileToArchive({
      profileId: testProfile.id,
      targetFilePath: exportFile,
      includeCookies: true,
      includeBrowserSettings: true,
      includeStorage: true,
      password: passphrase,
    });

    const rawBuffer = fs.readFileSync(exportFile);
    const encryptedPkg = encryptProfileArchive(rawBuffer, passphrase);

    // 1. Checksum mismatch detection: alter 1 byte of ciphertext
    const tamperedCiphertext = Buffer.from(encryptedPkg.ciphertext);
    tamperedCiphertext[tamperedCiphertext.length - 1] ^= 0xff; // Flip bits

    // Checksum verification must catch this
    const computedSha = crypto.createHash('sha256').update(tamperedCiphertext).digest('hex');
    expect(computedSha).not.toBe(encryptedPkg.checksumSha256);

    // Decrypting tampered payload with GCM authentication tag MUST fail
    expect(() => {
      decryptProfileArchive({
        ciphertext: tamperedCiphertext,
        expectedChecksum: computedSha, // Checksum bypassed
        encryptedDataKey: encryptedPkg.encryptedDataKey,
        iv: encryptedPkg.iv,
        authTag: encryptedPkg.authTag, // Auth tag will fail
        userMasterKey: passphrase,
      });
    }).toThrow();

    // 2. Wrong user master key detection
    expect(() => {
      decryptProfileArchive({
        ciphertext: encryptedPkg.ciphertext,
        expectedChecksum: encryptedPkg.checksumSha256,
        encryptedDataKey: encryptedPkg.encryptedDataKey,
        iv: encryptedPkg.iv,
        authTag: encryptedPkg.authTag,
        userMasterKey: 'IncorrectWrongPassphrase!',
      });
    }).toThrow();

    // 3. User B cannot delete User A's profile
    setActiveUserId(USER_B_ID);
    const deleteAttempt = getProfileById(testProfile.id, USER_B_ID);
    expect(deleteAttempt).toBeNull(); // Denied

    // Switch back to User A
    setActiveUserId(USER_A_ID);
    const validAccess = getProfileById(testProfile.id, USER_A_ID);
    expect(validAccess).not.toBeNull();
    expect(validAccess?.id).toBe(testProfile.id);

    deleteProfile(testProfile.id);
  });

  // --------------------------------------------------------------------------
  // TEST 4: Stage 13 — Legacy Unassigned Profile Claim Workflow
  // --------------------------------------------------------------------------
  it('STAGE 13: Unassigned legacy profile claim workflow: SYSTEM_OWNER profiles are isolated and claimable only with confirmation', () => {
    // 1. Create a legacy unassigned profile (as if created pre-upgrade or by unauthenticated desktop)
    const db = getDatabase();
    const legacyProfile = createProfile({
      name: 'Historical-Pre-Upgrade-Profile',
      folder: 'Archive',
      ownerId: 'SYSTEM_OWNER',
    });

    // Verify it is assigned to SYSTEM_OWNER
    const rawRow = db.prepare('SELECT owner_id FROM profiles WHERE id = ?').get(legacyProfile.id) as { owner_id: string };
    expect(rawRow.owner_id).toBe('SYSTEM_OWNER');

    // 2. When User A logs in, their profile list MUST NOT contain the unassigned legacy profile
    setActiveUserId(USER_A_ID);
    const userAProfilesBeforeClaim = getProfiles({ ownerId: USER_A_ID });
    expect(userAProfilesBeforeClaim.some((p) => p.id === legacyProfile.id)).toBe(false);

    // Direct access by ID with User A ownerId returns null before claiming
    expect(getProfileById(legacyProfile.id, USER_A_ID)).toBeNull();

    // 3. Query unassigned profiles via explicit API
    const unassigned = getUnassignedLegacyProfiles();
    expect(unassigned.some((p) => p.id === legacyProfile.id)).toBe(true);

    // 4. Attempt to claim without explicit confirmation: MUST BE REJECTED
    const unconfirmedClaim = claimLegacyProfiles(USER_A_ID, [legacyProfile.id], { userConfirmed: false });
    expect(unconfirmedClaim.success).toBe(false);
    expect(unconfirmedClaim.claimedCount).toBe(0);

    // 5. User A explicitly claims the legacy profile with confirmation
    const confirmedClaim = claimLegacyProfiles(USER_A_ID, [legacyProfile.id], { userConfirmed: true });
    expect(confirmedClaim.success).toBe(true);
    expect(confirmedClaim.claimedCount).toBe(1);
    expect(confirmedClaim.claimedIds).toContain(legacyProfile.id);

    // 6. Now User A queries profiles: the claimed profile is now visible under User A
    const userAProfilesAfterClaim = getProfiles({ ownerId: USER_A_ID });
    expect(userAProfilesAfterClaim.some((p) => p.id === legacyProfile.id)).toBe(true);

    const claimedProfile = getProfileById(legacyProfile.id, USER_A_ID);
    expect(claimedProfile).not.toBeNull();
    expect(claimedProfile?.ownerId).toBe(USER_A_ID);

    // 7. User B logs in: MUST NOT see User A's newly claimed profile
    setActiveUserId(USER_B_ID);
    const userBProfiles = getProfiles({ ownerId: USER_B_ID });
    expect(userBProfiles.some((p) => p.id === legacyProfile.id)).toBe(false);
    expect(getProfileById(legacyProfile.id, USER_B_ID)).toBeNull();

    // 8. User B attempts to hijack/claim User A's profile: MUST BE SKIPPED
    const hijackAttempt = claimLegacyProfiles(USER_B_ID, [legacyProfile.id], { userConfirmed: true });
    expect(hijackAttempt.claimedCount).toBe(0);
    expect(hijackAttempt.skippedIds).toContain(legacyProfile.id);

    // Clean up
    setActiveUserId(USER_A_ID);
    deleteProfile(legacyProfile.id, USER_A_ID);
  });

  // --------------------------------------------------------------------------
  // TEST 5: Stage 14 — Local REST API (port 32188) Multi-Account Isolation
  // --------------------------------------------------------------------------
  it('STAGE 14: Local REST API Server session isolation: requests cannot access, modify, or clone other user profiles', async () => {
    const testPort = 32188;
    saveAppSettings({
      advanced: {
        apiServerEnabled: true,
        apiPort: testPort,
      },
    });

    startApiServer();

    // Wait a brief tick for server listen
    await new Promise((r) => setTimeout(r, 150));

    const token = getInstallSecrets().apiAuthToken;
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    try {
      // Create a profile for User A
      clearEncryptedSession();
      setActiveUserId(USER_A_ID);
      const profileA = createProfile({
        name: 'UserA-REST-Protected-Profile',
        folder: 'Private',
        ownerId: USER_A_ID,
      });

      // 1. When User A is active, GET /profiles returns profileA
      const resA = await fetch(`http://127.0.0.1:${testPort}/profiles`, { headers: authHeaders });
      expect(resA.status).toBe(200);
      const jsonA = (await resA.json()) as any;
      expect(jsonA.success).toBe(true);
      expect(jsonA.data.some((p: any) => p.id === profileA.id)).toBe(true);

      // 2. Switch session context to User B
      setActiveUserId(USER_B_ID);

      // GET /profiles as User B MUST NOT return profileA
      const resB = await fetch(`http://127.0.0.1:${testPort}/profiles`, { headers: authHeaders });
      expect(resB.status).toBe(200);
      const jsonB = (await resB.json()) as any;
      expect(jsonB.success).toBe(true);
      expect(jsonB.data.some((p: any) => p.id === profileA.id)).toBe(false);

      // 3. User B attempts to access profileA by ID directly via REST: returns 404
      const resBGetSingle = await fetch(`http://127.0.0.1:${testPort}/profiles/${profileA.id}`, { headers: authHeaders });
      expect(resBGetSingle.status).toBe(404);

      // 4. User B attempts to clone profileA via REST: returns 404
      const resBClone = await fetch(`http://127.0.0.1:${testPort}/profiles/${profileA.id}/clone`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ name: 'Hijacked-Clone' }),
      });
      expect(resBClone.status).toBe(404);

      // 5. User B attempts to delete profileA via REST: returns 404
      const resBDelete = await fetch(`http://127.0.0.1:${testPort}/profiles/${profileA.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      expect(resBDelete.status).toBe(404);

      // Switch back to User A and clean up
      setActiveUserId(USER_A_ID);
      deleteProfile(profileA.id, USER_A_ID);
    } finally {
      stopApiServer();
    }
  });
});

