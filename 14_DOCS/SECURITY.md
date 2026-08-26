# MAHI BROWSER Security Policy & Architecture

## 1. Threat Model & Security Posture

MAHI BROWSER is designed from the ground up to protect user session data, encrypted credentials, and privacy configurations.

---

## 2. Cryptographic Specifications

### AES-256-GCM (Galois/Counter Mode)
- **Algorithm**: `aes-256-gcm`
- **Key Length**: 256 bits (32 bytes)
- **Initialization Vector (IV)**: 96 bits (12 bytes) cryptographically random per encryption
- **Authentication Tag**: 128 bits (16 bytes) ensuring integrity and authenticity of ciphertext
- **Storage Format**: `base64(iv):base64(authTag):base64(ciphertext)`

### Key Derivation (PBKDF2)
- **Algorithm**: `PBKDF2-HMAC-SHA256`
- **Iterations**: 100,000 iterations
- **Salt**: 128 bits (16 bytes) random salt per derivation

---

## 3. Credential Protection at Rest

1. **Proxy Passwords**:
   - Proxy passwords are never stored in plain text.
   - Encrypted with AES-256-GCM before writing to SQLite `proxies.password_encrypted`.
   - Never displayed in plain text in UI tables, logs, or exported API listings.

2. **Application Lock PIN**:
   - Stored as a salted PBKDF2-HMAC-SHA256 hash.
   - Verified via constant-time comparison (`crypto.timingSafeEqual`) to prevent timing side-channel attacks.

3. **Encrypted Archive Backups (`.mahi-profile`)**:
   - Allows optional user-supplied password encryption.
   - Encrypted archive payload contains cookies, history, and configuration.
   - Tamper-evident: any payload corruption immediately fails GCM tag authentication.

---

## 4. Log and Error Sanitization

The `sanitizer.ts` utility runs on all errors and audit logs before persisting:
- Patterns matching `password`, `token`, `auth_token`, `proxy_pass`, and `secret` are automatically redacted with `***REDACTED***`.
- Stack traces containing sensitive paths or parameters are scrubbed.

---

## 5. Electron Security Checklist

- [x] `contextIsolation: true` enabled on BrowserWindow.
- [x] `nodeIntegration: false` enforced.
- [x] Safe `contextBridge.exposeInMainWorld` with explicit typed APIs.
- [x] Navigation restricted via `setWindowOpenHandler` (opens external URLs in default system browser).
- [x] Content Security Policy (CSP) headers enforced in HTML.
- [x] Single instance lock (`app.requestSingleInstanceLock`) prevents multiple conflicting processes.
