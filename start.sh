#!/bin/sh
set -eu
cd "$(dirname "$0")"
[ -d node_modules ] || { echo "Run npm ci once before starting." >&2; exit 1; }
[ -f dist/server.cjs ] || { echo "Run npm run build before starting." >&2; exit 1; }
exec npm start
