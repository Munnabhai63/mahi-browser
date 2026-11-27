import { z } from 'zod';
import { isWeakSecret, validateProductionSecrets } from '../../08_SECURITY/install-secrets.js';

export class CloudEnvError extends Error {
  public readonly issues: string[];

  constructor(issues: string[]) {
    super(`[CloudEnv] Invalid production environment configuration:\n - ${issues.join('\n - ')}`);
    this.name = 'CloudEnvError';
    this.issues = issues;
  }
}

const CloudEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).optional(),
  DATABASE_URL: z.string().trim().optional(),
  REDIS_URL: z.string().trim().optional(),
  APP_URL: z.string().trim().optional(),
  API_URL: z.string().trim().optional(),
  WEBSITE_URL: z.string().trim().optional(),
  CORS_ALLOW_ALL: z.string().trim().optional(),
  PAYMENT_ALLOW_TEST_ADAPTERS: z.string().trim().optional(),
  PAYMENT_PROVIDER: z.string().trim().optional(),
  GOOGLE_CLIENT_ID: z.string().trim().optional(),
  GOOGLE_CLIENT_SECRET: z.string().trim().optional(),
  GOOGLE_REDIRECT_URI: z.string().trim().optional(),
  LOCAL_STORAGE_SECRET: z.string().trim().optional(),
  STORAGE_PROVIDER: z.string().trim().optional(),
  S3_BUCKET: z.string().trim().optional(),
  R2_BUCKET: z.string().trim().optional(),
  AWS_S3_BUCKET: z.string().trim().optional(),
  AWS_ACCESS_KEY_ID: z.string().trim().optional(),
  R2_ACCESS_KEY_ID: z.string().trim().optional(),
  S3_ACCESS_KEY_ID: z.string().trim().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().trim().optional(),
  R2_SECRET_ACCESS_KEY: z.string().trim().optional(),
  S3_SECRET_ACCESS_KEY: z.string().trim().optional(),
  MAHI_OWNER_TOTP_SECRET: z.string().trim().optional(),
  JWT_SECRET: z.string().trim().optional(),
  MAHI_JWT_SECRET: z.string().trim().optional(),
  ADMIN_BOOTSTRAP_TOKEN: z.string().trim().optional(),
  MAHI_MASTER_ADMIN_SECRET: z.string().trim().optional(),
  MASTER_ADMIN_SECRET: z.string().trim().optional(),
  MAHI_STATUS_PRIVATE_KEY: z.string().trim().optional(),
  RSA_PRIVATE_KEY: z.string().trim().optional(),
  MAHI_CLOUD_GATEWAY: z.string().trim().optional(),
});

export type CloudEnv = z.infer<typeof CloudEnvSchema>;

let cachedEnv: CloudEnv | null = null;

function isElectronDesktopRuntime(): boolean {
  const isElectron = Boolean((process.versions as Record<string, string | undefined>)?.electron);
  return isElectron && process.env.MAHI_CLOUD_GATEWAY !== '1';
}

function isValidHttpsUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function hasConfiguredRemoteObjectStorage(env: CloudEnv): boolean {
  const bucket = env.R2_BUCKET || env.S3_BUCKET || env.AWS_S3_BUCKET;
  const keyId = env.R2_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID || env.S3_ACCESS_KEY_ID;
  const secretKey = env.R2_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY || env.S3_SECRET_ACCESS_KEY;
  return Boolean(bucket && keyId && secretKey);
}

export function validateCloudEnv(rawEnv: NodeJS.ProcessEnv = process.env): CloudEnv {
  const normalizedEnv: Record<string, string | undefined> = {};
  for (const key of Object.keys(CloudEnvSchema.shape)) {
    const val = rawEnv[key];
    normalizedEnv[key] = typeof val === 'string' && val.trim() !== '' ? val.trim() : undefined;
  }
  if (!normalizedEnv.NODE_ENV) {
    normalizedEnv.NODE_ENV = 'development';
  }

  const parsed = CloudEnvSchema.safeParse(normalizedEnv);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.') || 'env'}: ${i.message}`);
    throw new CloudEnvError(issues);
  }

  const env = parsed.data;
  const isNonElectronProd = env.NODE_ENV === 'production' && !isElectronDesktopRuntime();

  if (!isNonElectronProd) {
    return env;
  }

  const issues: string[] = [];

  // 1. Validate core cryptographic secrets (JWT, Master Admin, RSA status signing key)
  try {
    validateProductionSecrets();
  } catch (err: any) {
    issues.push(err?.message || 'Core production secrets failed validation.');
  }

  // 2. Forbid dangerous test / bypass flags in production
  if (env.PAYMENT_ALLOW_TEST_ADAPTERS?.toLowerCase() === 'true') {
    issues.push('PAYMENT_ALLOW_TEST_ADAPTERS=true is strictly forbidden in production.');
  }
  if (env.PAYMENT_PROVIDER?.toLowerCase() === 'simulation') {
    issues.push('PAYMENT_PROVIDER=simulation is strictly forbidden in production.');
  }
  if (env.CORS_ALLOW_ALL?.toLowerCase() === 'true') {
    issues.push('CORS_ALLOW_ALL=true is strictly forbidden in production.');
  }

  // 3. OAuth credentials must be paired symmetrically if configured
  const hasGoogleId = Boolean(env.GOOGLE_CLIENT_ID);
  const hasGoogleSecret = Boolean(env.GOOGLE_CLIENT_SECRET);
  if (hasGoogleId !== hasGoogleSecret) {
    issues.push('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must both be set when configuring Google OAuth.');
  }

  // 4. Storage signing secret when remote S3/R2 is not configured
  if (!hasConfiguredRemoteObjectStorage(env)) {
    const localSecret = env.LOCAL_STORAGE_SECRET || '';
    if (!localSecret || localSecret.length < 16 || isWeakSecret(localSecret)) {
      issues.push(
        'LOCAL_STORAGE_SECRET (>= 16 chars, non-default) is required in production when S3/R2 remote storage is not configured.'
      );
    }
  }

  // 5. Public service URLs must enforce HTTPS in production when specified
  if (env.APP_URL && !isValidHttpsUrl(env.APP_URL)) {
    issues.push('APP_URL must be a valid https:// URL in production.');
  }
  if (env.API_URL && !isValidHttpsUrl(env.API_URL)) {
    issues.push('API_URL must be a valid https:// URL in production.');
  }

  if (issues.length > 0) {
    throw new CloudEnvError(issues);
  }

  return env;
}

export function getCloudEnv(options?: { forceReload?: boolean }): CloudEnv {
  if (!cachedEnv || options?.forceReload) {
    cachedEnv = validateCloudEnv(process.env);
  }
  return cachedEnv;
}

export function resetCloudEnvCacheForTesting(): void {
  cachedEnv = null;
}
