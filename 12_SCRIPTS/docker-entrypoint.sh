#!/bin/sh
set -e
if [ -n "$DATABASE_URL" ]; then
  export DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"
  echo "[ENTRYPOINT] prisma migrate deploy (fail-tolerant)"
  npx prisma migrate deploy || echo "[ENTRYPOINT][WARN] migrate deploy failed, continuing"
fi
exec npm run start:gateway
