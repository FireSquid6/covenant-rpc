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
  main?: string;
  module?: string;
  types?: string;
  exports?: unknown;
  files?: string[];
  dependencies?: Record<string, string>;
  [key: string]: unknown;
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

async function isGitClean(): Promise<boolean> {
  const result = await $`git status --porcelain`.quiet();
  return result.text().trim() === "";
}

async function main() {
  // Check for clean git repo
  if (!(await isGitClean())) {
    console.error("Error: Git working directory is not clean.");
    console.error("Please commit or stash your changes before publishing.");
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

    console.log(`📦 Building and publishing ${pkg.name}@${pkg.version}...`);

    // Clean and build the package
    try {
      console.log(`  🔨 Building...`);
      await $`rm -rf ${join(dir, "dist")}`.quiet();
      await $`cd ${dir} && bun run build`.quiet();
    } catch (e) {
      console.log(`❌ Failed to build ${pkg.name}@${pkg.version}`);
      console.error(e);
      continue;
    }

    // Save original package.json (entire object)
    const originalPkg = JSON.parse(JSON.stringify(pkg));

    // Rewrite package.json for publishing
    // 1. Replace workspace:* with actual versions
    if (pkg.dependencies) {
      for (const [dep, version] of Object.entries(pkg.dependencies)) {
        if (version === "workspace:*" && versionMap[dep]) {
          pkg.dependencies[dep] = `^${versionMap[dep]}`;
        }
      }
    }

    // 2. Point to dist/ instead of source .ts files
    if (pkg.module && pkg.module.endsWith(".ts")) {
      pkg.module = pkg.module.replace(/\.ts$/, ".js").replace(/^\.\//, "./dist/");
      if (!pkg.module.startsWith("./dist/")) {
        pkg.module = `./dist/${pkg.module}`;
      }
    }
    if (pkg.main && pkg.main.endsWith(".ts")) {
      pkg.main = pkg.main.replace(/\.ts$/, ".js").replace(/^\.\//, "./dist/");
      if (!pkg.main.startsWith("./dist/")) {
        pkg.main = `./dist/${pkg.main}`;
      }
    }

    // 3. Set types field
    const indexPath = pkg.module || pkg.main || "./dist/index.js";
    pkg.types = indexPath.replace(/\.js$/, ".d.ts");

    // 4. Rewrite exports field to point to dist/
    if (pkg.exports && typeof pkg.exports === "object") {
      const newExports: any = {};
      for (const [key, value] of Object.entries(pkg.exports)) {
        if (typeof value === "object" && value !== null) {
          newExports[key] = {};
          for (const [condition, path] of Object.entries(value as Record<string, any>)) {
            if (typeof path === "string") {
              // Rewrite .ts to .js and ensure it's in dist/
              let newPath = path.replace(/\.ts$/, ".js");
              if (newPath.includes("*")) {
                // Handle wildcards: "./*.ts" -> "./dist/*.js"
                newPath = newPath.replace(/^\.\//, "./dist/");
              } else if (!newPath.startsWith("./dist/")) {
                newPath = newPath.replace(/^\.\//, "./dist/");
              }
              // For types, change .js to .d.ts
              if (condition === "types") {
                newPath = newPath.replace(/\.js$/, ".d.ts");
              }
              newExports[key][condition] = newPath;
            } else {
              newExports[key][condition] = path;
            }
          }
        } else {
          newExports[key] = value;
        }
      }
      pkg.exports = newExports;
    }

    // 5. Only include dist/ folder in published package
    pkg.files = ["dist"];

    await writePackageJson(dir, pkg);

    // Publish
    try {
      await $`cd ${dir} && npm publish --access public --otp=${otp}`.quiet();
      console.log(`✅ Published ${pkg.name}@${pkg.version}`);
    } catch (e) {
      console.log(`❌ Failed to publish ${pkg.name}@${pkg.version}`);
      console.error(e);
    }

    // Restore original package.json
    await writePackageJson(dir, originalPkg);
  }

  console.log("\nDone!");
}

main();
