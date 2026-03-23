#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../app"

echo "=== Android E2E Tests ==="
echo "Building debug APK..."
npm run android:sync

echo "Running Playwright tests against Android WebView..."
npx bddgen && npx playwright test --config playwright.config.android.ts "$@"
