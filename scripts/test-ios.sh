#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../app"

DEVICE="${1:-phone}"

echo "=== iOS E2E Tests ($DEVICE) ==="
echo "Syncing Capacitor..."
npm run ios:sync

echo "Running device tests via Appium ($DEVICE)..."
TEST_DEVICE="ios-${DEVICE}" npx wdio run wdio.config.device-screenshots.ts "${@:2}"
