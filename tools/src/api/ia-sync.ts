/**
 * Internet Archive sync stubs for the Norsk Data Documentation Archive.
 *
 * PDFs are stored on IA, not in git. This module provides utilities
 * for identifying unsynced documents and generating IA item identifiers.
 */

import type { CatalogEntry } from "./catalog.js";
import { formatNdNumber } from "./nd-numbering.js";

/**
 * Return catalog entries that have not yet been uploaded to Internet Archive.
 */
export function getUnsyncedDocs(catalog: CatalogEntry[]): CatalogEntry[] {
  return catalog.filter(
    (entry) => !entry.storage?.internetArchive?.itemId
  );
}

/**
 * Generate an Internet Archive item identifier for a document entry.
 * Format: norskdata-doc-ND-60.128.03
 */
export function generateDocIaItemId(entry: CatalogEntry): string {
  if (entry.ndNumber) {
    const formatted = formatNdNumber(entry.ndNumber);
    return `norskdata-doc-${formatted}`;
  }
  // Fallback to entry ID
  return `norskdata-doc-${entry.id}`;
}

/**
 * Sync a single document to Internet Archive.
 * This is a stub -- actual IA upload uses the `ia` CLI tool.
 */
export function syncDocToIa(
  entry: CatalogEntry,
  dryRun: boolean = true
): { success: boolean; message: string } {
  const itemId = generateDocIaItemId(entry);

  if (dryRun) {
    return {
      success: true,
      message: `[dry-run] Would upload "${entry.id}" as IA item "${itemId}"`,
    };
  }

  // Actual upload not implemented yet.
  // When implemented, this will:
  //   1. Find the primary scan rendition
  //   2. Upload via `ia upload <itemId> <file> --metadata=...`
  //   3. Update entry.storage.internetArchive with itemId and upload date
  return {
    success: false,
    message: `IA upload not yet implemented. Item ID would be: ${itemId}`,
  };
}

/**
 * Verify that a document exists on Internet Archive with correct checksums.
 * Stub -- will use `ia metadata <itemId>` when implemented.
 */
export function verifyDocOnIa(
  entry: CatalogEntry
): { verified: boolean; message: string } {
  if (!entry.storage?.internetArchive?.itemId) {
    return {
      verified: false,
      message: `"${entry.id}" has no IA item ID`,
    };
  }

  return {
    verified: false,
    message: `IA verification not yet implemented for "${entry.storage.internetArchive.itemId}"`,
  };
}
