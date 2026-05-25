/**
 * Build a search index from the document catalog.
 *
 * Creates an in-memory index for fast title/description/tag search,
 * and can serialize it to disk for use by the static site or CLI.
 */

import { writeFileSync } from "node:fs";
import type { CatalogEntry } from "./catalog.js";

/** A single entry in the search index. */
export interface IndexEntry {
  id: string;
  title: string;
  category: string;
  categoryId: string;
  ndNumber: string | null;
  tokens: string[];
}

/**
 * Tokenize a string into lowercase search tokens.
 * Splits on whitespace and punctuation, removes short tokens.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/**
 * Build a search index from a catalog.
 */
export function buildIndex(catalog: CatalogEntry[]): IndexEntry[] {
  return catalog.map((entry) => {
    const allText = [
      entry.title,
      entry.description,
      entry.abstract,
      entry.id,
      entry.category,
      ...entry.tags,
      ...entry.keywords,
      ...entry.productIds,
    ].join(" ");

    return {
      id: entry.id,
      title: entry.title,
      category: entry.category,
      categoryId: entry.categoryId,
      ndNumber: entry.ndNumber?.raw ?? null,
      tokens: [...new Set(tokenize(allText))],
    };
  });
}

/**
 * Search the index for entries matching all query tokens.
 */
export function searchIndex(
  index: IndexEntry[],
  query: string
): IndexEntry[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  return index.filter((entry) =>
    queryTokens.every((qt) =>
      entry.tokens.some((t) => t.includes(qt))
    )
  );
}

/**
 * Write the search index to a JSON file.
 */
export function saveIndex(index: IndexEntry[], outputPath: string): void {
  writeFileSync(outputPath, JSON.stringify(index, null, 2) + "\n", "utf-8");
}
