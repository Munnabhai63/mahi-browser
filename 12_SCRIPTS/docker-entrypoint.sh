#!/bin/sh
set -e
if [ -n "$DATABASE_URL" ]; then
  export DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"
  echo "[ENTRYPOINT] Running prisma migrate deploy"
  npx prisma migrate deploy
fi
exec npm run start:gateway
