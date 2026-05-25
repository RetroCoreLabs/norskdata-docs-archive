/**
 * Check prerequisites for the documentation archive tools.
 * Reports status and versions of required and optional dependencies.
 */

import { execSync } from "node:child_process";

export interface DepCheck {
  name: string;
  command: string;
  required: boolean;
  category: string;
}

export interface DepResult {
  name: string;
  category: string;
  required: boolean;
  found: boolean;
  version: string | null;
}

const DEPS: DepCheck[] = [
  { name: "node", command: "node --version", required: true, category: "Core" },
  { name: "npm", command: "npm --version", required: true, category: "Core" },
  { name: "git", command: "git --version", required: true, category: "Core" },
  {
    name: "python3",
    command: "python3 --version",
    required: false,
    category: "Internet Archive",
  },
  {
    name: "ia",
    command: "ia --version",
    required: false,
    category: "Internet Archive",
  },
  {
    name: "ocrmypdf",
    command: "ocrmypdf --version",
    required: false,
    category: "OCR Pipeline",
  },
  {
    name: "qpdf",
    command: "qpdf --version",
    required: false,
    category: "OCR Pipeline",
  },
  {
    name: "pdftoppm",
    command: "pdftoppm -v 2>&1 || true",
    required: false,
    category: "OCR Pipeline",
  },
];

/**
 * Check a single dependency and return its status.
 */
function checkOne(dep: DepCheck): DepResult {
  try {
    const output = execSync(dep.command, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    const version = output.split("\n")[0] ?? null;
    return {
      name: dep.name,
      category: dep.category,
      required: dep.required,
      found: true,
      version,
    };
  } catch {
    return {
      name: dep.name,
      category: dep.category,
      required: dep.required,
      found: false,
      version: null,
    };
  }
}

/**
 * Check all dependencies and return results.
 */
export function checkAllDeps(): DepResult[] {
  return DEPS.map(checkOne);
}

/**
 * Print dependency check results to stdout.
 * Returns true if all required deps are present.
 */
export function printDepReport(results: DepResult[]): boolean {
  let currentCategory = "";
  let allRequiredOk = true;

  for (const r of results) {
    if (r.category !== currentCategory) {
      currentCategory = r.category;
      console.log(`\n${currentCategory}:`);
    }
    if (r.found) {
      console.log(`  [OK] ${r.name} ${r.version ?? ""}`);
    } else if (r.required) {
      console.log(`  [MISSING] ${r.name} (required)`);
      allRequiredOk = false;
    } else {
      console.log(`  [--] ${r.name} (optional)`);
    }
  }

  // Check optional env vars
  console.log("\nOptional:");
  if (process.env.ANTHROPIC_API_KEY) {
    console.log("  [OK] ANTHROPIC_API_KEY is set");
  } else {
    console.log("  [--] ANTHROPIC_API_KEY not set (optional)");
  }

  console.log("");
  if (!allRequiredOk) {
    console.log(
      "Some required dependencies are missing. See INSTALL.md for setup instructions."
    );
  } else {
    console.log("All required dependencies are installed.");
  }

  return allRequiredOk;
}
