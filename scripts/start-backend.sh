#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT/backend"
# Cache Laravel metadata before serving. This avoids repeatedly scanning the
# Windows-mounted project tree on every API request under WSL.
php artisan optimize >/dev/null
exec php \
  -d opcache.enable_cli=1 \
  -d opcache.validate_timestamps=0 \
  -d opcache.memory_consumption=192 \
  -d opcache.max_accelerated_files=20000 \
  -d realpath_cache_size=16384K \
  -d realpath_cache_ttl=3600 \
  artisan serve --host=0.0.0.0 --port="${SMART_VILLAGE_BACKEND_PORT:-8000}"
