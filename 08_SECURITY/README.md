# 08_SECURITY — Cryptography, Enforcement & Verification Boundaries

This folder owns cryptographic primitives, device HWID binding, RSA signature verification, and enforcement guards (separate from the license activation/ledger lifecycle in `04_LICENSING/`):

- `encryption.ts`: AES-256-GCM data encryption, PBKDF2 key derivation, PIN hashing
- `sanitizer.ts`: Sensitive token, password, and credential redaction
- `license-service.ts`: Hardware ID (`getHWID`) and RSA-SHA256 offline license key verification + offline key discovery
- `license-status-service.ts`: Online revocation status daemon and 7-day signed status cache
- `freemium-guard.ts`: Runtime profile and proxy quota enforcement against unified account/license state

