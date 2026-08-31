#!/usr/bin/env bash
# Runs the same pre-flight checks every time, then kicks off a new
# production iOS build. Stops immediately if any check fails, so a broken
# build never gets uploaded to EAS.
set -e

echo "== Typecheck =="
npx tsc --noEmit

echo "== Lint =="
npm run lint

echo "== Expo doctor =="
npx expo-doctor

echo "== Starting EAS build (production, iOS) =="
npx eas-cli build --platform ios --profile production
