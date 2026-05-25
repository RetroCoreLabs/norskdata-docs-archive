#!/usr/bin/env node

import { Command } from "commander";
import { execSync } from "child_process";

const program = new Command();

program
  .name("nddocs-cli")
  .description(
    "Import, catalog, OCR pipeline, and sync tools for the Norsk Data Documentation Archive"
  )
  .version("0.1.0");

program
  .command("import")
  .description("Import a document into the catalog")
  .argument("<source>", "Path to PDF or directory")
  .action((_source) => {
    console.log("Not yet implemented: import");
  });

program
  .command("search")
  .description("Search the document catalog")
  .argument("<query>", "Search query")
  .action((_query) => {
    console.log("Not yet implemented: search");
  });

program
  .command("check")
  .description("Validate catalog JSON against schema and checksums")
  .action(() => {
    console.log("Not yet implemented: check");
  });

program
  .command("check-deps")
  .description("Check that all required tools are installed")
  .action(() => {
    checkDeps();
  });

program
  .command("ia-sync")
  .description("Incremental sync with Internet Archive")
  .option("--dry-run", "Show what would change without uploading")
  .action((_opts) => {
    console.log("Not yet implemented: ia-sync");
  });

program
  .command("ia-verify")
  .description("Verify checksums of all IA items")
  .action(() => {
    console.log("Not yet implemented: ia-verify");
  });

program
  .command("ia-upload")
  .description("Upload a single item to Internet Archive")
  .argument("<item>", "Item identifier")
  .action((_item) => {
    console.log("Not yet implemented: ia-upload");
  });

program
  .command("build-site")
  .description("Build the GitHub Pages static site")
  .action(() => {
    console.log("Not yet implemented: build-site");
  });

program
  .command("ocr-strip")
  .description("Strip existing OCR layer from a PDF")
  .argument("<source>", "Path to PDF")
  .action((_source) => {
    console.log("Not yet implemented: ocr-strip");
  });

program
  .command("ocr-redo")
  .description("Re-OCR a PDF using ocrmypdf")
  .argument("<source>", "Path to PDF")
  .action((_source) => {
    console.log("Not yet implemented: ocr-redo");
  });

program
  .command("ai-text")
  .description("Generate AI text from a PDF")
  .argument("<source>", "Path to PDF")
  .action((_source) => {
    console.log("Not yet implemented: ai-text");
  });

function checkDeps(): void {
  const deps: Array<{
    name: string;
    command: string;
    required: boolean;
    category: string;
  }> = [
    {
      name: "node",
      command: "node --version",
      required: true,
      category: "Core",
    },
    {
      name: "npm",
      command: "npm --version",
      required: true,
      category: "Core",
    },
    {
      name: "git",
      command: "git --version",
      required: true,
      category: "Core",
    },
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

  let currentCategory = "";
  let allRequiredOk = true;

  for (const dep of deps) {
    if (dep.category !== currentCategory) {
      currentCategory = dep.category;
      console.log(`\n${currentCategory}:`);
    }

    try {
      const output = execSync(dep.command, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      const version = output.split("\n")[0];
      console.log(`  [OK] ${dep.name} ${version}`);
    } catch {
      if (dep.required) {
        console.log(`  [MISSING] ${dep.name} (required)`);
        allRequiredOk = false;
      } else {
        console.log(`  [--] ${dep.name} (optional)`);
      }
    }
  }

  // Check ANTHROPIC_API_KEY
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
    process.exit(1);
  } else {
    console.log("All required dependencies are installed.");
  }
}

program.parse();
