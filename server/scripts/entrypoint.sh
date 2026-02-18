#!/bin/sh
set -e
echo "Running migrations..."
node scripts/migrate.mjs
echo "Starting server..."
exec node dist/index.js
