#!/usr/bin/env bun

import { readdir } from "node:fs/promises";
import { join } from "node:path";

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

  // Show current versions
  console.log("\nCurrent versions:");
  for (const { pkg } of packages) {
    const status = pkg.private ? " (private)" : "";
    console.log(`  ${pkg.name}: ${pkg.version}${status}`);
  }

  // Prompt for version bump type
  console.log("\nSelect version bump type:");
  console.log("  1) patch (0.0.x)");
  console.log("  2) minor (0.x.0)");
  console.log("  3) major (x.0.0)");
  console.log("  4) cancel");

  process.stdout.write("\nChoice [1-4]: ");

  for await (const line of console) {
    const choice = line.trim();

    let bumpType: "major" | "minor" | "patch";
    switch (choice) {
      case "1":
        bumpType = "patch";
        break;
      case "2":
        bumpType = "minor";
        break;
      case "3":
        bumpType = "major";
        break;
      case "4":
        console.log("Cancelled.");
        process.exit(0);
      default:
        console.log("Invalid choice.");
        process.exit(1);
    }

    // Bump all versions
    const newVersions: Record<string, string> = {};

    for (const { dir, pkg } of packages) {
      const newVersion = bumpVersion(pkg.version, bumpType);
      newVersions[pkg.name] = newVersion;
      pkg.version = newVersion;
    }

    // Update workspace dependencies to use new versions
    for (const { dir, pkg } of packages) {
      if (pkg.dependencies) {
        for (const [dep, version] of Object.entries(pkg.dependencies)) {
          if (version === "workspace:*" && newVersions[dep]) {
            // Keep workspace:* - it gets replaced at publish time
          }
        }
      }
      await writePackageJson(dir, pkg);
    }

    // Show new versions
    console.log("\nUpdated versions:");
    for (const { pkg } of packages) {
      const status = pkg.private ? " (private)" : "";
      console.log(`  ${pkg.name}: ${pkg.version}${status}`);
    }

    console.log("\nDone! Run `bun run publish` to publish packages.");
    break;
  }
}

main();
