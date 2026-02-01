#!/usr/bin/env bun

import { $ } from "bun";

/**
 * Build script that preserves directory structure
 * Uses tsc to transpile TypeScript to JavaScript while preserving module structure
 * Usage: bun scripts/build-package.ts <package-dir>
 */

const packageDir = process.argv[2];

if (!packageDir) {
  console.error("Usage: bun scripts/build-package.ts <package-dir>");
  process.exit(1);
}

async function main() {
  console.log(`Building package: ${packageDir}`);

  // Clean dist directory
  await $`rm -rf ${packageDir}/dist`.quiet();

  // Build with tsc - this will generate both .js and .d.ts files
  console.log("Compiling TypeScript...");
  try {
    await $`cd ${packageDir} && tsc -p tsconfig.build.json`.quiet();
    console.log("✅ Build complete");
  } catch (error) {
    console.error("Failed to build:", error);
    process.exit(1);
  }
}

main();
