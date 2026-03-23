#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../app"

echo "=== Tauri E2E Tests ==="
echo "Running WebDriverIO tests via tauri-driver..."
npx wdio run wdio.config.tauri.ts "$@"
