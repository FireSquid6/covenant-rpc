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

async function prompt(message: string): Promise<string> {
  process.stdout.write(message);
  for await (const line of console) {
    return line.trim();
  }
  return "";
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

  // Show packages with numbers
  console.log("\nPackages:");
  packages.forEach(({ pkg }, i) => {
    const status = pkg.private ? " (private)" : "";
    console.log(`  ${i + 1}) ${pkg.name} @ ${pkg.version}${status}`);
  });

  // Prompt for which packages to update
  console.log("\nEnter package numbers to update (comma-separated, or 'all'):");
  console.log("Example: 1,3,4 or all");

  const selection = await prompt("\nPackages: ");

  let selectedIndices: number[];
  if (selection.toLowerCase() === "all") {
    selectedIndices = packages.map((_, i) => i);
  } else {
    selectedIndices = selection
      .split(",")
      .map(s => parseInt(s.trim()) - 1)
      .filter(i => i >= 0 && i < packages.length);
  }

  if (selectedIndices.length === 0) {
    console.log("No packages selected. Exiting.");
    process.exit(0);
  }

  console.log("\nSelected packages:");
  for (const i of selectedIndices) {
    console.log(`  - ${packages[i].pkg.name}`);
  }

  // Prompt for version bump type
  console.log("\nSelect version bump type:");
  console.log("  1) patch (0.0.x)");
  console.log("  2) minor (0.x.0)");
  console.log("  3) major (x.0.0)");
  console.log("  4) cancel");

  const choice = await prompt("\nChoice [1-4]: ");

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

  // Bump selected versions
  for (const i of selectedIndices) {
    const { dir, pkg } = packages[i];
    const newVersion = bumpVersion(pkg.version, bumpType);
    pkg.version = newVersion;
    await writePackageJson(dir, pkg);
  }

  // Show results
  console.log("\nUpdated versions:");
  for (const i of selectedIndices) {
    const { pkg } = packages[i];
    console.log(`  ${pkg.name}: ${pkg.version}`);
  }

  console.log("\nDone! Run `bun run publish` to publish packages.");
}

main();
