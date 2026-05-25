/**
 * Migration script: transforms legacy documents.json (ndfloppy format)
 * to the new catalog format with renditions, ND number parsing, etc.
 *
 * Usage:
 *   node dist/migrate.js --source /path/to/documents.json
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  extractNdNumberFromFilename,
  formatNdNumber,
  ndNumberToPath,
  type NdNumber,
  type Category,
} from "./api/nd-numbering.js";
import {
  saveDocCatalog,
  type CatalogEntry,
  type Rendition,
  type Source,
} from "./api/catalog.js";

/**
 * Generate an IA item ID inline (avoids importing ia-sync which imports catalog).
 */
function generateDocIaItemId_(entry: { id: string; ndNumber: NdNumber | null }): string {
  if (entry.ndNumber) {
    return `norskdata-doc-${formatNdNumber(entry.ndNumber)}`;
  }
  return `norskdata-doc-${entry.id}`;
}

/** Shape of an entry in the legacy documents.json. */
interface LegacyEntry {
  id: number;
  title: string;
  category: string;
  categoryId: string;
  description: string;
  abstract: string;
  sources: Array<{ url: string; title: string }>;
  localPath: string;
  fileName: string;
  productIds: string[];
}

function extractLanguageFromFilename(filename: string): string {
  if (/_EN[._\s]/i.test(filename)) return "EN";
  if (/_NO[._\s]/i.test(filename)) return "NO";
  return "EN";
}

/**
 * Migrate a single legacy entry to the new catalog format.
 */
function migrateEntry(
  legacy: LegacyEntry,
  categories: Category[]
): CatalogEntry {
  // Parse ND number from filename
  const ndNumber: NdNumber | null = extractNdNumberFromFilename(
    legacy.fileName
  );

  // Generate ID
  const id = ndNumber
    ? formatNdNumber(ndNumber)
    : legacy.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .substring(0, 80);

  // Build rendition from the filename (no checksums available in source data)
  const rendition: Rendition = {
    role: "scan",
    source: "unknown",
    md5: null,
    sha256: null,
    fileSize: null,
    iaFile: null,
    isPrimary: true,
    ocrTool: null,
    isFindingAid: false,
    notes: `Migrated from legacy catalog. Original filename: ${legacy.fileName}`,
    generatedDate: null,
    gitPath: null,
  };

  // Map sources, adding retrievedDate: null
  const sources: Source[] = legacy.sources.map((s) => ({
    url: s.url,
    title: s.title,
    retrievedDate: null,
  }));

  const language = extractLanguageFromFilename(legacy.fileName);

  // Determine target directory path
  let targetPath: string | null = null;
  if (ndNumber) {
    targetPath = ndNumberToPath(ndNumber, categories);
  }

  const entry: CatalogEntry = {
    schemaVersion: "1.0",
    id,
    ndNumber,
    title: legacy.title,
    language,
    preliminary: false,
    category: legacy.category,
    categoryId: legacy.categoryId,
    documentType: "unknown",
    publisher: "norsk-data",
    description: legacy.description,
    abstract: legacy.abstract,
    date: null,
    pages: null,
    author: null,
    productIds: legacy.productIds,
    machineIds: [],
    supersedes: null,
    supersededBy: null,
    sources,
    files: { text: null, textSource: null, textQuality: null },
    renditions: [rendition],
    storage: {
      internetArchive: {
        itemId: generateDocIaItemId_({ id, ndNumber }),
        uploaded: null,
        verified: null,
        syncStatus: "pending",
      },
    },
    ocrQuality: null,
    provenance: {
      importDate: new Date().toISOString().split("T")[0],
      importSource: "ndfloppy/documents.json",
      preservationNotes: targetPath
        ? `Target directory: documents/${targetPath}`
        : null,
    },
    tags: [],
    keywords: [],
  };

  return entry;
}

/**
 * Run the migration.
 */
export function runMigration(
  sourcePath: string,
  rootDir: string
): { entries: CatalogEntry[]; errors: string[]; warnings: string[] } {
  // Load legacy data
  const raw = readFileSync(resolve(sourcePath), "utf-8");
  const legacyEntries: LegacyEntry[] = JSON.parse(raw);

  // Load categories
  const categoriesRaw = readFileSync(
    resolve(rootDir, "catalog", "categories.json"),
    "utf-8"
  );
  const categories: Category[] = JSON.parse(categoriesRaw);

  const entries: CatalogEntry[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const legacy of legacyEntries) {
    try {
      const entry = migrateEntry(legacy, categories);
      entries.push(entry);
    } catch (err) {
      errors.push(
        `Failed to migrate entry #${legacy.id} ("${legacy.title}"): ${String(err)}`
      );
    }
  }

  // Disambiguate duplicate IDs.
  // In the legacy data, two different documents can share the same ND number
  // (e.g., ND-60.133.01 is assigned to both SIBAS User Manual and Real Time Guide).
  // We append a sequential suffix to make IDs unique.
  const idCounts = new Map<string, number>();
  for (const entry of entries) {
    const count = idCounts.get(entry.id) ?? 0;
    idCounts.set(entry.id, count + 1);
  }

  // For any ID that appears more than once, append -a, -b, etc.
  const idSeen = new Map<string, number>();
  for (const entry of entries) {
    const total = idCounts.get(entry.id) ?? 1;
    if (total > 1) {
      const seen = idSeen.get(entry.id) ?? 0;
      const suffix = String.fromCharCode(97 + seen); // a, b, c...
      const origId = entry.id;
      entry.id = `${origId}-${suffix}`;
      idSeen.set(origId, seen + 1);
      warnings.push(
        `Duplicate ND number "${origId}" disambiguated as "${entry.id}" (${entry.title})`
      );
    }
  }

  // Save the catalog
  saveDocCatalog(rootDir, entries);

  return { entries, errors, warnings };
}
