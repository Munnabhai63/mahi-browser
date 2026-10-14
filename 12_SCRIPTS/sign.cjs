/**
 * MAHI BROWSER — Windows Authenticode Signing Pipeline
 * 
 * Supports secure CI/CD signing via environment variables:
 * - WIN_CSC_LINK or CSC_LINK (Path to PKCS#12 / PFX certificate or base64 data)
 * - WIN_CSC_KEY_PASSWORD or CSC_KEY_PASSWORD (Password for certificate)
 * - SIGNTOOL_PATH (Optional path to signtool.exe)
 * 
 * If credentials are not present, operates in development mode and outputs
 * honest notice: [Authenticode:CONFIGURED] PRODUCTION CODE SIGNING CREDENTIAL REQUIRED.
 */

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function resolveSigntool() {
  if (process.env.SIGNTOOL_PATH && fs.existsSync(process.env.SIGNTOOL_PATH)) {
    return process.env.SIGNTOOL_PATH;
  }
  const defaultKits = [
    'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.19041.0\\x64\\signtool.exe',
    'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.22621.0\\x64\\signtool.exe',
    'C:\\Program Files (x86)\\Windows Kits\\10\\App Certification Kit\\signtool.exe',
  ];
  for (const p of defaultKits) {
    if (fs.existsSync(p)) return p;
  }
  return 'signtool.exe';
}

exports.default = async function sign(configuration) {
  const targetPath = configuration.path;
  const certPath = process.env.WIN_CSC_LINK || process.env.CSC_LINK;
  const certPassword = process.env.WIN_CSC_KEY_PASSWORD || process.env.CSC_KEY_PASSWORD;
  const certThumbprint = process.env.CERT_THUMBPRINT || process.env.WIN_CERT_THUMBPRINT;

  if (!targetPath) {
    return;
  }

  const signtool = resolveSigntool();
  const timestampServer = process.env.TIMESTAMP_SERVER || 'http://timestamp.digicert.com';

  // 1A. Production Hardware Token / Certificate Store Mode (FIPS 140-2 USB Dongle / Cloud HSM)
  if (certThumbprint) {
    console.log(`[Authenticode:PRODUCTION:HARDWARE_TOKEN] Signing artifact: ${path.basename(targetPath)}`);
    try {
      const cmd = `"${signtool}" sign /sha1 "${certThumbprint}" /fd sha256 /d "MAHI Browser — By Munna Bhai" /du "https://mahibrowser.com" /tr "${timestampServer}" /td sha256 "${targetPath}"`;
      execSync(cmd, { stdio: 'inherit' });
      console.log(`[Authenticode:PRODUCTION] Successfully signed with Authenticode token: ${path.basename(targetPath)}`);
      return;
    } catch (err) {
      console.error(`[Authenticode:ERROR] Signtool token signing failed: ${err.message}`);
      throw err;
    }
  }

  // 1B. Production PFX File Mode
  if (certPath && fs.existsSync(certPath) && certPassword) {
    console.log(`[Authenticode:PRODUCTION:PFX] Signing artifact: ${path.basename(targetPath)}`);
    try {
      const cmd = `"${signtool}" sign /f "${certPath}" /p "${certPassword}" /fd sha256 /d "MAHI Browser — By Munna Bhai" /du "https://mahibrowser.com" /tr "${timestampServer}" /td sha256 "${targetPath}"`;
      execSync(cmd, { stdio: 'inherit' });
      console.log(`[Authenticode:PRODUCTION] Successfully signed with Authenticode PFX: ${path.basename(targetPath)}`);
      return;
    } catch (err) {
      console.error(`[Authenticode:ERROR] Signtool PFX signing failed: ${err.message}`);
      throw err;
    }
  }

  // 2. Development / Staging mode: Informative advisory without breaking build
  console.log(
    `[Authenticode:CONFIGURED] No code signing certificate found in environment (WIN_CSC_LINK / CERT_THUMBPRINT). ` +
    `Skipping binary signing for: ${path.basename(targetPath)}. ` +
    `STATUS: PRODUCTION CODE SIGNING CREDENTIAL REQUIRED.`
  );
};
