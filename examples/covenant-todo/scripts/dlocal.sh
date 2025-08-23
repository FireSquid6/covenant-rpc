#!/usr/bin/env bash

OPTION=$1

if [ -z "$OPTION" ]; then
  echo "No command provided"
  exit 1
fi

bunx drizzle-kit "$OPTION" --config "drizzle-configs/local.config.ts"
