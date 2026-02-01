#!/usr/bin/env bash

# Clean all dist directories in packages
echo "Cleaning dist directories..."

# Remove all dist directories from packages
rm -rf packages/*/dist

echo "✓ All dist directories removed"
