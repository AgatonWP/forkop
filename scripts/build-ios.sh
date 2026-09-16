#!/usr/bin/env bash
# Runs the same pre-flight checks every time, then kicks off a new
# production iOS build. Stops immediately if any check fails, so a broken
# build never gets uploaded to EAS.
set -e

# Local build by default: the EAS free plan's cloud build quota is used up.
# Pass "cloud" as the first argument to build on EAS servers instead.
BUILD_TARGET="${1:-local}"

# fastlane drives the local archive step and refuses to run under a C/POSIX
# locale, which is what a non-interactive shell inherits.
export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

echo "== Typecheck =="
npx tsc --noEmit

echo "== Lint =="
npm run lint

echo "== Expo doctor =="
npx expo-doctor

if [ "$BUILD_TARGET" = "cloud" ]; then
  echo "== Starting EAS build (production, iOS, cloud) =="
  npx eas-cli build --platform ios --profile production
else
  if ! command -v fastlane >/dev/null; then
    echo "fastlane saknas — installera med: brew install fastlane" >&2
    exit 1
  fi

  echo "== Starting EAS build (production, iOS, local) =="
  echo "   Tar 15-25 min och lägger en .ipa i projektroten."
  npx eas-cli build --platform ios --profile production --local
fi
