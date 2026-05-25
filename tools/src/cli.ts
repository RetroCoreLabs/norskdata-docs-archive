#!/usr/bin/env node

/**
 * CLI for the Norsk Data Documentation Archive.
 * Import, catalog, search, and sync tools.
 */

import { Command } from "commander";
import { resolve } from "node:path";
import {
  loadDocCatalog,
  saveDocCatalog,
  findByTitle,
  getTextPath,
  writeTextFile,
} from "./api/catalog.js";
import { checkAllDeps, printDepReport } from "./api/check-deps.js";
import { importDocument } from "./api/import.js";
import { getUnsyncedDocs, detectDocChanges, syncDocToIa, verifyDocOnIa } from "./api/ia-sync.js";
import { buildIndex, searchIndex } from "./api/index-builder.js";
import {
  parseNdNumber,
  extractNdNumberFromFilename,
  formatNdNumber,
  type Category,
} from "./api/nd-numbering.js";
import { runMigration } from "./migrate.js";
import { readFileSync, existsSync, copyFileSync } from "node:fs";
import { basename } from "node:path";

const program = new Command();

// Determine the repository root (two levels up from tools/src or tools/dist)
function findRootDir(): string {
  // Walk up from this script's location
  const scriptDir = new URL(".", import.meta.url).pathname;
  // From dist/ or src/, go up to tools/, then up to repo root
  return resolve(scriptDir, "..", "..");
}

function loadCategories(rootDir: string): Category[] {
  const raw = readFileSync(
    resolve(rootDir, "catalog", "categories.json"),
    "utf-8"
  );
  return JSON.parse(raw) as Category[];
}

program
  .name("nddocs-cli")
  .description(
    "Import, catalog, OCR pipeline, and sync tools for the Norsk Data Documentation Archive"
  )
  .version("0.2.0");

// ---------- migrate ----------
program
  .command("migrate")
  .description(
    "Migrate legacy documents.json to the new catalog format"
  )
  .requiredOption(
    "--source <path>",
    "Path to the legacy documents.json file"
  )
  .action((opts: { source: string }) => {
    const rootDir = findRootDir();
    const sourcePath = resolve(opts.source);
    console.log(`Migrating from: ${sourcePath}`);
    console.log(`Target catalog: ${resolve(rootDir, "catalog", "documents.json")}`);

    const { entries, errors, warnings } = runMigration(sourcePath, rootDir);

    console.log(`\nMigrated ${entries.length} entries.`);

    if (warnings.length > 0) {
      console.log(`\nWarnings (${warnings.length}):`);
      for (const w of warnings) {
        console.log(`  - ${w}`);
      }
    }

    if (errors.length > 0) {
      console.log(`\nErrors (${errors.length}):`);
      for (const err of errors) {
        console.log(`  - ${err}`);
      }
    }

    // Summary: show ND number parsing results
    let parsed = 0;
    let unparsed = 0;
    for (const entry of entries) {
      if (entry.ndNumber) {
        parsed++;
      } else {
        unparsed++;
        console.log(`  [no ND#] ${entry.id} -- ${entry.title}`);
      }
    }
    console.log(
      `\nND number parsing: ${parsed} parsed, ${unparsed} without ND number.`
    );

    if (errors.length === 0) {
      console.log("\nMigration completed successfully.");
    } else {
      console.log("\nMigration completed with errors.");
      process.exit(1);
    }
  });

// ---------- import ----------
program
  .command("import")
  .description("Import a document PDF into the catalog")
  .argument("<source>", "Path to PDF file")
  .option("--title <title>", "Document title (extracted from filename if omitted)")
  .option("--category <category>", "Document category")
  .option("--category-id <id>", "Category ID code")
  .option("--copy", "Copy the PDF to the documents directory")
  .option("--dry-run", "Show what would happen without modifying anything")
  .action(
    (
      source: string,
      opts: {
        title?: string;
        category?: string;
        categoryId?: string;
        copy?: boolean;
        dryRun?: boolean;
      }
    ) => {
      const rootDir = findRootDir();
      const categories = loadCategories(rootDir);

      const result = importDocument({
        rootDir,
        filePath: resolve(source),
        categories,
        title: opts.title,
        category: opts.category,
        categoryId: opts.categoryId,
        copyFile: opts.copy,
        dryRun: opts.dryRun,
      });

      if (result.success) {
        console.log(`[OK] ${result.message}`);
        if (result.entry) {
          console.log(`  ID: ${result.entry.id}`);
          console.log(`  Title: ${result.entry.title}`);
          if (result.entry.ndNumber) {
            console.log(`  ND Number: ${formatNdNumber(result.entry.ndNumber)}`);
          }
        }
      } else {
        console.log(`[FAIL] ${result.message}`);
        process.exit(1);
      }
    }
  );

// ---------- search ----------
program
  .command("search")
  .description("Search the document catalog")
  .argument("<query>", "Search query (title, ND number, or keyword)")
  .action((query: string) => {
    const rootDir = findRootDir();
    const catalog = loadDocCatalog(rootDir);

    // Try parsing as ND number first
    const ndNum = parseNdNumber(query);
    if (ndNum) {
      const formatted = formatNdNumber(ndNum);
      const matches = catalog.filter((e) => e.id === formatted);
      if (matches.length > 0) {
        for (const m of matches) {
          console.log(`${m.id}  ${m.title}`);
          console.log(`  Category: ${m.category} (${m.categoryId})`);
          console.log(`  Renditions: ${m.renditions.length}`);
          console.log("");
        }
        return;
      }
    }

    // Full-text search via index
    const index = buildIndex(catalog);
    const results = searchIndex(index, query);

    if (results.length === 0) {
      console.log("No results found.");
      return;
    }

    console.log(`Found ${results.length} result(s):\n`);
    for (const r of results) {
      console.log(`${r.id}  ${r.title}`);
      console.log(`  Category: ${r.category} (${r.categoryId})`);
      console.log("");
    }
  });

// ---------- check ----------
program
  .command("check")
  .description("Validate catalog JSON against schema and check consistency")
  .action(() => {
    const rootDir = findRootDir();
    const catalog = loadDocCatalog(rootDir);
    let issues = 0;

    console.log(`Checking ${catalog.length} catalog entries...\n`);

    // Check required fields
    for (const entry of catalog) {
      if (!entry.schemaVersion) {
        console.log(`[WARN] ${entry.id}: missing schemaVersion`);
        issues++;
      }
      if (!entry.title) {
        console.log(`[WARN] ${entry.id}: missing title`);
        issues++;
      }
      if (!entry.category) {
        console.log(`[WARN] ${entry.id}: missing category`);
        issues++;
      }
      if (entry.renditions.length === 0) {
        console.log(`[WARN] ${entry.id}: no renditions`);
        issues++;
      }
    }

    // Check for duplicate IDs
    const ids = new Set<string>();
    for (const entry of catalog) {
      if (ids.has(entry.id)) {
        console.log(`[ERROR] Duplicate ID: ${entry.id}`);
        issues++;
      }
      ids.add(entry.id);
    }

    if (issues === 0) {
      console.log("All checks passed.");
    } else {
      console.log(`\n${issues} issue(s) found.`);
    }
  });

// ---------- check-deps ----------
program
  .command("check-deps")
  .description("Check that all required tools are installed")
  .action(() => {
    const results = checkAllDeps();
    const ok = printDepReport(results);
    if (!ok) process.exit(1);
  });

// ---------- ia-sync ----------
program
  .command("ia-sync")
  .description("Sync unsynced documents to Internet Archive")
  .option("--dry-run", "Show what would change without uploading")
  .action((opts: { dryRun?: boolean }) => {
    const rootDir = findRootDir();
    const catalog = loadDocCatalog(rootDir);
    const unsynced = getUnsyncedDocs(catalog);

    console.log(`Found ${unsynced.length} unsynced document(s).\n`);

    for (const entry of unsynced) {
      const result = syncDocToIa(entry, opts.dryRun ?? true);
      console.log(`  ${result.message}`);
    }
  });

// ---------- ia-verify ----------
program
  .command("ia-verify")
  .description("Verify checksums of all IA items")
  .action(() => {
    const rootDir = findRootDir();
    const catalog = loadDocCatalog(rootDir);
    const withIa = catalog.filter(
      (e) => e.storage?.internetArchive?.itemId
    );

    if (withIa.length === 0) {
      console.log("No documents have been uploaded to IA yet.");
      return;
    }

    for (const entry of withIa) {
      const result = verifyDocOnIa(entry);
      const status = result.verified ? "[OK]" : "[--]";
      console.log(`  ${status} ${result.message}`);
    }
  });

// ---------- ocr-strip ----------
program
  .command("ocr-strip")
  .description("Strip existing OCR layer from a PDF (requires qpdf)")
  .argument("<source>", "Path to PDF")
  .action((source: string) => {
    console.log(
      `Not yet implemented: ocr-strip for ${source}\n` +
        "Requires: qpdf (check with 'nddocs-cli check-deps')"
    );
  });

// ---------- ocr-redo ----------
program
  .command("ocr-redo")
  .description("Re-OCR a PDF using ocrmypdf")
  .argument("<source>", "Path to PDF")
  .action((source: string) => {
    console.log(
      `Not yet implemented: ocr-redo for ${source}\n` +
        "Requires: ocrmypdf (check with 'nddocs-cli check-deps')"
    );
  });

// ---------- ai-text ----------
program
  .command("ai-text")
  .description("Generate text from a PDF using vision models")
  .argument("<source>", "Path to PDF")
  .action((source: string) => {
    console.log(
      `Not yet implemented: ai-text for ${source}\n` +
        "Requires: pdftoppm, ANTHROPIC_API_KEY (check with 'nddocs-cli check-deps')"
    );
  });

// ---------- import-text ----------
program
  .command("import-text")
  .description("Import a text file for a cataloged document")
  .argument("<docId>", "Document ID (e.g., ND-60.128.03)")
  .argument("<textFile>", "Path to the .txt file to import")
  .option(
    "--source <source>",
    "How the text was generated (ocr, ai, hand-curated, imported-from-ndinsight)",
    "ocr"
  )
  .option(
    "--quality <quality>",
    "Text quality (excellent, good, fair, poor)"
  )
  .action(
    (
      docId: string,
      textFile: string,
      opts: { source?: string; quality?: string }
    ) => {
      const rootDir = findRootDir();
      const catalog = loadDocCatalog(rootDir);
      const categories = loadCategories(rootDir);

      // Find the document
      const entry = catalog.find((e) => e.id === docId);
      if (!entry) {
        console.log(`[FAIL] Document not found: ${docId}`);
        process.exit(1);
      }

      // Validate text file
      const srcPath = resolve(textFile);
      if (!existsSync(srcPath)) {
        console.log(`[FAIL] Text file not found: ${srcPath}`);
        process.exit(1);
      }

      // Read and write
      const textContent = readFileSync(srcPath, "utf-8");
      const gitPath = writeTextFile(rootDir, entry, textContent, categories);

      if (!gitPath) {
        console.log(
          `[FAIL] Could not compute text path for ${docId} (no ND number?)`
        );
        process.exit(1);
      }

      // Update catalog entry
      entry.files.text = gitPath;
      entry.files.textSource = opts.source ?? "ocr";
      entry.files.textQuality = opts.quality ?? null;
      saveDocCatalog(rootDir, catalog);

      console.log(`[OK] Imported text for ${docId}`);
      console.log(`  Path: ${gitPath}`);
      console.log(`  Source: ${entry.files.textSource}`);
      console.log(`  Size: ${textContent.length} bytes`);
    }
  );

// ---------- import-ndinsight ----------
program
  .command("import-ndinsight")
  .description(
    "Import NDInsight transcriptions (stub: shows what would be imported)"
  )
  .argument("<ndinsightDir>", "Path to NDInsight/Reference-Manuals directory")
  .action((ndinsightDir: string) => {
    const rootDir = findRootDir();
    const catalog = loadDocCatalog(rootDir);
    const categories = loadCategories(rootDir);
    const srcDir = resolve(ndinsightDir);

    if (!existsSync(srcDir)) {
      console.log(`[FAIL] NDInsight directory not found: ${srcDir}`);
      process.exit(1);
    }

    console.log(`Scanning NDInsight directory: ${srcDir}`);
    console.log("(stub: not yet importing, just showing matches)\n");

    // Look for .md files in the directory
    const { readdirSync } = require("node:fs");
    const files: string[] = readdirSync(srcDir).filter((f: string) =>
      f.endsWith(".md")
    );

    let matched = 0;
    let unmatched = 0;

    for (const file of files) {
      const ndNum = extractNdNumberFromFilename(file);
      if (ndNum) {
        const formatted = formatNdNumber(ndNum);
        const entry = catalog.find((e) => e.id === formatted);
        if (entry) {
          const textPath = getTextPath(entry, categories);
          console.log(`  [match] ${file} -> ${formatted} -> ${textPath}`);
          matched++;
        } else {
          console.log(`  [no catalog entry] ${file} -> ${formatted}`);
          unmatched++;
        }
      } else {
        console.log(`  [no ND#] ${file}`);
        unmatched++;
      }
    }

    console.log(
      `\n${files.length} files scanned: ${matched} matched, ${unmatched} unmatched.`
    );
    console.log(
      "To actually import, run with --execute (not yet implemented)."
    );
  });

program.parse();
