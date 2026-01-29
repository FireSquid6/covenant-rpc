#!/usr/bin/env bun

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import * as readline from "node:readline";

const PACKAGES_DIR = "packages";

function prompt(message: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

interface PackageJson {
  name: string;
  version: string;
  private?: boolean;
  dependencies?: Record<string, string>;
}

async function readPackageJson(dir: string): Promise<PackageJson> {
  const file = Bun.file(join(dir, "package.json"));
  return await file.json();
}

async function writePackageJson(dir: string, pkg: PackageJson) {
  const file = Bun.file(join(dir, "package.json"));
  await Bun.write(file, JSON.stringify(pkg, null, 2) + "\n");
}

async function versionExistsOnNpm(name: string, version: string): Promise<boolean> {
  try {
    const result = await $`npm view ${name}@${version} version`.quiet();
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

async function main() {
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

  // Build version map for workspace dependency resolution
  const versionMap: Record<string, string> = {};
  for (const { pkg } of packages) {
    versionMap[pkg.name] = pkg.version;
  }

  // Prompt for OTP
  const otp = await prompt("Enter npm OTP: ");

  if (!otp) {
    console.log("OTP required. Exiting.");
    process.exit(1);
  }

  console.log("\nChecking which packages need publishing...\n");

  for (const { dir, pkg } of packages) {
    // Skip private packages
    if (pkg.private) {
      console.log(`⏭️  ${pkg.name} (private, skipping)`);
      continue;
    }

    // Check if version already exists
    const exists = await versionExistsOnNpm(pkg.name, pkg.version);
    if (exists) {
      console.log(`⏭️  ${pkg.name}@${pkg.version} (already published)`);
      continue;
    }

    console.log(`📦 Publishing ${pkg.name}@${pkg.version}...`);

    // Replace workspace:* with actual versions
    const originalDeps = pkg.dependencies ? { ...pkg.dependencies } : undefined;

    if (pkg.dependencies) {
      for (const [dep, version] of Object.entries(pkg.dependencies)) {
        if (version === "workspace:*" && versionMap[dep]) {
          pkg.dependencies[dep] = `^${versionMap[dep]}`;
        }
      }
      await writePackageJson(dir, pkg);
    }

    // Publish
    try {
      await $`cd ${dir} && npm publish --access public --otp=${otp}`.quiet();
      console.log(`✅ Published ${pkg.name}@${pkg.version}`);
    } catch (e) {
      console.log(`❌ Failed to publish ${pkg.name}@${pkg.version}`);
      console.error(e);
    }

    // Restore original dependencies
    if (originalDeps) {
      pkg.dependencies = originalDeps;
      await writePackageJson(dir, pkg);
    }
  }

  console.log("\nDone!");
}

main();
