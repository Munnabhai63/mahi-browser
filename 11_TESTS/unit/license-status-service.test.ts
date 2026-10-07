import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  verifyStatusSignature,
  getOnlineStatusSummary
} from '../../08_SECURITY/license-status-service.js';

// Generate ephemeral test RSA-2048 keypair dynamically so no private keys are committed
const { publicKey: testPublicKey, privateKey: testPrivateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

function signTestPayload(hwid: string, status: string, expires_at: string | null, server_time: number): string {
  const canonical = `${hwid}:${status}:${expires_at || ''}:${server_time}`;
  const sign = crypto.createSign('SHA256');
  sign.update(canonical);
  sign.end();
  return sign.sign(testPrivateKey, 'base64');
}

describe('License Status Service Unit Tests', () => {
  it('should verify authentic RSA-SHA256 status signature', () => {
    const hwid = 'MAHI-TEST-UNIT-1234';
    const status = 'active';
    const expires_at = '2027-10-07T00:00:00.000Z';
    const server_time = 1775535000000;

    const sig = signTestPayload(hwid, status, expires_at, server_time);
    const isValid = verifyStatusSignature({ hwid, status, expires_at, server_time }, sig, testPublicKey);

    expect(isValid).toBe(true);
  });

  it('should reject tampered status payload', () => {
    const hwid = 'MAHI-TEST-UNIT-1234';
    const status = 'active';
    const expires_at = '2027-10-07T00:00:00.000Z';
    const server_time = 1775535000000;

    const sig = signTestPayload(hwid, status, expires_at, server_time);

    // Tamper the status to 'revoked' without re-signing
    const isTamperedValid = verifyStatusSignature(
      { hwid, status: 'revoked', expires_at, server_time },
      sig,
      testPublicKey
    );

    expect(isTamperedValid).toBe(false);
  });

  it('should reject forged or corrupted signature', () => {
    const hwid = 'MAHI-TEST-UNIT-1234';
    const status = 'active';
    const expires_at = '2027-10-07T00:00:00.000Z';
    const server_time = 1775535000000;

    const invalidSig = Buffer.from('fake-signature-bytes').toString('base64');
    const isValid = verifyStatusSignature({ hwid, status, expires_at, server_time }, invalidSig, testPublicKey);

    expect(isValid).toBe(false);
  });

  it('should provide informative summary when no cache exists', () => {
    const summary = getOnlineStatusSummary();
    expect(summary).toHaveProperty('verified');
    expect(summary).toHaveProperty('revoked');
    expect(summary).toHaveProperty('graceExpired');
    expect(summary).toHaveProperty('statusText');
  });
});
