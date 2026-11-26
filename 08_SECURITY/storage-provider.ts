import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getWritableSubdir } from '../07_BACKEND/utils/runtime-paths.js';
import { getInstallSecrets } from './install-secrets.js';

export interface ObjectStorageProvider {
  name: string;
  createUploadUrl(objectKey: string, contentType?: string, expiresInSec?: number): Promise<string>;
  createDownloadUrl(objectKey: string, expiresInSec?: number): Promise<string>;
  createDeleteUrl?(objectKey: string, expiresInSec?: number): Promise<string>;
  createHeadUrl?(objectKey: string, expiresInSec?: number): Promise<string>;
  deleteObject(objectKey: string): Promise<boolean>;
  headObject(objectKey: string): Promise<{ exists: boolean; size: number; checksum?: string } | null>;
  putObject(objectKey: string, data: Buffer, contentType?: string): Promise<{ success: boolean; size: number }>;
  getObject(objectKey: string): Promise<Buffer | null>;
  verifyStorageConnectivity(): Promise<{ connected: boolean; provider: string; message: string }>;
  isProductionReady(): boolean;
}

// Secret key used to sign URLs in LocalStorageProvider
function getLocalStorageSecret(): string {
  if (process.env.LOCAL_STORAGE_SECRET) {
    return process.env.LOCAL_STORAGE_SECRET;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: LOCAL_STORAGE_SECRET must be explicitly configured in production environment.');
  }
  try {
    return getInstallSecrets().jwtSecret;
  } catch {
    return 'mahi-dev-local-storage-secret-key-32b-fallback';
  }
}

export class LocalStorageProvider implements ObjectStorageProvider {
  public name = 'local-storage';
  private storageDir: string;
  private baseUrl: string;

  constructor(options?: { storageDir?: string; baseUrl?: string }) {
    this.storageDir = options?.storageDir || getWritableSubdir('cloud_storage');
    this.baseUrl = options?.baseUrl || (process.env.COMMERCIAL_API_URL || 'http://127.0.0.1:8989');

    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  isProductionReady(): boolean {
    return false;
  }

  private resolveFilePath(objectKey: string): string {
    if (!objectKey || typeof objectKey !== 'string' || objectKey.includes('\0')) {
      throw new Error('Invalid storage object key');
    }
    const normalized = objectKey.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalized) {
      throw new Error('Empty storage object key');
    }
    const rootDir = path.resolve(this.storageDir);
    const resolved = path.resolve(rootDir, normalized);
    if (resolved !== rootDir && !resolved.startsWith(rootDir + path.sep)) {
      throw new Error(`Invalid object key outside storage root: ${objectKey}`);
    }
    if (resolved === rootDir) {
      throw new Error('Object key cannot resolve to storage root');
    }
    return resolved;
  }

  private generateToken(objectKey: string, action: 'upload' | 'download' | 'delete', expiresAt: number): string {
    const payload = `${action}:${objectKey}:${expiresAt}`;
    return crypto.createHmac('sha256', getLocalStorageSecret()).update(payload).digest('hex');
  }

  public verifyToken(objectKey: string, action: 'upload' | 'download' | 'delete', expiresAt: number, signature: string): boolean {
    if (!signature || Date.now() > expiresAt) return false;
    const expected = this.generateToken(objectKey, action, expiresAt);
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  }

  async createUploadUrl(objectKey: string, contentType = 'application/octet-stream', expiresInSec = 900): Promise<string> {
    const expiresAt = Date.now() + (expiresInSec * 1000);
    const token = this.generateToken(objectKey, 'upload', expiresAt);
    return `${this.baseUrl}/api/v1/storage/upload?key=${encodeURIComponent(objectKey)}&expires=${expiresAt}&token=${token}&type=${encodeURIComponent(contentType)}`;
  }

  async createDownloadUrl(objectKey: string, expiresInSec = 900): Promise<string> {
    const expiresAt = Date.now() + (expiresInSec * 1000);
    const token = this.generateToken(objectKey, 'download', expiresAt);
    return `${this.baseUrl}/api/v1/storage/download?key=${encodeURIComponent(objectKey)}&expires=${expiresAt}&token=${token}`;
  }

  async createDeleteUrl(objectKey: string, expiresInSec = 900): Promise<string> {
    const expiresAt = Date.now() + (expiresInSec * 1000);
    const token = this.generateToken(objectKey, 'delete', expiresAt);
    return `${this.baseUrl}/api/v1/storage/delete?key=${encodeURIComponent(objectKey)}&expires=${expiresAt}&token=${token}`;
  }

  async deleteObject(objectKey: string): Promise<boolean> {
    const fullPath = this.resolveFilePath(objectKey);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  async headObject(objectKey: string): Promise<{ exists: boolean; size: number; checksum?: string } | null> {
    const fullPath = this.resolveFilePath(objectKey);
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    try {
      const stat = fs.statSync(fullPath);
      const data = fs.readFileSync(fullPath);
      const checksum = crypto.createHash('sha256').update(data).digest('hex');
      return { exists: true, size: stat.size, checksum };
    } catch {
      return null;
    }
  }

  async putObject(objectKey: string, data: Buffer, _contentType = 'application/octet-stream'): Promise<{ success: boolean; size: number }> {
    const fullPath = this.resolveFilePath(objectKey);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(fullPath, data);
    return { success: true, size: data.length };
  }

  async getObject(objectKey: string): Promise<Buffer | null> {
    const fullPath = this.resolveFilePath(objectKey);
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    return fs.readFileSync(fullPath);
  }

  async verifyStorageConnectivity(): Promise<{ connected: boolean; provider: string; message: string }> {
    const exists = fs.existsSync(this.storageDir);
    return {
      connected: exists,
      provider: this.name,
      message: exists ? `Local storage directory accessible at ${this.storageDir}` : `Storage directory not accessible`,
    };
  }
}

export interface BucketSecurityPolicy {
  bucket: string;
  isPrivateOnly: boolean;
  blockPublicAccess: {
    blockPublicAcls: boolean;
    ignorePublicAcls: boolean;
    blockPublicPolicy: boolean;
    restrictPublicBuckets: boolean;
  };
  serverSideEncryption: 'AES256' | 'aws:kms';
  cors: {
    allowedOrigins: string[];
    allowedMethods: string[];
    allowedHeaders: string[];
    maxAgeSeconds: number;
  };
  lifecycle: {
    noncurrentVersionExpirationDays: number;
    abortIncompleteMultipartUploadDays: number;
  };
}

export class S3R2StorageProvider implements ObjectStorageProvider {
  public name = 's3-r2';
  public bucket: string;
  public endpoint: string;
  public accessKeyId: string;
  public secretAccessKey: string;
  public region: string;
  private s3Client: S3Client;

  constructor(options?: {
    bucket?: string;
    endpoint?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    region?: string;
  }) {
    this.bucket = options?.bucket || process.env.R2_BUCKET || process.env.AWS_S3_BUCKET || 'mahi-profiles';
    this.endpoint = options?.endpoint || process.env.R2_ENDPOINT || process.env.AWS_ENDPOINT || (
      process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : 'https://s3.amazonaws.com'
    );
    this.accessKeyId = options?.accessKeyId || process.env.R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID || '';
    this.secretAccessKey = options?.secretAccessKey || process.env.R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY || '';
    this.region = options?.region || process.env.AWS_REGION || 'auto';

    const isProduction = process.env.NODE_ENV === 'production' || process.env.STORAGE_ENFORCE_PRODUCTION === 'true';
    if (isProduction && (!this.accessKeyId || !this.secretAccessKey)) {
      throw new Error('S3_R2_CONFIG_INVALID: Cloud storage access key ID and secret access key are required in production.');
    }

    const credentials = (this.accessKeyId && this.secretAccessKey)
      ? {
          accessKeyId: this.accessKeyId,
          secretAccessKey: this.secretAccessKey,
        }
      : {
          accessKeyId: this.accessKeyId || 'mock-access-key',
          secretAccessKey: this.secretAccessKey || 'mock-secret-key',
        };

    this.s3Client = new S3Client({
      endpoint: this.endpoint,
      region: this.region,
      forcePathStyle: true,
      credentials,
    });
  }

  public isProductionReady(): boolean {
    return Boolean(this.accessKeyId && this.secretAccessKey && this.bucket && this.endpoint);
  }

  public getSecurityPolicy(): BucketSecurityPolicy {
    return {
      bucket: this.bucket,
      isPrivateOnly: true,
      blockPublicAccess: {
        blockPublicAcls: true,
        ignorePublicAcls: true,
        blockPublicPolicy: true,
        restrictPublicBuckets: true,
      },
      serverSideEncryption: 'AES256',
      cors: {
        allowedOrigins: ['https://app.mahibrowser.com', 'https://admin.mahibrowser.com'],
        allowedMethods: ['GET', 'PUT', 'HEAD', 'DELETE'],
        allowedHeaders: ['*'],
        maxAgeSeconds: 3600,
      },
      lifecycle: {
        noncurrentVersionExpirationDays: 30,
        abortIncompleteMultipartUploadDays: 7,
      },
    };
  }

  public static isPresignedUrlExpired(urlStr: string): boolean {
    try {
      const u = new URL(urlStr);
      const amzDate = u.searchParams.get('X-Amz-Date');
      const expiresInSec = parseInt(u.searchParams.get('X-Amz-Expires') || '0', 10);
      if (!amzDate || !expiresInSec) return true;

      // amzDate format: YYYYMMDDTHHMMSSZ
      const y = parseInt(amzDate.substring(0, 4), 10);
      const m = parseInt(amzDate.substring(4, 6), 10) - 1;
      const d = parseInt(amzDate.substring(6, 8), 10);
      const h = parseInt(amzDate.substring(9, 11), 10);
      const min = parseInt(amzDate.substring(11, 13), 10);
      const s = parseInt(amzDate.substring(13, 15), 10);

      const requestTime = Date.UTC(y, m, d, h, min, s);
      const expiryTime = requestTime + expiresInSec * 1000;
      return Date.now() > expiryTime;
    } catch {
      return true;
    }
  }

  async createUploadUrl(objectKey: string, contentType = 'application/octet-stream', expiresInSec = 900): Promise<string> {
    const cleanKey = objectKey.startsWith('/') ? objectKey.substring(1) : objectKey;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: cleanKey,
      ContentType: contentType,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn: expiresInSec });
  }

  async createDownloadUrl(objectKey: string, expiresInSec = 900): Promise<string> {
    const cleanKey = objectKey.startsWith('/') ? objectKey.substring(1) : objectKey;
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: cleanKey,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn: expiresInSec });
  }

  async createDeleteUrl(objectKey: string, expiresInSec = 900): Promise<string> {
    const cleanKey = objectKey.startsWith('/') ? objectKey.substring(1) : objectKey;
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: cleanKey,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn: expiresInSec });
  }

  async createHeadUrl(objectKey: string, expiresInSec = 900): Promise<string> {
    const cleanKey = objectKey.startsWith('/') ? objectKey.substring(1) : objectKey;
    const command = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: cleanKey,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn: expiresInSec });
  }

  async deleteObject(objectKey: string): Promise<boolean> {
    try {
      const deleteUrl = await this.createDeleteUrl(objectKey, 300);
      const res = await fetch(deleteUrl, {
        method: 'DELETE',
      });
      return res.status >= 200 && res.status < 300;
    } catch {
      return false;
    }
  }

  async verifyStorageConnectivity(): Promise<{ connected: boolean; provider: string; message: string }> {
    if (!this.accessKeyId || !this.secretAccessKey) {
      return {
        connected: false,
        provider: this.name,
        message: 'Missing S3/R2 access credentials',
      };
    }
    try {
      const probeUrl = await this.createHeadUrl('.connectivity-probe', 60);
      const res = await fetch(probeUrl, { method: 'HEAD' });
      const connected = res.status === 200 || res.status === 404;
      return {
        connected,
        provider: this.name,
        message: connected ? `Connected to ${this.bucket} on ${this.endpoint}` : `Storage returned HTTP ${res.status}`,
      };
    } catch (err: any) {
      return {
        connected: false,
        provider: this.name,
        message: err?.message || 'Storage connection failed',
      };
    }
  }

  async headObject(objectKey: string): Promise<{ exists: boolean; size: number; checksum?: string } | null> {
    try {
      const headUrl = await this.createHeadUrl(objectKey, 300);
      const res = await fetch(headUrl, { method: 'HEAD' });
      if (res.status === 200) {
        const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
        const etag = res.headers.get('etag')?.replace(/"/g, '') || undefined;
        return { exists: true, size: contentLength, checksum: etag };
      }
      return null;
    } catch {
      return null;
    }
  }

  async putObject(objectKey: string, data: Buffer, contentType = 'application/octet-stream'): Promise<{ success: boolean; size: number }> {
    const uploadUrl = await this.createUploadUrl(objectKey, contentType, 300);
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: new Uint8Array(data),
    });
    return { success: res.ok, size: data.length };
  }

  async getObject(objectKey: string): Promise<Buffer | null> {
    try {
      const downloadUrl = await this.createDownloadUrl(objectKey, 300);
      const res = await fetch(downloadUrl);
      if (!res.ok) return null;
      const arr = await res.arrayBuffer();
      return Buffer.from(arr);
    } catch {
      return null;
    }
  }
}

let activeStorageProvider: ObjectStorageProvider | null = null;

export function getStorageProvider(): ObjectStorageProvider {
  if (activeStorageProvider) {
    return activeStorageProvider;
  }

  // Explicit provider override via STORAGE_PROVIDER environment variable
  const explicitProvider = (process.env.STORAGE_PROVIDER || '').toLowerCase();
  if (explicitProvider === 'local') {
    activeStorageProvider = new LocalStorageProvider();
    return activeStorageProvider;
  }
  if (explicitProvider === 's3-r2' || explicitProvider === 'r2' || explicitProvider === 's3') {
    activeStorageProvider = new S3R2StorageProvider();
    return activeStorageProvider;
  }

  // Detect Cloudflare R2 / AWS S3 credentials
  const hasR2 = (process.env.R2_ACCESS_KEY || process.env.R2_ACCESS_KEY_ID) && (process.env.R2_SECRET_KEY || process.env.R2_SECRET_ACCESS_KEY);
  const hasS3 = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;

  if (hasR2 || hasS3) {
    activeStorageProvider = new S3R2StorageProvider();
  } else {
    const isProduction = process.env.NODE_ENV === 'production' || process.env.STORAGE_ENFORCE_PRODUCTION === 'true';
    if (isProduction) {
      throw new Error(
        'PRODUCTION_STORAGE_UNAVAILABLE: Cloud Object Storage credentials (R2/S3) are unset in production environment. Refusing silent fallback to local disk.'
      );
    }
    activeStorageProvider = new LocalStorageProvider();
  }

  return activeStorageProvider;
}

export function setStorageProviderForTest(provider: ObjectStorageProvider | null): void {
  activeStorageProvider = provider;
}
