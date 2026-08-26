import fs from 'node:fs';
import path from 'node:path';

export interface ProxyAuthExtensionOptions {
  profileDir: string;
  protocol: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
}

/**
 * Generates an unpacked Chrome Extension in the profile's directory
 * that uses chrome.webRequest.onAuthRequired to authenticate
 * the proxy automatically before any webpage loads.
 * This completely eliminates the native Chromium authentication popup.
 */
export function generateProxyAuthExtension(options: ProxyAuthExtensionOptions): string | null {
  if (!options.username || !options.password) {
    return null;
  }

  const extDir = path.join(options.profileDir, '_mahi_proxy_auth');
  if (!fs.existsSync(extDir)) {
    fs.mkdirSync(extDir, { recursive: true });
  }

  const manifest = {
    version: '1.0.0',
    manifest_version: 2,
    name: 'Mahi Browser Proxy Authenticator',
    description: 'Auto-authenticates proxy for Mahi Browser profiles',
    permissions: [
      'webRequest',
      'webRequestBlocking',
      '<all_urls>',
    ],
    background: {
      scripts: ['background.js'],
      persistent: true,
    },
    minimum_chrome_version: '22.0.0',
  };

  const escapedUser = JSON.stringify(options.username);
  const escapedPass = JSON.stringify(options.password);

  const backgroundJs = `// Mahi Browser Auto-Proxy Authenticator
chrome.webRequest.onAuthRequired.addListener(
  function(details) {
    return {
      authCredentials: {
        username: ${escapedUser},
        password: ${escapedPass}
      }
    };
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);
`;

  fs.writeFileSync(path.join(extDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
  fs.writeFileSync(path.join(extDir, 'background.js'), backgroundJs, 'utf-8');

  return extDir;
}
