const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

function getHashes(file) {
  const buf = fs.readFileSync(file);
  return {
    size: buf.length,
    sha256: crypto.createHash('sha256').update(buf).digest('hex').toUpperCase(),
    sha512: crypto.createHash('sha512').update(buf).digest('base64'),
    sha512Hex: crypto.createHash('sha512').update(buf).digest('hex')
  };
}

const setupFile = path.join(__dirname, 'release', 'MAHI-Browser-Setup-1.1.7.exe');
const portableFile = path.join(__dirname, 'release', 'MAHI-Browser-Portable-1.1.7.exe');

const setupH = getHashes(setupFile);
const portH = getHashes(portableFile);

console.log('Setup File Size:', setupH.size, 'SHA256:', setupH.sha256);
console.log('Portable File Size:', portH.size, 'SHA256:', portH.sha256);

// Update release/latest.json
const latestJsonPath = path.join(__dirname, 'release', 'latest.json');
const latestJson = {
  version: '1.1.7',
  releaseDate: new Date().toISOString(),
  channel: 'STABLE',
  minAppVersion: '1.0.0',
  mandatory: false,
  releaseNotes: "MAHI Browser v1.1.7: Safe Browser Extension Installation & Bidirectional Sync. Fixes 'Installation is not enabled' error on Chrome Web Store pages (e.g. Urban VPN Proxy) by eliminating --disable-extensions-except flag, implements modern CRX3 download and unpacking protocol, and provides bidirectional extension discovery and management.",
  sha256: setupH.sha256,
  sha512: setupH.sha512Hex,
  files: [
    {
      name: 'MAHI-Browser-Portable-1.1.7.exe',
      url: 'https://mahibrowser.com/update/MAHI-Browser-Portable-1.1.7.exe',
      size: portH.size,
      sha256: portH.sha256,
      sha512: portH.sha512Hex,
      arch: 'x64'
    },
    {
      name: 'MAHI-Browser-Setup-1.1.7.exe',
      url: 'https://mahibrowser.com/download/setup',
      size: setupH.size,
      sha256: setupH.sha256,
      sha512: setupH.sha512Hex,
      arch: 'x64'
    },
    {
      name: 'MAHI-Browser-Setup-1.1.7.exe',
      url: 'https://mahibrowser.com/update/MAHI-Browser-Setup-1.1.7.exe',
      size: setupH.size,
      sha256: setupH.sha256,
      sha512: setupH.sha512Hex,
      arch: 'x64'
    }
  ]
};

fs.writeFileSync(latestJsonPath, JSON.stringify(latestJson, null, 2));

// Update release/latest.yml
const latestYmlPath = path.join(__dirname, 'release', 'latest.yml');
const ymlContent = 
`version: 1.1.7
files:
  - url: MAHI-Browser-Setup-1.1.7.exe
    sha512: ${setupH.sha512}
    size: ${setupH.size}
path: MAHI-Browser-Setup-1.1.7.exe
sha512: ${setupH.sha512}
releaseDate: '${new Date().toISOString()}'
`;
fs.writeFileSync(latestYmlPath, ymlContent);
console.log('latest.json and latest.yml successfully updated!');
