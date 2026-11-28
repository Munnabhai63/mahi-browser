# 04_LICENSING — Commercial License Lifecycle & Activation Ledger

This folder owns **commercial license lifecycle & database activation state** (distinct from cryptographic verification & online revocation in `08_SECURITY/`):

- `index.ts`: Canonical licensing barrel export
- `license-engine.ts`: License key issuance, seat activation (`license_devices`), 72-hour local HMAC offline cache, and admin revoke/extend lifecycle

Cryptographic verification boundaries in `08_SECURITY/`:
- `08_SECURITY/license-service.ts`: OS HWID fingerprinting & RSA-SHA256 offline license verification
- `08_SECURITY/license-status-service.ts`: Online revocation polling & signed 7-day status cache daemon

