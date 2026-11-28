import fs from 'node:fs';
import path from 'node:path';

export interface FakeVideoCaptureConfig {
  enable?: boolean;
  filePath?: string;
  loop?: boolean;
}

export interface VideoCaptureArgs {
  flags: string[];
  isValid: boolean;
  resolvedPath?: string;
  error?: string;
}

/**
 * Builds Chromium command line flags for injecting a virtual camera feed into MAHI Browser.
 * Step 4 provides hybrid flags and profile preferences awaiting Step 5 custom C++ camera hooks.
 *
 * Used for facial KYC verification testing, synthetic video streams, and automated media tests.
 */
export function buildVideoCaptureFlags(config?: FakeVideoCaptureConfig): VideoCaptureArgs {
  if (!config?.enable || !config.filePath) {
    return {
      flags: [],
      isValid: false,
    };
  }

  const resolved = path.resolve(config.filePath);
  if (!fs.existsSync(resolved)) {
    return {
      flags: [],
      isValid: false,
      error: `Video capture file not found at: ${resolved}`,
    };
  }

  const ext = path.extname(resolved).toLowerCase();
  const validExtensions = ['.y4m', '.mjpeg', '.mp4', '.mkv'];
  if (!validExtensions.includes(ext)) {
    return {
      flags: [],
      isValid: false,
      error: `Unsupported video capture format ${ext}. Expected .y4m, .mjpeg, or .mp4`,
    };
  }

  // Chromium native fake video capture flags
  const flags = [
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-video-capture=${resolved}`,
  ];

  return {
    flags,
    isValid: true,
    resolvedPath: resolved,
  };
}
