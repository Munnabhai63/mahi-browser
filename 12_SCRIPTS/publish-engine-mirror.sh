#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# MAHI BROWSER — Publish Engine Fallback Mirror Script (Block F7)
# Provisions Chromium 138 win64 engine mirror under /var/www/mahibrowser/engine/
# ==============================================================================

ENGINE_DIR="${ENGINE_DIR:-/var/www/mahibrowser/engine}"
SOURCE_URL="${SOURCE_URL:-https://commondatastorage.googleapis.com/chromium-browser-snapshots/Win_x64/1465706/chrome-win.zip}"
PRIMARY_FILE="chrome-138.0.7204.92-win64.zip"
EXPECTED_SHA256="26237e603d68f909f2ba62162a30c51fa1ba94683ca61358e5489b0a08461bc2"
MIN_BYTES=104857600 # 100MB

mkdir -p "${ENGINE_DIR}"
cd "${ENGINE_DIR}"

echo "=== MAHI Browser Engine Mirror Provisioning ==="
echo "Target directory: ${ENGINE_DIR}"
echo "Primary file:     ${PRIMARY_FILE}"

# Download if not present or integrity invalid
NEED_DOWNLOAD=1
if [[ -f "${PRIMARY_FILE}" ]]; then
  ACTUAL_SIZE=$(stat -c%s "${PRIMARY_FILE}" 2>/dev/null || stat -f%z "${PRIMARY_FILE}" 2>/dev/null || echo 0)
  if (( ACTUAL_SIZE >= MIN_BYTES )); then
    ACTUAL_SHA256=$(sha256sum "${PRIMARY_FILE}" | awk '{print $1}')
    if [[ "${ACTUAL_SHA256}" == "${EXPECTED_SHA256}" ]]; then
      echo "[✓] Existing engine archive is valid (${ACTUAL_SIZE} bytes, SHA-256: ${ACTUAL_SHA256})."
      NEED_DOWNLOAD=0
    else
      echo "[-] Checksum mismatch on existing file: ${ACTUAL_SHA256} vs ${EXPECTED_SHA256}. Re-downloading..."
    fi
  else
    echo "[-] Existing file is too small (${ACTUAL_SIZE} bytes < 100MB). Re-downloading..."
  fi
fi

if [[ ${NEED_DOWNLOAD} -eq 1 ]]; then
  echo "Downloading Chromium 138 from ${SOURCE_URL}..."
  TMP_FILE="${PRIMARY_FILE}.tmp.$$"
  curl -sSL --fail -o "${TMP_FILE}" "${SOURCE_URL}"
  
  ACTUAL_SIZE=$(stat -c%s "${TMP_FILE}" 2>/dev/null || stat -f%z "${TMP_FILE}" 2>/dev/null || echo 0)
  if (( ACTUAL_SIZE < MIN_BYTES )); then
    echo "[-] Downloaded file is too small (${ACTUAL_SIZE} bytes < 100MB)" >&2
    rm -f "${TMP_FILE}"
    exit 1
  fi
  
  ACTUAL_SHA256=$(sha256sum "${TMP_FILE}" | awk '{print $1}')
  if [[ "${ACTUAL_SHA256}" != "${EXPECTED_SHA256}" ]]; then
    echo "[-] Downloaded file SHA-256 mismatch: ${ACTUAL_SHA256} vs ${EXPECTED_SHA256}" >&2
    rm -f "${TMP_FILE}"
    exit 1
  fi
  
  mv "${TMP_FILE}" "${PRIMARY_FILE}"
  echo "[✓] Download complete and verified (${ACTUAL_SIZE} bytes, SHA-256: ${ACTUAL_SHA256})."
fi

# Create hardlinks for aliases so inode is shared
ALIASES=("chrome-138.zip" "chrome-138-win64.zip" "chromium-138-win64.zip")
for alias in "${ALIASES[@]}"; do
  rm -f "${alias}"
  ln "${PRIMARY_FILE}" "${alias}"
  echo "[+] Created hardlink: ${alias} -> ${PRIMARY_FILE}"
done

echo ""
echo "--- Mirror Verification ---"
stat -c "%i %n (size: %s bytes)" "${PRIMARY_FILE}" "${ALIASES[@]}"
echo "[✓] Engine fallback mirror published successfully."
