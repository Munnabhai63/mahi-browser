#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <path-to-dump-file>"
  exit 1
fi

DUMP_FILE="$1"
if [ ! -f "$DUMP_FILE" ]; then
  echo "Dump file not found: $DUMP_FILE"
  exit 1
fi

PG_IMAGE="${PG_IMAGE:-postgres:17-alpine}"

# Verify checksum if .sha256 file exists
if [ -f "$DUMP_FILE.sha256" ]; then
  echo "Verifying SHA256 checksum..."
  (cd "$(dirname "$DUMP_FILE")" && sha256sum -c "$(basename "$DUMP_FILE").sha256")
  echo "SHA256 checksum OK."
fi

# Mandatory safety confirmation
read -r -p "Type RESTORE to continue: " CONFIRM
if [ "$CONFIRM" != "RESTORE" ]; then
  echo "Aborted."
  exit 1
fi

RAW_URL="$(docker exec mahibrowser_gateway printenv DATABASE_URL | tr -d '\r\n')"
if [ -z "$RAW_URL" ]; then
  echo "DATABASE_URL missing in container"
  exit 1
fi

CLEAN_URL="${RAW_URL#\"}"
CLEAN_URL="${CLEAN_URL%\"}"
DATABASE_URL="${CLEAN_URL%%\?*}"

echo "Restoring database from $DUMP_FILE using $PG_IMAGE..."
docker run --rm -i -e DATABASE_URL="$DATABASE_URL" "$PG_IMAGE" sh -lc 'pg_restore --clean --if-exists --no-owner --no-acl -d "$DATABASE_URL"' < "$DUMP_FILE"
echo "Restore complete."

echo "=== Post-Restore Record Counts ==="
echo -n "auth_users: "
docker run --rm -e DATABASE_URL="$DATABASE_URL" "$PG_IMAGE" sh -lc 'psql "$DATABASE_URL" -tAc "select count(*) from auth_users;"'

echo -n "commercial_subscriptions: "
docker run --rm -e DATABASE_URL="$DATABASE_URL" "$PG_IMAGE" sh -lc 'psql "$DATABASE_URL" -tAc "select count(*) from commercial_subscriptions;"'

echo -n "licenses: "
HAS_LICENSES="$(docker run --rm -e DATABASE_URL="$DATABASE_URL" "$PG_IMAGE" sh -lc 'psql "$DATABASE_URL" -tAc "select count(*) from information_schema.tables where table_name = '\''licenses'\'';"' || echo "0")"
if [ "$HAS_LICENSES" -gt 0 ]; then
  docker run --rm -e DATABASE_URL="$DATABASE_URL" "$PG_IMAGE" sh -lc 'psql "$DATABASE_URL" -tAc "select count(*) from licenses;"'
else
  echo "licenses table absent in PG"
fi
