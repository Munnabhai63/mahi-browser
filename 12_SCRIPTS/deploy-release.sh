#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# MAHI BROWSER — Release Deployment Script (Block A)
#
# Copies verified release binaries and update manifests to the production server:
#   /var/www/mahibrowser/releases/MAHI-Browser-Setup-latest.exe
#   /var/www/mahibrowser/releases/MAHI-Browser-Portable-latest.exe
#   /var/www/mahibrowser/updates/latest.yml
#   /var/www/mahibrowser/updates/MAHI-Browser-Setup-${VERSION}.exe
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

VERSION="${1:-$(node -p "require('${ROOT_DIR}/package.json').version")}"
REMOTE_HOST="${REMOTE_HOST:-root@mahibrowser.com}"
RELEASES_REMOTE_DIR="/var/www/mahibrowser/releases"
UPDATES_REMOTE_DIR="/var/www/mahibrowser/updates"
LOCAL_RELEASE_DIR="${ROOT_DIR}/release"

echo "=== MAHI Browser Release Deploy Harness ==="
echo "Version: ${VERSION}"
echo "Remote Host: ${REMOTE_HOST}"
echo "Local Directory: ${LOCAL_RELEASE_DIR}"

# 1. Source File Verification
FILE_SETUP_LATEST="${LOCAL_RELEASE_DIR}/MAHI-Browser-Setup-latest.exe"
FILE_PORTABLE_LATEST="${LOCAL_RELEASE_DIR}/MAHI-Browser-Portable-latest.exe"
FILE_LATEST_YML="${LOCAL_RELEASE_DIR}/latest.yml"
FILE_SETUP_VERSIONED="${LOCAL_RELEASE_DIR}/MAHI-Browser-Setup-${VERSION}.exe"

MISSING=0
for f in "${FILE_SETUP_LATEST}" "${FILE_PORTABLE_LATEST}" "${FILE_LATEST_YML}" "${FILE_SETUP_VERSIONED}"; do
  if [[ ! -f "$f" ]]; then
    echo "[-] ERROR: Missing required release file: $f" >&2
    MISSING=1
  fi
done

if [[ ${MISSING} -ne 0 ]]; then
  echo "[-] ABORT: One or more required release files are missing from ${LOCAL_RELEASE_DIR}." >&2
  exit 1
fi

echo "[+] All 4 required source files exist."

# 2. Local SHA-256 calculation
echo "--- Local File SHA-256 Checksums ---"
SHA_SETUP_LATEST=$(sha256sum "${FILE_SETUP_LATEST}" | awk '{print $1}')
SHA_PORTABLE_LATEST=$(sha256sum "${FILE_PORTABLE_LATEST}" | awk '{print $1}')
SHA_LATEST_YML=$(sha256sum "${FILE_LATEST_YML}" | awk '{print $1}')
SHA_SETUP_VERSIONED=$(sha256sum "${FILE_SETUP_VERSIONED}" | awk '{print $1}')

echo "  MAHI-Browser-Setup-latest.exe:    ${SHA_SETUP_LATEST}"
echo "  MAHI-Browser-Portable-latest.exe:  ${SHA_PORTABLE_LATEST}"
echo "  latest.yml:                       ${SHA_LATEST_YML}"
echo "  MAHI-Browser-Setup-${VERSION}.exe:   ${SHA_SETUP_VERSIONED}"

# 3. Remote Transfer via SCP
echo "--- Transferring release files to ${REMOTE_HOST} ---"
ssh -o BatchMode=yes "${REMOTE_HOST}" "mkdir -p ${RELEASES_REMOTE_DIR} ${UPDATES_REMOTE_DIR}"

scp "${FILE_SETUP_LATEST}" "${REMOTE_HOST}:${RELEASES_REMOTE_DIR}/MAHI-Browser-Setup-latest.exe"
scp "${FILE_PORTABLE_LATEST}" "${REMOTE_HOST}:${RELEASES_REMOTE_DIR}/MAHI-Browser-Portable-latest.exe"
scp "${FILE_LATEST_YML}" "${REMOTE_HOST}:${UPDATES_REMOTE_DIR}/latest.yml"
scp "${FILE_SETUP_VERSIONED}" "${REMOTE_HOST}:${UPDATES_REMOTE_DIR}/MAHI-Browser-Setup-${VERSION}.exe"

# 4. Verify Remote SHA-256 Checksums
echo "--- Remote File SHA-256 Checksums ---"
REMOTE_SHA_SETUP=$(ssh -o BatchMode=yes "${REMOTE_HOST}" "sha256sum ${RELEASES_REMOTE_DIR}/MAHI-Browser-Setup-latest.exe" | awk '{print $1}')
REMOTE_SHA_PORTABLE=$(ssh -o BatchMode=yes "${REMOTE_HOST}" "sha256sum ${RELEASES_REMOTE_DIR}/MAHI-Browser-Portable-latest.exe" | awk '{print $1}')
REMOTE_SHA_YML=$(ssh -o BatchMode=yes "${REMOTE_HOST}" "sha256sum ${UPDATES_REMOTE_DIR}/latest.yml" | awk '{print $1}')
REMOTE_SHA_VER=$(ssh -o BatchMode=yes "${REMOTE_HOST}" "sha256sum ${UPDATES_REMOTE_DIR}/MAHI-Browser-Setup-${VERSION}.exe" | awk '{print $1}')

echo "  Remote Setup Latest:    ${REMOTE_SHA_SETUP}"
echo "  Remote Portable Latest:  ${REMOTE_SHA_PORTABLE}"
echo "  Remote latest.yml:       ${REMOTE_SHA_YML}"
echo "  Remote Setup Versioned:  ${REMOTE_SHA_VER}"

if [[ "${SHA_SETUP_LATEST}" != "${REMOTE_SHA_SETUP}" ]] || \
   [[ "${SHA_PORTABLE_LATEST}" != "${REMOTE_SHA_PORTABLE}" ]] || \
   [[ "${SHA_LATEST_YML}" != "${REMOTE_SHA_YML}" ]] || \
   [[ "${SHA_SETUP_VERSIONED}" != "${REMOTE_SHA_VER}" ]]; then
  echo "[-] ERROR: Remote checksum mismatch detected!" >&2
  exit 1
fi

echo "[+] Integrity verified: All 4 remote files match local SHA-256."

# 5. Live Endpoint Verification via curl
echo "--- Live HTTP Endpoint Verification ---"
echo "Testing: https://mahibrowser.com/download/setup"
curl -sI "https://mahibrowser.com/download/setup" | head -n 5

echo "Testing: https://mahibrowser.com/download/portable"
curl -sI "https://mahibrowser.com/download/portable" | head -n 5

echo "Testing: https://mahibrowser.com/update/latest.yml"
curl -s "https://mahibrowser.com/update/latest.yml" | head -n 10

echo "[✓] Deployment completed successfully."
