#!/usr/bin/env bash
# Submits the most recent local build to App Store Connect. A --local build
# never reaches EAS's servers, so `eas submit` can't list it: the .ipa sits in
# the project root and has to be pointed at explicitly.
set -e

IPA="$(ls -t build-*.ipa 2>/dev/null | head -1)"

if [ -z "$IPA" ]; then
  echo "Hittar ingen .ipa i projektroten — kör 'npm run build:ios' först." >&2
  exit 1
fi

echo "== Skickar $IPA ($(du -h "$IPA" | cut -f1), byggd $(date -r "$IPA" '+%Y-%m-%d %H:%M')) =="
npx eas-cli submit --platform ios --profile production --path "$IPA"
