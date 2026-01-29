#!/bin/bash

# Rename @covenant imports to @covenant-rpc across all TypeScript files
# This is needed because the @covenant namespace was taken on npm

find packages -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/@covenant\//@covenant-rpc\//g' {} +

echo "Done! Replaced @covenant/ with @covenant-rpc/ in all TypeScript files under packages/"
