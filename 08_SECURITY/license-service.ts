import crypto from 'node:crypto';
import os from 'node:os';

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvIfOhVG2ht8Xm8370MMB
AqU9PNKu3LRfWMx/C55vgVw+8kpmr8Gb/ceGE9mZnJws6q8C76NgoVMGCHVnv02M
9qSwFiOgaFXNV7uq/zv/Q6X5UHmOLSZw3tZ5KhU/NYr2o3DxsV5gCzeS0t/shn+g
nEtOBFNZNN/Q23Nkwv8Z+V1t3solPIZHDkb45CI6Cqbery1bhPAVJ3Mz74BuIVW5
HqzQfiCfS6IuJ4PiJrw5HvRYChcWIcryLfBiVecsVxllz0p1g9I+zJxMNFI2n603
KlCKrGJc2FX/6CyiZRsMTxVkWb7b98DrhltmCtiZp55a1ue7TV9S/hOtxmYwJfi3
TwIDAQAB
-----END PUBLIC KEY-----`;

/**
 * Gets the unique Hardware ID (HWID) for this computer.
 * It hashes the CPU model and total memory to create a static identifier.
 */
export function getHWID(): string {
  try {
    const raw = os.cpus()[0].model + os.totalmem();
    const hash = crypto.createHash('sha256').update(raw).digest('hex').toUpperCase();
    const short = hash.substring(0, 16);
    // Format as XXXX-XXXX-XXXX-XXXX
    return `MAHI-\${short.substring(0,4)}-\${short.substring(4,8)}-\${short.substring(8,12)}-\${short.substring(12,16)}`;
  } catch (e) {
    return 'MAHI-UNKNOWN-HWID';
  }
}

/**
 * Verifies an RSA-signed license key against the HWID.
 * The key format is expected to be: base64(JSON(hwid, exp, sig))
 */
export function verifyLicense(licenseKey: string): { valid: boolean; error?: string; expiresAt?: string } {
  try {
    const decoded = Buffer.from(licenseKey, 'base64').toString('utf8');
    const data = JSON.parse(decoded);

    if (!data.hwid || !data.exp || !data.sig) {
      return { valid: false, error: 'Invalid license format' };
    }

    const currentHwid = getHWID();
    if (data.hwid !== currentHwid) {
      return { valid: false, error: 'License is not valid for this PC (HWID Mismatch)' };
    }

    if (Date.now() > data.exp) {
      return { valid: false, error: 'License has expired' };
    }

    // Verify RSA signature
    const verify = crypto.createVerify('SHA256');
    verify.update(\`\${data.hwid}:\${data.exp}\`);
    verify.end();

    const isAuthentic = verify.verify(PUBLIC_KEY, data.sig, 'base64');
    
    if (!isAuthentic) {
      return { valid: false, error: 'License signature is invalid or tampered' };
    }

    return { 
      valid: true, 
      expiresAt: new Date(data.exp).toISOString()
    };
  } catch (e) {
    return { valid: false, error: 'Invalid license key' };
  }
}
