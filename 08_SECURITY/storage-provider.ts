import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

export interface ObjectStorageProvider {
  name: string;
  createUploadUrl(objectKey: string, contentType?: string, expiresInSec?: number): Promise<string>;
  createDownloadUrl(objectKey: string, expiresInSec?: number): Promise<string>;
  deleteObject(objectKey: string): Promise<boolean>;
  headObject(objectKey: string): Promise<{ exists: boolean; size: number; checksum?: string } | null>;
  putObject(objectKey: string, data: Buffer, contentType?: string): Promise<{ success: boolean; size: number }>;
  getObject(objectKey: string): Promise<Buffer | null>;
}

// Secret key used to sign URLs in LocalStorageProvider
const LOCAL_STORAGE_SECRET = process.env.LOCAL_STORAGE_SECRET || 'mahi-local-storage-secret-key-32b-secure';

export class LocalStorageProvider implements ObjectStorageProvider {
  public name = 'local-storage';
  private storageDir: string;
  private baseUrl: string;

  constructor(options?: { storageDir?: string; baseUrl?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), '.mahi_data', 'cloud_storage');
    this.baseUrl = options?.baseUrl || (process.env.COMMERCIAL_API_URL || 'http://127.0.0.1:8989');

    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private resolveFilePath(objectKey: string): string {
    // Prevent directory traversal
    const safeKey = objectKey.replace(/\\/g, '/').replace(/\.\./g, '');
    return path.join(this.storageDir, safeKey);
  }

  private generateToken(objectKey: string, action: 'upload' | 'download', expiresAt: number): string {
    const payload = `${action}:${objectKey}:${expiresAt}`;
    return crypto.createHmac('sha256', LOCAL_STORAGE_SECRET).update(payload).digest('hex');
  }

  public verifyToken(objectKey: string, action: 'upload' | 'download', expiresAt: number, signature: string): boolean {
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
}

export class S3R2StorageProvider implements ObjectStorageProvider {
  public name = 's3-r2';
  private bucket: string;
  private endpoint: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private region: string;

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
  }

  // Generate AWS SigV4 Presigned URL
  private generateSigV4Url(method: 'GET' | 'PUT', objectKey: string, contentType?: string, expiresInSec = 900): string {
    const endpointUrl = new URL(this.endpoint);
    const host = endpointUrl.host;
    const cleanKey = objectKey.startsWith('/') ? objectKey.substring(1) : objectKey;
    const path = `/${this.bucket}/${cleanKey}`;
    
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);

    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;

    const queryParams: Record<string, string> = {
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${this.accessKeyId}/${credentialScope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': expiresInSec.toString(),
      'X-Amz-SignedHeaders': 'host' + (method === 'PUT' && contentType ? ';content-type' : ''),
    };

    const canonicalQueryString = Object.keys(queryParams)
      .sort()
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
      .join('&');

    let canonicalHeaders = `host:${host}\n`;
    if (method === 'PUT' && contentType) {
      canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`;
    }

    const signedHeaders = method === 'PUT' && contentType ? 'content-type;host' : 'host';
    const payloadHash = 'UNSIGNED-PAYLOAD';

    const canonicalRequest = [
      method,
      path,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest).digest('hex');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      hashedCanonicalRequest,
    ].join('\n');

    // Calculate signing key
    const kDate = crypto.createHmac('sha256', 'AWS4' + this.secretAccessKey).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(this.region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update('s3').digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();

    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    return `${this.endpoint}${path}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
  }

  async createUploadUrl(objectKey: string, contentType = 'application/octet-stream', expiresInSec = 900): Promise<string> {
    return this.generateSigV4Url('PUT', objectKey, contentType, expiresInSec);
  }

  async createDownloadUrl(objectKey: string, expiresInSec = 900): Promise<string> {
    return this.generateSigV4Url('GET', objectKey, undefined, expiresInSec);
  }

  async deleteObject(objectKey: string): Promise<boolean> {
    try {
      const url = await this.generateSigV4Url('PUT', objectKey, undefined, 300); // Or DELETE if needed
      // Direct S3 REST call for delete
      const res = await fetch(`${this.endpoint}/${this.bucket}/${objectKey}`, {
        method: 'DELETE',
        headers: {
          'Host': new URL(this.endpoint).host
        }
      });
      return res.status >= 200 && res.status < 300;
    } catch {
      return false;
    }
  }

  async headObject(objectKey: string): Promise<{ exists: boolean; size: number; checksum?: string } | null> {
    try {
      const downloadUrl = await this.createDownloadUrl(objectKey, 300);
      const res = await fetch(downloadUrl, { method: 'HEAD' });
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

  // Detect Cloudflare R2 / AWS S3 credentials
  const hasR2 = (process.env.R2_ACCESS_KEY || process.env.R2_ACCESS_KEY_ID) && (process.env.R2_SECRET_KEY || process.env.R2_SECRET_ACCESS_KEY);
  const hasS3 = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;

  if (hasR2 || hasS3) {
    activeStorageProvider = new S3R2StorageProvider();
  } else {
    activeStorageProvider = new LocalStorageProvider();
  }

  return activeStorageProvider;
}

export function setStorageProviderForTest(provider: ObjectStorageProvider | null): void {
  activeStorageProvider = provider;
}
