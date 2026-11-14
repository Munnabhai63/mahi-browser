#!/usr/bin/env bash
# ==============================================================================
# MAHI BROWSER — Apply Chromium 138 Native Anti-Detect C++ Patches (Linux/macOS)
# Target: Chromium 138.0.7204.0
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHROMIUM_SRC="${1:-}"

if [[ -z "${CHROMIUM_SRC}" ]]; then
  if [[ -f "BUILD.gn" && -d "third_party/blink" ]]; then
    CHROMIUM_SRC="$(pwd)"
  elif [[ -f "../../BUILD.gn" && -d "../../third_party/blink" ]]; then
    CHROMIUM_SRC="$(cd ../.. && pwd)"
  else
    echo "ERROR: Please specify path to Chromium 'src' directory."
    echo "Usage: ./apply-patches.sh /path/to/chromium/src"
    exit 1
  fi
fi

if [[ ! -f "${CHROMIUM_SRC}/BUILD.gn" || ! -d "${CHROMIUM_SRC}/third_party/blink" ]]; then
  echo "ERROR: Target directory '${CHROMIUM_SRC}' is not a valid Chromium source tree."
  exit 1
fi

SERIES_FILE="${SCRIPT_DIR}/series"
if [[ ! -f "${SERIES_FILE}" ]]; then
  echo "ERROR: Series file not found at ${SERIES_FILE}"
  exit 1
fi

echo "======================================================================"
echo "  MAHI BROWSER — Applying C++ Engine Patches to Chromium 138"
echo "  Target: ${CHROMIUM_SRC}"
echo "======================================================================"

APPLIED_COUNT=0
cd "${CHROMIUM_SRC}"

while IFS= read -r line || [[ -n "$line" ]]; do
  # Strip whitespace and carriage returns
  patch_name="$(echo "$line" | tr -d '\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  
  # Skip comments and blank lines
  if [[ -z "${patch_name}" || "${patch_name}" =~ ^# ]]; then
    continue
  fi

  patch_path="${SCRIPT_DIR}/${patch_name}"
  if [[ ! -f "${patch_path}" ]]; then
    echo "[-] FAILED: Patch file not found: ${patch_name}"
    exit 1
  fi

  echo -n "[+] Testing patch: ${patch_name} ... "
  if git apply --check --whitespace=nowarn "${patch_path}" >/dev/null 2>&1; then
    echo "OK"
    echo -n "    Applying: ${patch_name} ... "
    git apply --whitespace=nowarn "${patch_path}"
    echo "APPLIED"
    APPLIED_COUNT=$((APPLIED_COUNT + 1))
  else
    # Check if patch is already applied
    if git apply --reverse --check "${patch_path}" >/dev/null 2>&1; then
      echo "ALREADY APPLIED (skipping)"
      APPLIED_COUNT=$((APPLIED_COUNT + 1))
    else
      echo "FAILED"
      echo "ERROR: git apply check failed for ${patch_name}"
      git apply --check "${patch_path}" || true
      exit 1
    fi
  fi
done < "${SERIES_FILE}"

echo "======================================================================"
echo "  SUCCESS: Applied ${APPLIED_COUNT} MAHI C++ patches cleanly."
echo "======================================================================"
