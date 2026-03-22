#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../app"

DEVICE="${1:-phone}"

echo "=== iOS E2E Tests ($DEVICE) ==="
echo "Building iOS app for simulator..."
npm run ios:sync

echo "Running WebDriverIO tests via Appium..."
npx wdio run "wdio.config.ios-${DEVICE}.ts" "${@:2}"
