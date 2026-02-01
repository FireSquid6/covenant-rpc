#!/usr/bin/env bun

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";

const PACKAGES_DIR = "packages";

interface PackageJson {
  name: string;
  private?: boolean;
  scripts?: Record<string, string>;
}

async function readPackageJson(dir: string): Promise<PackageJson> {
  const file = Bun.file(join(dir, "package.json"));
  return await file.json();
}

async function main() {
  console.log("🏗️  Building all packages...\n");

  // Get all packages
  const dirs = await readdir(PACKAGES_DIR);
  const packages: { dir: string; pkg: PackageJson }[] = [];

  for (const dir of dirs) {
    const fullPath = join(PACKAGES_DIR, dir);
    try {
      const pkg = await readPackageJson(fullPath);
      packages.push({ dir: fullPath, pkg });
    } catch {
      // Skip directories without package.json
    }
  }

  let failed = false;

  for (const { dir, pkg } of packages) {
    // Skip packages without a build script
    if (!pkg.scripts?.build) {
      console.log(`⏭️  ${pkg.name} (no build script, skipping)`);
      continue;
    }

    console.log(`📦 Building ${pkg.name}...`);

    try {
      await $`cd ${dir} && bun run build`.quiet();
      console.log(`✅ Built ${pkg.name}`);
    } catch (error) {
      console.error(`❌ Failed to build ${pkg.name}`);
      console.error(error);
      failed = true;
    }
  }

  console.log("\n" + "=".repeat(50));
  if (failed) {
    console.error("❌ Some packages failed to build");
    process.exit(1);
  } else {
    console.log("✅ All packages built successfully");
  }
}

main();
