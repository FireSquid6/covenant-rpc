#!/usr/bin/env bun

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";

const PACKAGES_DIR = "packages";

interface PackageJson {
  name: string;
  private?: boolean;
}

async function readPackageJson(dir: string): Promise<PackageJson> {
  const file = Bun.file(join(dir, "package.json"));
  return await file.json();
}

async function main() {
  console.log("🧪 Testing all packages...\n");
  console.log("  🔍 Typechecking...");
  try {
    await $`tsc --noEmit`;
    console.log("  ✅ Typecheck passed");
  } catch (error) {
    console.error("  ❌ Typecheck failed");
    process.exit(1);
  }


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
    console.log(`\n📦 ${pkg.name}`);
    console.log("─".repeat(50));

    // Step 1: Typecheck
    console.log("  🔍 Typechecking...");
    try {
      await $`cd ${dir} && tsc --noEmit`.quiet();
      console.log("  ✅ Typecheck passed");
    } catch (error) {
      console.error("  ❌ Typecheck failed");
      failed = true;
      continue; // Skip tests if typecheck fails
    }

    // Step 2: Run tests
    console.log("  🧪 Running tests...");
    try {
      const result = await $`cd ${dir} && bun test`.quiet();
      if (result.exitCode === 0) {
        console.log("  ✅ Tests passed");
      } else {
        // Check if there are no test files (which is okay)
        const output = result.stderr.toString() + result.stdout.toString();
        if (output.includes("0 test files matching") || output.includes("No tests found")) {
          console.log("  ⚠️  No tests found (skipping)");
        } else {
          console.error("  ❌ Tests failed");
          console.error(output);
          failed = true;
        }
      }
    } catch (error: any) {
      // Check if there are no test files (which is okay)
      const output = (error.stderr?.toString() || "") + (error.stdout?.toString() || "");
      if (output.includes("0 test files matching") || output.includes("No tests found")) {
        console.log("  ⚠️  No tests found (skipping)");
      } else {
        console.error("  ❌ Tests failed");
        console.error(output);
        failed = true;
      }
    }
  }

  // Run e2e tests
  const E2E_DIR = "e2e-test";
  console.log(`\n🌐 e2e-test`);
  console.log("─".repeat(50));

  console.log("  🔍 Typechecking...");
  try {
    await $`cd ${E2E_DIR} && tsc --noEmit`.quiet();
    console.log("  ✅ Typecheck passed");
  } catch {
    console.error("  ❌ Typecheck failed");
    failed = true;
  }

  if (!failed) {
    console.log("  🧪 Running e2e tests...");
    try {
      await $`cd ${E2E_DIR} && bun test`.quiet();
      console.log("  ✅ E2e tests passed");
    } catch (error: any) {
      console.error("  ❌ E2e tests failed");
      console.error((error.stderr?.toString() || "") + (error.stdout?.toString() || ""));
      failed = true;
    }
  }

  console.log("\n" + "=".repeat(50));
  if (failed) {
    console.error("❌ Some packages failed testing");
    process.exit(1);
  } else {
    console.log("✅ All packages passed testing");
  }
}

main();
