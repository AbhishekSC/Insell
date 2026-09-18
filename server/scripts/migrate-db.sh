#!/usr/bin/env bash
# One-shot copy of a MongoDB database from SRC to DST using mongodump/mongorestore.
# Neither URI is printed. SRC is only ever read (dump is read-only).
#
#   export SRC='mongodb+srv://user:pass@source-host/insell_db?...'
#   export DST='mongodb+srv://user:pass@dest-host'
#   bash server/scripts/migrate-db.sh
#
# Needs: brew install mongodb-database-tools

set -euo pipefail

if [[ -z "${SRC:-}" || -z "${DST:-}" ]]; then
  echo "Set SRC and DST env vars first. See the header of this file." >&2
  exit 1
fi

command -v mongodump >/dev/null || { echo "mongodump not found — run: brew install mongodb-database-tools" >&2; exit 1; }

DUMP_DIR="./mongo-dump-$(date +%Y%m%d-%H%M%S)"

echo "→ dumping source database  (source is read-only, untouched)"
mongodump --uri="$SRC" --db=insell_db --gzip --out="$DUMP_DIR"

echo "→ restoring into destination  (insell_db collections only; --drop replaces them)"
mongorestore --uri="$DST" --gzip --drop --nsInclude="insell_db.*" "$DUMP_DIR"

echo "✓ done. dump kept at $DUMP_DIR"
echo "  now run: node server/scripts/verify-migration.mjs   (with SRC and DST still set)"
