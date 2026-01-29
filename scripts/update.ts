#!/usr/bin/env bun

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import * as readline from "node:readline";

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
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
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

  // Show summary
  console.log("\nUpdated packages:");
  for (const { pkg, newVersion } of updates) {
    console.log(`  ${pkg.name}: ${newVersion}`);
  }

  console.log("\nDone! Run `bun run publish` to publish packages.");
}

main();
