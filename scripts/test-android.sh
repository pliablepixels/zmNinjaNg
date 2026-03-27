#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../app"

echo "=== Android E2E Tests ==="
echo "Syncing Capacitor..."
npm run android:sync

echo "Running device tests against Android emulator..."
TEST_DEVICE=android npx wdio run wdio.config.device-screenshots.ts "$@"
