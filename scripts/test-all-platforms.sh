#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(dirname "$0")"

echo "=== Running All Platform Tests ==="

echo "--- Web (Chromium) ---"
cd "$SCRIPT_DIR/../app" && npm run test:e2e

echo "--- Android ---"
"$SCRIPT_DIR/test-android.sh"

echo "--- iOS Phone ---"
"$SCRIPT_DIR/test-ios.sh" phone

echo "--- iOS Tablet ---"
"$SCRIPT_DIR/test-ios.sh" tablet

echo "--- Tauri Desktop ---"
"$SCRIPT_DIR/test-tauri.sh"

echo "=== All Platform Tests Complete ==="
