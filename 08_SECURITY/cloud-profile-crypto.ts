import crypto from 'node:crypto';

export interface EncryptedProfilePackage {
  ciphertext: Buffer;
  checksumSha256: string;
  encryptedDataKey: string; // Wrapped data key (hex/json)
  iv: string;               // Hex IV for ciphertext
  authTag: string;          // Hex Auth Tag for ciphertext
}

export interface DecryptPackageOptions {
  ciphertext: Buffer;
  expectedChecksum: string;
  encryptedDataKey: string;
  iv: string;
  authTag: string;
  userMasterKey: Buffer | string;
}

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEY_LENGTH = 32;
const PBKDF2_DIGEST = 'sha256';
const PBKDF2_SALT = 'mahi-zero-knowledge-cloud-sync-salt-v1';

/**
 * Derives a 256-bit user master encryption key from user passphrase or session secret.
 * Optionally incorporates account/user identifier to ensure cross-user salt isolation.
 */
export function deriveUserSyncKey(
  passphraseOrSecret: string,
  salt: string = PBKDF2_SALT,
  userIdentifier?: string
): Buffer {
  if (!passphraseOrSecret || typeof passphraseOrSecret !== 'string') {
    throw new Error('Sync passphrase or secret must be a non-empty string');
  }

  let effectiveSalt = salt;
  if (userIdentifier && salt === PBKDF2_SALT) {
    effectiveSalt = crypto
      .createHash('sha256')
      .update(`${PBKDF2_SALT}:${userIdentifier}`)
      .digest('hex');
  }

  return crypto.pbkdf2Sync(
    passphraseOrSecret,
    effectiveSalt,
    PBKDF2_ITERATIONS,
    PBKDF2_KEY_LENGTH,
    PBKDF2_DIGEST
  );
}

/**
 * Wraps (encrypts) a 32-byte data key using the user's master key via AES-256-GCM.
 */
export function wrapDataKey(dataKey: Buffer, userMasterKey: Buffer): string {
  const keyIv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', userMasterKey, keyIv);
  const wrapped = Buffer.concat([cipher.update(dataKey), cipher.final()]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    w: wrapped.toString('hex'),
    iv: keyIv.toString('hex'),
    tag: tag.toString('hex'),
  });
}

/**
 * Unwraps (decrypts) the data key using the user's master key.
 */
export function unwrapDataKey(wrappedKeyJson: string, userMasterKey: Buffer): Buffer {
  try {
    const parsed = JSON.parse(wrappedKeyJson);
    const keyIv = Buffer.from(parsed.iv, 'hex');
    const keyTag = Buffer.from(parsed.tag, 'hex');
    const wrapped = Buffer.from(parsed.w, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', userMasterKey, keyIv);
    decipher.setAuthTag(keyTag);
    return Buffer.concat([decipher.update(wrapped), decipher.final()]);
  } catch (err: any) {
    throw new Error('Failed to unwrap profile encryption key: Invalid passphrase or corrupted key data');
  }
}

/**
 * Encrypts a profile archive buffer using envelope encryption (AES-256-GCM).
 * Server and storage provider NEVER see plaintext.
 */
export function encryptProfileArchive(
  archiveBuffer: Buffer,
  passphraseOrMasterKey: string | Buffer
): EncryptedProfilePackage {
  const masterKey = typeof passphraseOrMasterKey === 'string'
    ? deriveUserSyncKey(passphraseOrMasterKey)
    : passphraseOrMasterKey;

  // 1. Generate fresh random 256-bit data key and 12-byte IV for the profile payload
  const dataKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);

  // 2. Encrypt archive payload with AES-256-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', dataKey, iv);
  const ciphertext = Buffer.concat([cipher.update(archiveBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // 3. Envelope: wrap data key with user's master key
  const encryptedDataKey = wrapDataKey(dataKey, masterKey);

  // 4. Calculate SHA-256 checksum of the resulting ciphertext
  const checksumSha256 = crypto.createHash('sha256').update(ciphertext).digest('hex');

  return {
    ciphertext,
    checksumSha256,
    encryptedDataKey,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

/**
 * Decrypts an encrypted profile package. Verifies checksum and auth tag.
 * Rejects corrupt or tampered payloads.
 */
export function decryptProfileArchive(options: DecryptPackageOptions): Buffer {
  const { ciphertext, expectedChecksum, encryptedDataKey, iv, authTag, userMasterKey } = options;

  // 1. Verify SHA-256 Checksum BEFORE decrypting
  const actualChecksum = crypto.createHash('sha256').update(ciphertext).digest('hex');
  if (actualChecksum !== expectedChecksum) {
    throw new Error(`Checksum verification failed! Expected: ${expectedChecksum}, Actual: ${actualChecksum}`);
  }

  // 2. Resolve Master Key
  const masterKey = typeof userMasterKey === 'string'
    ? deriveUserSyncKey(userMasterKey)
    : userMasterKey;

  // 3. Unwrap Data Key
  const dataKey = unwrapDataKey(encryptedDataKey, masterKey);

  // 4. Decrypt payload
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', dataKey, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext;
  } catch (err: any) {
    throw new Error(`Decryption failed: Payload was tampered with or corrupted (${err.message})`);
  }
}
