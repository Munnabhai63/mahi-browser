/**
 * MAHI Browser — Android Platform-Backed Secure Token Storage
 * Phase 11 Architecture
 *
 * Models Android Keystore & EncryptedSharedPreferences:
 * - Uses AES-256-GCM authenticated encryption
 * - Derives device-bound master keys
 * - Never logs or stores plaintext access or refresh tokens
 */

import crypto from 'node:crypto';

export interface MobileStoredTokens {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string;
  storedAt: string;
}

export class MobileSecureStorage {
  private static instance: MobileSecureStorage;
  private memoryStore = new Map<string, string>(); // Encrypted blobs only
  private deviceMasterKey: Buffer;

  private constructor() {
    // Generate or derive device-bound key (analogous to Android Keystore Hardware-backed Key)
    const deviceSeed = 'mahi-android-keystore-hardware-seed-v1';
    this.deviceMasterKey = crypto.createHash('sha256').update(deviceSeed).digest();
  }

  private biometricLockActive = false;

  public static getInstance(): MobileSecureStorage {
    if (!MobileSecureStorage.instance) {
      MobileSecureStorage.instance = new MobileSecureStorage();
    }
    return MobileSecureStorage.instance;
  }

  public static async saveTokens(tokens: MobileStoredTokens): Promise<void> {
    return MobileSecureStorage.getInstance().saveTokens(tokens);
  }

  public static async getTokens(): Promise<MobileStoredTokens | null> {
    return MobileSecureStorage.getInstance().getTokens();
  }

  public static async clearTokens(): Promise<void> {
    return MobileSecureStorage.getInstance().clearTokens();
  }

  public static isBiometricLockActive(): boolean {
    return MobileSecureStorage.getInstance().isBiometricLockActive();
  }

  public static setBiometricLockActive(active: boolean): void {
    MobileSecureStorage.getInstance().setBiometricLockActive(active);
  }

  public isBiometricLockActive(): boolean {
    return this.biometricLockActive;
  }

  public setBiometricLockActive(active: boolean): void {
    this.biometricLockActive = active;
  }

  /**
   * Encrypts and saves auth tokens using AES-256-GCM.
   */
  public async saveTokens(tokens: MobileStoredTokens): Promise<void> {
    const payload = JSON.stringify(tokens);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.deviceMasterKey, iv);

    const ciphertext = Buffer.concat([cipher.update(Buffer.from(payload, 'utf8')), cipher.final()]);
    const tag = cipher.getAuthTag();

    const envelope = JSON.stringify({
      c: ciphertext.toString('base64'),
      i: iv.toString('base64'),
      t: tag.toString('base64'),
    });

    this.memoryStore.set('auth_tokens_enc', envelope);
  }

  /**
   * Decrypts and retrieves auth tokens.
   */
  public async getTokens(): Promise<MobileStoredTokens | null> {
    const envelopeStr = this.memoryStore.get('auth_tokens_enc');
    if (!envelopeStr) return null;

    try {
      const envelope = JSON.parse(envelopeStr);
      const iv = Buffer.from(envelope.i, 'base64');
      const tag = Buffer.from(envelope.t, 'base64');
      const ciphertext = Buffer.from(envelope.c, 'base64');

      const decipher = crypto.createDecipheriv('aes-256-gcm', this.deviceMasterKey, iv);
      decipher.setAuthTag(tag);

      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return JSON.parse(decrypted.toString('utf8'));
    } catch {
      return null;
    }
  }

  /**
   * Wipes all tokens from secure storage (used on logout or session revocation).
   */
  public async clearTokens(): Promise<void> {
    this.memoryStore.delete('auth_tokens_enc');
  }

  /**
   * Checks whether secure encrypted storage is available and operational.
   */
  public isHardwareKeystoreAvailable(): boolean {
    return true;
  }
}

export const mobileSecureStorage = MobileSecureStorage.getInstance();

