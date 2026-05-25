/**
 * Catalog management for the Norsk Data Documentation Archive.
 * Provides read/write access to catalog/documents.json and search utilities.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import {
  type NdNumber,
  type Category,
  formatNdNumber,
  extractNdNumberFromFilename,
  ndNumberToPath,
} from "./nd-numbering.js";

/** A single rendition of a document (scan, OCR, etc.) */
export interface Rendition {
  role: "scan" | "ocr" | "cleaned" | "ai-text";
  source: string;
  md5: string | null;
  sha256: string | null;
  fileSize: number | null;
  iaFile: string | null;
  isPrimary: boolean;
  ocrTool: string | null;
  isFindingAid: boolean;
  notes: string | null;
  generatedDate: string | null;
  gitPath: string | null;
}

/** A source reference for a document. */
export interface Source {
  url: string;
  title: string;
  retrievedDate?: string | null;
}

/** A full catalog entry matching document.schema.json. */
export interface CatalogEntry {
  schemaVersion: string;
  id: string;
  ndNumber: NdNumber | null;
  title: string;
  language: string;
  preliminary: boolean;
  category: string;
  categoryId: string;
  documentType: string;
  publisher: string;
  thirdPartyPublisher?: string;
  relevance?: string;
  description: string;
  abstract: string;
  date: string | null;
  pages: number | null;
  author: string | null;
  productIds: string[];
  machineIds: string[];
  supersedes: string | null;
  supersededBy: string | null;
  sources: Source[];
  files: {
    text: string | null;
    textSource: string | null;
    textQuality: string | null;
  };
  renditions: Rendition[];
  storage: {
    internetArchive: {
      itemId: string;
      uploaded: string | null;
      verified: string | null;
      syncStatus: string;
    } | null;
  };
  ocrQuality: string | null;
  provenance: {
    importDate: string | null;
    importSource: string | null;
    preservationNotes: string | null;
  };
  tags: string[];
  keywords: string[];
}

/**
 * Load the document catalog from disk.
 */
export function loadDocCatalog(rootDir: string): CatalogEntry[] {
  const catalogPath = join(rootDir, "catalog", "documents.json");
  const raw = readFileSync(catalogPath, "utf-8");
  return JSON.parse(raw) as CatalogEntry[];
}

/**
 * Save the document catalog to disk with pretty-printed JSON.
 */
export function saveDocCatalog(
  rootDir: string,
  catalog: CatalogEntry[]
): void {
  const catalogPath = join(rootDir, "catalog", "documents.json");
  writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + "\n", "utf-8");
}

/**
 * Find a catalog entry by ND number.
 */
export function findByNdNumber(
  catalog: CatalogEntry[],
  ndNum: NdNumber
): CatalogEntry | undefined {
  const formatted = formatNdNumber(ndNum);
  return catalog.find((entry) => {
    if (entry.id === formatted) return true;
    if (entry.ndNumber) {
      return (
        entry.ndNumber.subject === ndNum.subject &&
        entry.ndNumber.sequence === ndNum.sequence &&
        entry.ndNumber.version === ndNum.version
      );
    }
    return false;
  });
}

/**
 * Search catalog entries by title (case-insensitive substring match).
 */
export function findByTitle(
  catalog: CatalogEntry[],
  title: string
): CatalogEntry[] {
  const lower = title.toLowerCase();
  return catalog.filter(
    (entry) =>
      entry.title.toLowerCase().includes(lower) ||
      entry.description.toLowerCase().includes(lower)
  );
}

/**
 * Generate a document ID from a catalog entry.
 * Uses the ND number if available, otherwise creates a slug from the title.
 */
export function generateDocId(entry: {
  ndNumber?: NdNumber | null;
  title: string;
  fileName?: string;
}): string {
  // Try ND number first
  if (entry.ndNumber) {
    return formatNdNumber(entry.ndNumber);
  }

  // Try extracting from filename
  if (entry.fileName) {
    const parsed = extractNdNumberFromFilename(entry.fileName);
    if (parsed) {
      return formatNdNumber(parsed);
    }
  }

  // Fallback: slug from title
  return entry.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 80);
}

/**
 * Compute the git-relative path for a document's text file.
 * Example: ND-60.128.03 with categories -> documents/software/60-general/ND-60.128/ND-60.128.03_EN.txt
 */
export function getTextPath(
  entry: CatalogEntry,
  categories: Category[]
): string | null {
  if (!entry.ndNumber) return null;

  const dirPath = ndNumberToPath(entry.ndNumber, categories);
  const id = formatNdNumber(entry.ndNumber);
  const lang = entry.language || "EN";
  return `documents/${dirPath}/${id}_${lang}.txt`;
}

/**
 * Write text content to the correct git path for a document.
 * Creates directories as needed.
 */
export function writeTextFile(
  rootDir: string,
  entry: CatalogEntry,
  textContent: string,
  categories: Category[]
): string | null {
  const textPath = getTextPath(entry, categories);
  if (!textPath) return null;

  const fullPath = join(rootDir, textPath);
  const dir = dirname(fullPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(fullPath, textContent, "utf-8");
  return textPath;
}

/**
 * Read text content from the git path for a document.
 * Returns null if the file does not exist.
 */
export function readTextFile(
  rootDir: string,
  entry: CatalogEntry
): string | null {
  if (!entry.files?.text) return null;

  const fullPath = join(rootDir, entry.files.text);
  if (!existsSync(fullPath)) return null;

  return readFileSync(fullPath, "utf-8");
}
