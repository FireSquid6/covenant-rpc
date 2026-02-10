#!/usr/bin/env bun

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import * as readline from "node:readline";
import { $ } from "bun";

const PACKAGES_DIR = "packages";

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

function bumpVersion(version: string, type: "major" | "minor" | "patch"): string {
  const [major, minor, patch] = version.split(".").map(Number);
  switch (type) {
    case "major":
      return `${major! + 1}.0.0`;
    case "minor":
      return `${major}.${minor! + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch! + 1}`;
  }
}

function createPrompt(): (message: string) => Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return (message: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(message, (answer) => {
        resolve(answer.trim());
      });
    });
  };
}

async function isGitClean(): Promise<boolean> {
  const result = await $`git status --porcelain`.quiet();
  return result.text().trim() === "";
}

function getTagName(pkgName: string, version: string): string {
  // @covenant-rpc/core@1.0.0 -> covenant-rpc-core-v1.0.0
  const safeName = pkgName.replace("@", "").replace("/", "-");
  return `${safeName}-v${version}`;
}

async function main() {
  // Check for clean git repo
  if (!(await isGitClean())) {
    console.error("Error: Git working directory is not clean.");
    console.error("Please commit or stash your changes before updating versions.");
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

  console.log("\nFor each package, select: [n]othing, [p]atch, [m]inor, [M]ajor\n");

  const prompt = createPrompt();
  const updates: { dir: string; pkg: PackageJson; newVersion: string }[] = [];

  for (const { dir, pkg } of packages) {
    const status = pkg.private ? " (private)" : "";
    const choice = await prompt(`${pkg.name} @ ${pkg.version}${status} [n/p/m/M]: `);

    let bumpType: "major" | "minor" | "patch" | null = null;
    switch (choice.toLowerCase()) {
      case "":
      case "n":
        // No change
        break;
      case "p":
        bumpType = "patch";
        break;
      case "m":
        bumpType = choice === "M" ? "major" : "minor";
        break;
      default:
        console.log("  Invalid choice, skipping.");
    }

    if (bumpType) {
      const newVersion = bumpVersion(pkg.version, bumpType);
      updates.push({ dir, pkg, newVersion });
      console.log(`  → ${newVersion}`);
    }
  }

  // Close readline
  process.stdin.destroy();

  if (updates.length === 0) {
    console.log("\nNo packages selected for update.");
    process.exit(0);
  }

  // Apply updates
  for (const { dir, pkg, newVersion } of updates) {
    pkg.version = newVersion;
    await writePackageJson(dir, pkg);
  }

  // Update internal dependencies
  console.log("\nUpdating internal dependencies...");
  const versionMap = new Map<string, string>();
  for (const { pkg, newVersion } of updates) {
    versionMap.set(pkg.name, newVersion);
  }

  const packagesWithUpdatedDeps: string[] = [];
  for (const { dir, pkg } of packages) {
    let hasUpdates = false;
    if (pkg.dependencies) {
      for (const [depName, depVersion] of Object.entries(pkg.dependencies)) {
        const newVersion = versionMap.get(depName);
        if (newVersion) {
          // Preserve the semver prefix (^, ~, etc.) if present
          const prefix = depVersion.match(/^[\^~]/)?.[0] || "^";
          const newDepVersion = `${prefix}${newVersion}`;
          if (pkg.dependencies[depName] !== newDepVersion) {
            pkg.dependencies[depName] = newDepVersion;
            hasUpdates = true;
            console.log(`  ${pkg.name}: ${depName} → ${newDepVersion}`);
          }
        }
      }
    }
    if (hasUpdates) {
      await writePackageJson(dir, pkg);
      packagesWithUpdatedDeps.push(dir);
    }
  }

  // Show summary
  console.log("\nUpdated packages:");
  for (const { pkg, newVersion } of updates) {
    console.log(`  ${pkg.name}: ${newVersion}`);
  }

  // Git: stage changes
  console.log("\nStaging changes...");
  for (const { dir } of updates) {
    await $`git add ${join(dir, "package.json")}`.quiet();
  }
  for (const dir of packagesWithUpdatedDeps) {
    await $`git add ${join(dir, "package.json")}`.quiet();
  }

  // Git: create commit
  const commitMessage = updates
    .map(({ pkg, newVersion }) => `${pkg.name}@${newVersion}`)
    .join(", ");

  console.log("Creating commit...");
  await $`git commit -m ${"release: " + commitMessage}`.quiet();

  // Git: create tags
  console.log("Creating tags...");
  const tags: string[] = [];
  for (const { pkg, newVersion } of updates) {
    const tag = getTagName(pkg.name, newVersion);
    tags.push(tag);
    await $`git tag ${tag}`.quiet();
    console.log(`  ${tag}`);
  }

  // Git: push commit and tags
  console.log("\nPushing commit and tags...");
  await $`git push`.quiet();
  await $`git push --tags`.quiet();

  console.log("\nDone! Run `bun run publish` to publish packages.");
}

main();
