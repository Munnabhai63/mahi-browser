import crypto from 'node:crypto';
import os from 'node:os';

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzYel0Zuz0vYdzszLm2z5
GYRR+UzBtP93VVNaKGmEa81Ga8hQfO2GRAXoCRkwMLUEjByolGP5btsJUndjU6/9
xnHYPzjC+GfUKIAaJvxAz41YfzOfjnMCEt709LyPBoLDwwKo8c0feuo12pYvYWqB
hSMo402RGa2nXrYV6u2PHPk0MWkB4MivQTZ7zq932rzNiXihh8kWjDBkSruNfBnd
GqF3h6MISV3mHoO3AXSwD2PYWKhkljkOp4W/VfypOBXnoU6bKhMthPs/1fAISyH3
dGocQFs1hIUa/8KolAFRcoORmpBdOcVDdcwGvsoE6JIBgHy7kPlFOMJHUcVd7bPT
kQIDAQAB
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
    return `MAHI-${short.substring(0,4)}-${short.substring(4,8)}-${short.substring(8,12)}-${short.substring(12,16)}`;
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
    let raw = (licenseKey || '').trim();
    if (raw.startsWith('MAHI-')) {
      raw = raw.substring(5);
    }
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
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
    verify.update(`${data.hwid}:${data.exp}`);
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
