#!/bin/sh
# lint the built bundle: only `'Pool' is not defined` is expected (it is guarded)
cd "$(dirname "$0")" && cp ../../game.js check.mjs && npx -y eslint -c eslint.config.mjs check.mjs 2>&1 | grep -v "^$" | head -60; rm -f check.mjs
