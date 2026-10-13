import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { UpdateChannel, UpdateReleaseManifest, UpdateProgress } from '../../10_CONFIG/shared/types/updater.js';

export interface UpdateProvider {
  name: string;
  fetchManifest(channel: UpdateChannel, feedUrl?: string): Promise<UpdateReleaseManifest | null>;
  downloadFile(
    fileUrl: string,
    destinationPath: string,
    onProgress?: (progress: UpdateProgress) => void
  ): Promise<{ path: string; size: number }>;
}

/**
 * Generic HTTPS/HTTP static release feed provider.
 * Looks for manifest e.g.:
 *   {feedUrl}/latest.json
 *   {feedUrl}/latest-beta.json
 */
export class GenericHttpUpdateProvider implements UpdateProvider {
  name = 'GenericHttpUpdateProvider';

  async fetchManifest(channel: UpdateChannel, feedUrl = 'https://mahibrowser.com/update/'): Promise<UpdateReleaseManifest | null> {
    const baseUrl = feedUrl.endsWith('/') ? feedUrl : `${feedUrl}/`;
    const manifestFile = channel === 'BETA' ? 'latest-beta.json' : 'latest.json';
    const targetUrl = new URL(manifestFile, baseUrl).toString();

    return new Promise((resolve) => {
      try {
        const urlObj = new URL(targetUrl);
        const client = urlObj.protocol === 'https:' ? https : http;

        const req = client.get(
          targetUrl,
          {
            headers: {
              'User-Agent': 'MAHI-Browser-Updater/1.1.3 (Windows NT 10.0; Win64; x64)',
              Accept: 'application/json',
            },
            timeout: 10000,
          },
          (res) => {
            if (res.statusCode !== 200) {
              res.resume(); // Consume stream to free memory
              resolve(null);
              return;
            }

            let data = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
              data += chunk;
            });
            res.on('end', () => {
              try {
                const parsed = JSON.parse(data);
                resolve(parsed);
              } catch {
                resolve(null);
              }
            });
          }
        );

        req.on('timeout', () => {
          req.destroy(new Error('Update check request timed out'));
          resolve(null);
        });

        req.on('error', () => {
          resolve(null);
        });
      } catch {
        resolve(null);
      }
    });
  }

  async downloadFile(
    fileUrl: string,
    destinationPath: string,
    onProgress?: (progress: UpdateProgress) => void
  ): Promise<{ path: string; size: number }> {
    return new Promise((resolve, reject) => {
      try {
        const destDir = path.dirname(destinationPath);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }

        const tempFile = `${destinationPath}.tmp_${Date.now()}`;
        const fileStream = fs.createWriteStream(tempFile);
        const urlObj = new URL(fileUrl);
        const client = urlObj.protocol === 'https:' ? https : http;

        const startTime = Date.now();
        let transferred = 0;

        const req = client.get(
          fileUrl,
          {
            headers: {
              'User-Agent': 'MAHI-Browser-Updater/1.1.3 (Windows NT 10.0; Win64; x64)',
            },
            timeout: 60000,
          },
          (res) => {
            if (res.statusCode !== 200) {
              fileStream.close();
              try { fs.unlinkSync(tempFile); } catch {}
              reject(new Error(`Failed to download update binary. HTTP Status: ${res.statusCode}`));
              return;
            }

            const total = parseInt(res.headers['content-length'] || '0', 10);

            res.on('data', (chunk: Buffer) => {
              transferred += chunk.length;
              fileStream.write(chunk);

              if (onProgress) {
                const elapsedSec = Math.max(0.001, (Date.now() - startTime) / 1000);
                const bytesPerSecond = Math.round(transferred / elapsedSec);
                const percent = total > 0 ? Math.round((transferred / total) * 100) : 0;
                onProgress({
                  bytesPerSecond,
                  percent,
                  total,
                  transferred,
                });
              }
            });

            res.on('end', () => {
              fileStream.end(() => {
                try {
                  if (fs.existsSync(destinationPath)) {
                    fs.unlinkSync(destinationPath);
                  }
                  fs.renameSync(tempFile, destinationPath);
                  resolve({ path: destinationPath, size: transferred });
                } catch (err) {
                  reject(err);
                }
              });
            });

            res.on('error', (err) => {
              fileStream.close();
              try { fs.unlinkSync(tempFile); } catch {}
              reject(err);
            });
          }
        );

        req.on('timeout', () => {
          req.destroy(new Error('Update download request timed out'));
          fileStream.close();
          try { fs.unlinkSync(tempFile); } catch {}
          reject(new Error('Update download timed out'));
        });

        req.on('error', (err) => {
          fileStream.close();
          try { fs.unlinkSync(tempFile); } catch {}
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }
}

/**
 * Mock Update Provider for test environments and staging simulations.
 */
export class MockUpdateProvider implements UpdateProvider {
  name = 'MockUpdateProvider';
  private mockManifest: UpdateReleaseManifest | null = null;
  private mockPayload: Buffer = Buffer.from('MOCK_MAHI_BROWSER_INSTALLER_BINARY');

  setManifest(manifest: UpdateReleaseManifest | null) {
    this.mockManifest = manifest;
  }

  setPayload(payload: Buffer) {
    this.mockPayload = payload;
  }

  async fetchManifest(channel: UpdateChannel): Promise<UpdateReleaseManifest | null> {
    if (!this.mockManifest) return null;
    if (this.mockManifest.channel !== channel && channel === 'STABLE' && this.mockManifest.channel === 'BETA') {
      return null;
    }
    return JSON.parse(JSON.stringify(this.mockManifest));
  }

  async downloadFile(
    _fileUrl: string,
    destinationPath: string,
    onProgress?: (progress: UpdateProgress) => void
  ): Promise<{ path: string; size: number }> {
    const destDir = path.dirname(destinationPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    if (onProgress) {
      onProgress({
        bytesPerSecond: 1024 * 1024,
        percent: 50,
        total: this.mockPayload.length,
        transferred: Math.floor(this.mockPayload.length / 2),
      });
      onProgress({
        bytesPerSecond: 2 * 1024 * 1024,
        percent: 100,
        total: this.mockPayload.length,
        transferred: this.mockPayload.length,
      });
    }

    fs.writeFileSync(destinationPath, this.mockPayload);
    return { path: destinationPath, size: this.mockPayload.length };
  }
}

let activeProvider: UpdateProvider = new GenericHttpUpdateProvider();

export function getActiveUpdateProvider(): UpdateProvider {
  return activeProvider;
}

export function setActiveUpdateProvider(provider: UpdateProvider): void {
  activeProvider = provider;
}
