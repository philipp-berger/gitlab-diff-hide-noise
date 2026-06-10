#!/usr/bin/env bash
# Package the extension into a Chrome Web Store-ready zip.
set -euo pipefail
cd "$(dirname "$0")"

VERSION=$(node -e "process.stdout.write(require('./manifest.json').version)")
OUT="mrViewReducer-${VERSION}.zip"

rm -f "$OUT"
zip -r "$OUT" \
  manifest.json \
  popup.html popup.js \
  src \
  icons/icon-16.png icons/icon-32.png icons/icon-48.png icons/icon-128.png \
  -x '*.DS_Store' >/dev/null

echo "Built $OUT"
unzip -l "$OUT" | tail -n +4
