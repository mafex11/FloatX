#!/bin/bash
# Assemble FloatX.app from the SwiftPM release build, ad-hoc deep-sign it, and
# zip it for distribution. Mirrors the Burnt packaging approach (no Xcode).
set -euo pipefail

cd "$(dirname "$0")"
VERSION="${1:-0.1.0}"
APP="FloatX.app"
BUNDLE_ID="dev.mafex.floatx"

echo "→ building release binary"
swift build -c release >/dev/null

echo "→ assembling $APP (v$VERSION)"
rm -rf "$APP" FloatX.zip
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

cp .build/release/FloatX "$APP/Contents/MacOS/FloatX"
# harvester.js is embedded in the binary — no resource bundle to copy.

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>FloatX</string>
  <key>CFBundleDisplayName</key><string>FloatX</string>
  <key>CFBundleIdentifier</key><string>$BUNDLE_ID</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleExecutable</key><string>FloatX</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSMinimumSystemVersion</key><string>26.0</string>
  <!-- Menu-bar only: no Dock icon. -->
  <key>LSUIElement</key><true/>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST

# Ad-hoc deep-sign (not notarized) — same as Burnt. Sign nested bundle first.
echo "→ deep-signing (ad-hoc)"
codesign --force --deep --sign - "$APP" >/dev/null 2>&1
codesign --verify --deep "$APP" && echo "  signature ok"

echo "→ zipping"
ditto -c -k --keepParent "$APP" FloatX.zip
echo "→ done: $(pwd)/FloatX.zip ($(du -h FloatX.zip | cut -f1))"
echo "  sha256: $(shasum -a 256 FloatX.zip | cut -d' ' -f1)"

# Remove the staged .app so it can't be mistaken for a second install / launched
# from the source tree. The shipped artifact is FloatX.zip (→ /Applications via brew).
rm -rf "$APP"
