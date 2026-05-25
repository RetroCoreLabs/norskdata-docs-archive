/**
 * Deduplication utilities for the document catalog.
 *
 * Detects exact duplicates (same MD5) and potential renditions
 * (same ND number but different MD5 -- likely a different scan or OCR pass).
 */

import type { CatalogEntry } from "./catalog.js";
import type { NdNumber } from "./nd-numbering.js";
import { formatNdNumber } from "./nd-numbering.js";

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingEntry?: CatalogEntry;
  isRendition: boolean;
  reason?: string;
}

/**
 * Check whether a document is a duplicate of something already in the catalog.
 *
 * Priority:
 *   1. MD5 match against any existing rendition -> exact duplicate
 *   2. Same ND number but different MD5 -> potential new rendition
 *   3. Title match -> warn (may be different version)
 */
export function checkDocDuplicate(
  catalog: CatalogEntry[],
  md5?: string | null,
  ndNumber?: NdNumber | null,
  title?: string | null
): DuplicateCheckResult {
  // 1. Exact MD5 match
  if (md5) {
    for (const entry of catalog) {
      for (const rendition of entry.renditions) {
        if (rendition.md5 && rendition.md5 === md5) {
          return {
            isDuplicate: true,
            existingEntry: entry,
            isRendition: false,
            reason: `Exact MD5 match with existing rendition in "${entry.id}"`,
          };
        }
      }
    }
  }

  // 2. Same ND number, different content -> rendition
  if (ndNumber) {
    const formatted = formatNdNumber(ndNumber);
    for (const entry of catalog) {
      if (entry.id === formatted) {
        return {
          isDuplicate: false,
          existingEntry: entry,
          isRendition: true,
          reason: `Same ND number "${formatted}" -- this may be a new rendition (different scan/OCR)`,
        };
      }
    }
  }

  // 3. Title match (fuzzy warning)
  if (title) {
    const lower = title.toLowerCase();
    for (const entry of catalog) {
      if (entry.title.toLowerCase() === lower) {
        return {
          isDuplicate: false,
          existingEntry: entry,
          isRendition: false,
          reason: `Title matches existing entry "${entry.id}" -- review manually`,
        };
      }
    }
  }

  return {
    isDuplicate: false,
    isRendition: false,
  };
}
