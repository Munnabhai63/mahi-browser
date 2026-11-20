#!/usr/bin/env bash
set -euo pipefail

PG_IMAGE="${PG_IMAGE:-postgres:17-alpine}"
OUT_DIR="${OUT_DIR:-/var/backups/mahibrowser}"
TS=$(date -u +%Y%m%dT%H%M%SZ)

mkdir -p "$OUT_DIR"

RAW_URL="$(docker exec mahibrowser_gateway printenv DATABASE_URL | tr -d '\r\n')"
if [ -z "$RAW_URL" ]; then
  echo "DATABASE_URL missing in container"
  exit 1
fi

# Sanitize surrounding quotes and query parameters not supported by psql/pg_dump URI
CLEAN_URL="${RAW_URL#\"}"
CLEAN_URL="${CLEAN_URL%\"}"
DATABASE_URL="${CLEAN_URL%%\?*}"

DUMP_FILE="$OUT_DIR/mahi-$TS.dump"
docker run --rm -e DATABASE_URL="$DATABASE_URL" "$PG_IMAGE" sh -lc 'pg_dump "$DATABASE_URL" --no-owner --no-acl --format=custom' > "$DUMP_FILE"

SIZE=$(stat -c%s "$DUMP_FILE")
if [ "$SIZE" -lt 10000 ]; then
  echo "BACKUP TOO SMALL: $SIZE"
  exit 1
fi

sha256sum "$DUMP_FILE" > "$DUMP_FILE.sha256"
find "$OUT_DIR" -name "mahi-*.dump" -mtime +7 -delete

echo "OK $DUMP_FILE $SIZE bytes"
