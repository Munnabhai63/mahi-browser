#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# MAHI BROWSER — Release Deployment Script & Verification Gate (Block A & D)
#
# Copies verified release binaries and update manifests to the production server:
#   /var/www/mahibrowser/releases/MAHI-Browser-Setup-latest.exe
#   /var/www/mahibrowser/releases/MAHI-Browser-Portable-latest.exe
#   /var/www/mahibrowser/updates/latest.yml
#   /var/www/mahibrowser/updates/MAHI-Browser-Setup-${VERSION}.exe
#
# Flags:
#   --verify-only   Skip file copy / SSH transfer and run the strict live endpoint gate
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

PKG_VERSION="$(grep '"version"' "${ROOT_DIR}/package.json" | head -n 1 | awk -F '"' '{print $4}')"
VERSION="${VERSION:-${PKG_VERSION}}"
REMOTE_HOST="${REMOTE_HOST:-root@mahibrowser.com}"
RELEASES_REMOTE_DIR="/var/www/mahibrowser/releases"
UPDATES_REMOTE_DIR="/var/www/mahibrowser/updates"
LOCAL_RELEASE_DIR="${ROOT_DIR}/release"
BASE_URL="${BASE_URL:-https://mahibrowser.com}"

VERIFY_ONLY=0
for arg in "$@"; do
  if [[ "$arg" == "--verify-only" ]]; then
    VERIFY_ONLY=1
  elif [[ "$arg" =~ ^[0-9]+\.[0-9]+\.[0-9]+ ]]; then
    VERSION="$arg"
  fi
done

if [[ ${VERIFY_ONLY} -eq 0 ]]; then
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
fi

# 5. Strict Live HTTP Endpoint Verification Gate
echo "=== Live HTTP Endpoint Verification Gate ==="
SETUP_URL="${BASE_URL}/download/setup"
PORTABLE_URL="${BASE_URL}/download/portable"
UPDATE_URL="${BASE_URL}/update/latest.yml"

FAILURES=0

echo "Probing: ${SETUP_URL}"
SETUP_HEADER=$(curl -sSLI -w "%{http_code}" -o /dev/null "${SETUP_URL}" 2>&1 || echo "000")
SETUP_CL=$(curl -sSLI "${SETUP_URL}" 2>&1 | grep -i "^content-length:" | tail -n 1 | awk '{print $2}' | tr -d '\r\n')
SETUP_CL=${SETUP_CL:-0}

echo "Probing: ${PORTABLE_URL}"
PORTABLE_HEADER=$(curl -sSLI -w "%{http_code}" -o /dev/null "${PORTABLE_URL}" 2>&1 || echo "000")

echo "Probing: ${UPDATE_URL}"
UPDATE_HEADER=$(curl -sSLI -w "%{http_code}" -o /dev/null "${UPDATE_URL}" 2>&1 || echo "000")
UPDATE_BODY=$(curl -sSL "${UPDATE_URL}" 2>&1 || echo "")
UPDATE_VERSION=$(echo "${UPDATE_BODY}" | grep "^version:" | head -n 1 | awk '{print $2}' | tr -d '\r\n')
UPDATE_VERSION=${UPDATE_VERSION:-"missing"}

echo ""
echo "=== Verification Summary ==="
printf "%-25s | %-8s | %-28s | %-12s\n" "Endpoint" "Status" "Details" "Result"
printf "%-25s-+-%-8s-+-%-28s-+-%-12s\n" "-------------------------" "--------" "----------------------------" "------------"

# Check 1: /download/setup status 200 and Content-Length > 50,000,000
SETUP_RESULT="PASS"
if [[ "${SETUP_HEADER}" != "200" ]]; then
  SETUP_RESULT="FAIL"
  FAILURES=$((FAILURES + 1))
elif (( SETUP_CL <= 50000000 )); then
  SETUP_RESULT="FAIL (<=50MB)"
  FAILURES=$((FAILURES + 1))
fi
printf "%-25s | %-8s | Content-Length: %-12s | %-12s\n" "/download/setup" "${SETUP_HEADER}" "${SETUP_CL}" "${SETUP_RESULT}"

# Check 2: /download/portable status 200
PORTABLE_RESULT="PASS"
if [[ "${PORTABLE_HEADER}" != "200" ]]; then
  PORTABLE_RESULT="FAIL"
  FAILURES=$((FAILURES + 1))
fi
printf "%-25s | %-8s | %-28s | %-12s\n" "/download/portable" "${PORTABLE_HEADER}" "-" "${PORTABLE_RESULT}"

# Check 3: /update/latest.yml status 200 and version == package.json version
UPDATE_RESULT="PASS"
if [[ "${UPDATE_HEADER}" != "200" ]]; then
  UPDATE_RESULT="FAIL"
  FAILURES=$((FAILURES + 1))
elif [[ "${UPDATE_VERSION}" != "${PKG_VERSION}" ]]; then
  UPDATE_RESULT="FAIL (ver mismatch)"
  FAILURES=$((FAILURES + 1))
fi
printf "%-25s | %-8s | Version: %-19s | %-12s\n" "/update/latest.yml" "${UPDATE_HEADER}" "${UPDATE_VERSION}" "${UPDATE_RESULT}"
echo "--------------------------------------------------------------------------------"

if [[ ${FAILURES} -gt 0 ]]; then
  echo "[-] VERIFICATION GATE FAILED: ${FAILURES} check(s) did not meet requirements." >&2
  exit 1
fi

echo "[✓] ALL CHECKS PASSED: Production release endpoints verified live."
