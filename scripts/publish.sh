#!/bin/bash

# Publish script that handles workspace:* dependencies
# Run this after `bunx changeset version`

set -e

PACKAGES_DIR="packages"
BACKUP_SUFFIX=".workspace-backup"

# Get the version of a package by name
get_package_version() {
  local pkg_name="$1"
  for dir in "$PACKAGES_DIR"/*/; do
    if [ -f "$dir/package.json" ]; then
      local name=$(jq -r '.name' "$dir/package.json")
      if [ "$name" = "$pkg_name" ]; then
        jq -r '.version' "$dir/package.json"
        return
      fi
    fi
  done
}

# Replace workspace:* with actual versions in a package.json
fix_workspace_deps() {
  local pkg_json="$1"
  local tmp_file=$(mktemp)

  # Backup original
  cp "$pkg_json" "${pkg_json}${BACKUP_SUFFIX}"

  # Get all workspace:* dependencies and replace them
  jq -r '.dependencies // {} | to_entries[] | select(.value == "workspace:*") | .key' "$pkg_json" | while read dep_name; do
    if [ -n "$dep_name" ]; then
      local version=$(get_package_version "$dep_name")
      if [ -n "$version" ]; then
        echo "  Replacing $dep_name: workspace:* -> ^$version"
        jq ".dependencies[\"$dep_name\"] = \"^$version\"" "$pkg_json" > "$tmp_file" && mv "$tmp_file" "$pkg_json"
      fi
    fi
  done

  rm -f "$tmp_file"
}

# Restore original package.json from backup
restore_workspace_deps() {
  local pkg_json="$1"
  if [ -f "${pkg_json}${BACKUP_SUFFIX}" ]; then
    mv "${pkg_json}${BACKUP_SUFFIX}" "$pkg_json"
  fi
}

# Publish a single package
publish_package() {
  local dir="$1"
  local pkg_json="$dir/package.json"

  # Skip private packages
  if [ "$(jq -r '.private // false' "$pkg_json")" = "true" ]; then
    echo "Skipping private package: $dir"
    return
  fi

  local name=$(jq -r '.name' "$pkg_json")
  local version=$(jq -r '.version' "$pkg_json")

  echo "Publishing $name@$version..."

  # Fix workspace dependencies
  fix_workspace_deps "$pkg_json"

  # Publish
  (cd "$dir" && npm publish --access public) || {
    echo "Failed to publish $name"
    restore_workspace_deps "$pkg_json"
    return 1
  }

  # Restore original package.json
  restore_workspace_deps "$pkg_json"

  echo "Published $name@$version"
}

# Main
echo "Publishing packages..."

for dir in "$PACKAGES_DIR"/*/; do
  if [ -f "$dir/package.json" ]; then
    publish_package "$dir"
  fi
done

echo "Done!"
