#!/usr/bin/env bash
# Runs the screenshot comparisons (e2e/visual.spec.ts) against a fresh production build, inside the
# Playwright Linux image that CI uses, so the fonts and rendering match the committed baselines.
# Needs Docker. Extra arguments go to Playwright:
#
#   npm run e2e:visual                         # compare with the baselines
#   npm run e2e:visual -- --update-snapshots   # rewrite them (same as npm run e2e:visual:update)
set -euo pipefail
cd "$(dirname "$0")/.."

version=$(node -p "require('@playwright/test/package.json').version")
image="mcr.microsoft.com/playwright:v${version}-noble"

npm run build

# The image's browsers match the installed Playwright version. node_modules is shared with the
# host, since the test runner is plain JavaScript. linux/amd64 is what GitHub's runners use.
docker run --rm --init --ipc=host --platform linux/amd64 \
  --user "$(id -u):$(id -g)" -e HOME=/tmp \
  -e E2E_VISUAL=1 \
  -v "$PWD:/work" -w /work \
  "$image" npx playwright test "$@"
