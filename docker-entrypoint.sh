#!/bin/sh
set -e

node /app/scripts/migrate-prod.mjs

exec node /app/server.js
