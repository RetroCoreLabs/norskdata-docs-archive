/**
 * Import a PDF document into the catalog.
 *
 * Steps:
 *   1. Compute MD5 + SHA256 checksums
 *   2. Extract ND number from filename
 *   3. Check for duplicates
 *   4. Create a catalog entry with the renditions model
 *   5. Determine target directory from ND number + categories
 *   6. Optionally copy/move file (local staging only; PDFs go to IA)
 */

import { createHash } from "node:crypto";
import { readFileSync, statSync, copyFileSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import {
  extractNdNumberFromFilename,
  formatNdNumber,
  ndNumberToPath,
  type NdNumber,
  type Category,
} from "./nd-numbering.js";
import {
  loadDocCatalog,
  saveDocCatalog,
  generateDocId,
  type CatalogEntry,
  type Rendition,
} from "./catalog.js";
import { checkDocDuplicate } from "./dedup.js";

export interface ImportOptions {
  rootDir: string;
  filePath: string;
  categories: Category[];
  title?: string;
  category?: string;
  categoryId?: string;
  copyFile?: boolean;
  dryRun?: boolean;
}

export interface ImportResult {
  success: boolean;
  entry?: CatalogEntry;
  message: string;
  isDuplicate: boolean;
  isRendition: boolean;
}

function computeHash(
  data: Buffer,
  algorithm: "md5" | "sha256"
): string {
  return createHash(algorithm).update(data).digest("hex");
}

function extractLanguageFromFilename(filename: string): string {
  if (/_EN[._\s]/i.test(filename)) return "EN";
  if (/_NO[._\s]/i.test(filename)) return "NO";
  // Default to English for ND documents
  return "EN";
}

/**
 * Import a single PDF file into the catalog.
 */
export function importDocument(options: ImportOptions): ImportResult {
  const {
    rootDir,
    filePath,
    categories,
    copyFile = false,
    dryRun = false,
  } = options;

  const fileName = basename(filePath);

  // Read file and compute checksums
  let fileData: Buffer;
  let fileSize: number;
  try {
    fileData = readFileSync(filePath);
    fileSize = statSync(filePath).size;
  } catch (err) {
    return {
      success: false,
      message: `Failed to read file: ${filePath} -- ${String(err)}`,
      isDuplicate: false,
      isRendition: false,
    };
  }

  const md5 = computeHash(fileData, "md5");
  const sha256 = computeHash(fileData, "sha256");

  // Extract ND number from filename
  const ndNumber = extractNdNumberFromFilename(fileName);

  // Load existing catalog and check for duplicates
  const catalog = loadDocCatalog(rootDir);
  const dupCheck = checkDocDuplicate(catalog, md5, ndNumber, options.title);

  if (dupCheck.isDuplicate) {
    return {
      success: false,
      message: `Duplicate: ${dupCheck.reason}`,
      isDuplicate: true,
      isRendition: false,
    };
  }

  // Build rendition
  const rendition: Rendition = {
    role: "scan",
    source: "unknown",
    md5,
    sha256,
    fileSize,
    iaFile: null,
    isPrimary: true,
    ocrTool: null,
    isFindingAid: false,
    notes: null,
    generatedDate: null,
    gitPath: null,
  };

  if (dupCheck.isRendition && dupCheck.existingEntry) {
    // Add as a new rendition to existing entry
    if (!dryRun) {
      dupCheck.existingEntry.renditions.push(rendition);
      saveDocCatalog(rootDir, catalog);
    }
    return {
      success: true,
      entry: dupCheck.existingEntry,
      message: `Added as new rendition to existing entry "${dupCheck.existingEntry.id}"`,
      isDuplicate: false,
      isRendition: true,
    };
  }

  // Create new entry
  const language = extractLanguageFromFilename(fileName);
  const entryCategory = options.category ?? "Unknown";
  const entryCategoryId = options.categoryId ?? "00";

  const newEntry: CatalogEntry = {
    schemaVersion: "1.0",
    id: ndNumber ? formatNdNumber(ndNumber) : generateDocId({ title: options.title ?? fileName, fileName }),
    ndNumber: ndNumber ?? null,
    title: options.title ?? fileName.replace(/\.\w+$/, "").replace(/[_-]/g, " "),
    language,
    preliminary: false,
    category: entryCategory,
    categoryId: entryCategoryId,
    documentType: "unknown",
    publisher: "norsk-data",
    description: "",
    abstract: "",
    date: null,
    pages: null,
    author: null,
    productIds: [],
    machineIds: [],
    supersedes: null,
    supersededBy: null,
    sources: [],
    files: { text: null, textSource: null, textQuality: null },
    renditions: [rendition],
    storage: { internetArchive: null },
    ocrQuality: null,
    provenance: {
      importDate: new Date().toISOString().split("T")[0],
      importSource: filePath,
      preservationNotes: null,
    },
    tags: [],
    keywords: [],
  };

  if (!dryRun) {
    catalog.push(newEntry);
    saveDocCatalog(rootDir, catalog);

    // Optionally copy the file to the target directory
    if (copyFile && ndNumber) {
      const relPath = ndNumberToPath(ndNumber, categories);
      const targetDir = join(rootDir, "documents", relPath);
      mkdirSync(targetDir, { recursive: true });
      copyFileSync(filePath, join(targetDir, fileName));
    }
  }

  return {
    success: true,
    entry: newEntry,
    message: `Imported as "${newEntry.id}"`,
    isDuplicate: false,
    isRendition: false,
  };
}
