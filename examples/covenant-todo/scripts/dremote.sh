#!/usr/bin/env bash

OPTION=$1

if [ -z "$OPTION" ]; then
  echo "No command provided"
  exit 1
fi

set -a
source .env.local.production

bunx drizzle-kit "$OPTION" --config "drizzle-configs/remote.config.ts"
