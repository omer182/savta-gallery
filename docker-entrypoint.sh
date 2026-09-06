#!/bin/sh
set -e

# Migrations run on every start, before the server accepts traffic. They are
# idempotent — Drizzle records which have been applied — so a restart that
# introduces no new migrations is a no-op.
echo "savta-gallery: applying migrations to ${DATA_DIR:-/data}/db/gallery.db"
node dist/scripts/migrate.mjs

echo "savta-gallery: starting server on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}"
exec node server.js
