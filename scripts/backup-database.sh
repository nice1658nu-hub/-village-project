#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/backend/storage/backups"
STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
SQL_FILE="$BACKUP_DIR/smart_village_$STAMP.sql"
FILES_FILE="$BACKUP_DIR/uploads_$STAMP.tar.gz"

mkdir -p "$BACKUP_DIR"
mysqldump --single-transaction --routines --triggers smart_village > "$SQL_FILE"

if [ -d "$PROJECT_ROOT/backend/storage/app/public" ]; then
  tar -czf "$FILES_FILE" -C "$PROJECT_ROOT/backend/storage/app" public
fi

echo "Database: $SQL_FILE"
if [ -f "$FILES_FILE" ]; then
  echo "Uploads:  $FILES_FILE"
fi

