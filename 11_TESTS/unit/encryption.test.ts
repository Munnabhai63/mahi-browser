import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  encryptData,
  decryptData,
  deriveKeyFromPassword,
  hashPin,
  verifyPin,
} from '../../08_SECURITY/encryption.js';

describe('Encryption & Security Engine', () => {
  it('should encrypt and decrypt plaintext using AES-256-GCM', () => {
    const plainText = 'SuperSecretProxyPassword123!';
    const cipherText = encryptData(plainText);

    expect(cipherText).toBeDefined();
    expect(cipherText).not.toEqual(plainText);
    expect(cipherText.split(':')).toHaveLength(3); // iv:authTag:payload

    const decrypted = decryptData(cipherText);
    expect(decrypted).toEqual(plainText);
  });

  it('should encrypt and decrypt using a password-derived key', () => {
    const password = 'UserMasterPassword2026';
    const salt = crypto.randomBytes(16);
    const key = deriveKeyFromPassword(password, salt);

    const sensitiveData = JSON.stringify({ token: 'xyz123', cookies: ['c1', 'c2'] });
    const encrypted = encryptData(sensitiveData, key);

    const decrypted = decryptData(encrypted, key);
    expect(decrypted).toEqual(sensitiveData);
  });

  it('should fail decryption if an incorrect key is provided', () => {
    const key1 = deriveKeyFromPassword('password123', crypto.randomBytes(16));
    const key2 = deriveKeyFromPassword('wrongpassword', crypto.randomBytes(16));

    const cipherText = encryptData('classified data', key1);
    expect(() => decryptData(cipherText, key2)).toThrow();
  });

  it('should hash PIN with salt and verify correctly', () => {
    const pin = '8492';
    const { hash, salt } = hashPin(pin);

    expect(hash).toBeDefined();
    expect(salt).toBeDefined();
    expect(verifyPin(pin, hash, salt)).toBe(true);
    expect(verifyPin('0000', hash, salt)).toBe(false);
  });
});
