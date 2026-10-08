/**
 * MAHI BROWSER — macOS Developer ID Signing, Hardened Runtime & Notarization Pipeline
 * Batch P0-D Architecture
 *
 * Implements:
 * - Apple Developer ID Application Signing
 * - macOS Hardened Runtime (--options runtime) with entitlements
 * - App Store Connect Notarytool submission & verification
 * - Apple Ticket Stapling (xcrun stapler staple)
 * - Gatekeeper verification (spctl --assess --type execute)
 * - Honest Advisory Gate: If credentials unset, reports CONFIGURED / CREDENTIALS REQUIRED
 *
 * NEVER commit private keys (.p12, .p8), passwords, or App Store Connect secrets.
 */

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

exports.default = async function signMac(context) {
  const { appOutDir } = context;
  const appPath = path.join(appOutDir, 'MAHI BROWSER.app');

  const appleCert = process.env.CSC_LINK || process.env.MAC_CSC_LINK;
  const certPassword = process.env.CSC_KEY_PASSWORD || process.env.MAC_CSC_KEY_PASSWORD;
  const appleId = process.env.APPLE_ID;
  const applePassword = process.env.APPLE_APP_SPECIFIC_PASSWORD || process.env.APPLE_PASSWORD;
  const appleTeamId = process.env.APPLE_TEAM_ID;

  const apiKey = process.env.APPLE_API_KEY;
  const apiIssuer = process.env.APPLE_API_ISSUER;
  const apiKeyId = process.env.APPLE_API_KEY_ID;

  // 1. Production macOS Signing & Notarization Gate
  if (appleCert && certPassword && (applePassword || apiKey)) {
    console.log(`[macOS:PRODUCTION] Beginning Developer ID Application signing and notarization for ${appPath}`);
    try {
      const entitlements = path.join(__dirname, '..', '13_ASSETS', 'resources', 'entitlements.mac.plist');

      // A. Deep code sign with hardened runtime
      const signCmd = `codesign --deep --force --options runtime --entitlements "${entitlements}" --sign "Developer ID Application" "${appPath}"`;
      console.log(`[macOS:PRODUCTION] Executing: ${signCmd}`);
      execSync(signCmd, { stdio: 'inherit' });

      // B. Notarize with Apple Notarytool
      let notaryCmd = '';
      if (apiKey && apiIssuer && apiKeyId) {
        notaryCmd = `xcrun notarytool submit "${appPath}" --key "${apiKey}" --key-id "${apiKeyId}" --issuer "${apiIssuer}" --wait`;
      } else {
        notaryCmd = `xcrun notarytool submit "${appPath}" --apple-id "${appleId}" --password "${applePassword}" --team-id "${appleTeamId}" --wait`;
      }

      console.log(`[macOS:PRODUCTION] Submitting to Apple Notary Service...`);
      execSync(notaryCmd, { stdio: 'inherit' });

      // C. Staple notarization ticket
      console.log(`[macOS:PRODUCTION] Stapling ticket to application...`);
      execSync(`xcrun stapler staple "${appPath}"`, { stdio: 'inherit' });

      // D. Verify with Gatekeeper
      console.log(`[macOS:PRODUCTION] Verifying Gatekeeper compliance...`);
      execSync(`spctl --assess --type execute --verbose "${appPath}"`, { stdio: 'inherit' });

      console.log(`[macOS:PRODUCTION] Successfully signed, notarized, and stapled MAHI BROWSER for macOS.`);
      return;
    } catch (err) {
      console.error(`[macOS:ERROR] Code signing or notarization failed: ${err.message}`);
      throw err;
    }
  }

  // 2. Development / Staging Advisory Mode
  console.log(
    `[macOS:CONFIGURED] No Apple Developer ID or Notarization credentials found in environment. ` +
    `Skipping notarization step for ${appPath}. ` +
    `STATUS: PRODUCTION SIGNING AND NOTARIZATION CREDENTIAL REQUIRED.`
  );
};
