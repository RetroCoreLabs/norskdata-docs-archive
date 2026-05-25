/**
 * ND document number parser and formatter.
 *
 * Norsk Data used two numbering schemes:
 *
 * Old format (pre-September 1988): ND-XX.YYY.ZZ[REV]
 *   XX  = subject code (2 digits)
 *   YYY = sequence number (1-4 digits in practice, usually 3)
 *   ZZ  = version (1-3 digits in practice, usually 2)
 *   REV = optional revision letter (A-Z)
 *
 * New format (post-September 1988): ND-8XXYYY.ZZ
 *   8   = fixed prefix
 *   XX  = subject code
 *   YYY = sequence number
 *   ZZ  = version
 */

export interface NdNumber {
  subject: number;
  sequence: number;
  version: number;
  revision: string | null;
  format: "old" | "new";
  raw: string;
}

export interface Category {
  group: string;
  items: Array<{
    id: string;
    name: string;
    status: string;
    evidence: string;
  }>;
  note?: string;
  _meta?: Record<string, unknown>;
}

// Old format: ND-XX.YYY.ZZ[REV]
// Allow ND- prefix or bare number. Dots separate components.
// Subject: 2 digits, Sequence: 1-4 digits, Version: 1-3 digits, optional revision letter.
const OLD_FORMAT_RE =
  /(?:ND[-\s]?)?(\d{2})\.(\d{1,4})\.(\d{1,3})([A-Z])?/i;

// New format: ND-8XXYYY.ZZ
const NEW_FORMAT_RE =
  /(?:ND[-\s]?)?8(\d{2})(\d{3})\.(\d{1,3})/i;

// Filename variants: underscores instead of dots, e.g. ND_60_128_03
const UNDERSCORE_RE =
  /(?:ND[-_\s]?)(\d{2})[_](\d{1,4})[_](\d{1,3})([A-Z])?/i;

/**
 * Parse an ND document number from a string.
 * The input can be a bare number like "60.128.03", prefixed "ND-60.128.03",
 * or the new format "ND-860228.2".
 */
export function parseNdNumber(input: string): NdNumber | null {
  if (!input || typeof input !== "string") return null;

  const trimmed = input.trim();

  // Try new format first (more specific)
  const newMatch = trimmed.match(NEW_FORMAT_RE);
  if (newMatch) {
    const subject = parseInt(newMatch[1], 10);
    const sequence = parseInt(newMatch[2], 10);
    const version = parseInt(newMatch[3], 10);
    return {
      subject,
      sequence,
      version,
      revision: null,
      format: "new",
      raw: newMatch[0],
    };
  }

  // Try old format
  const oldMatch = trimmed.match(OLD_FORMAT_RE);
  if (oldMatch) {
    const subject = parseInt(oldMatch[1], 10);
    const sequence = parseInt(oldMatch[2], 10);
    const version = parseInt(oldMatch[3], 10);
    const revision = oldMatch[4] ? oldMatch[4].toUpperCase() : null;
    return {
      subject,
      sequence,
      version,
      revision,
      format: "old",
      raw: oldMatch[0],
    };
  }

  // Try underscore format
  const usMatch = trimmed.match(UNDERSCORE_RE);
  if (usMatch) {
    const subject = parseInt(usMatch[1], 10);
    const sequence = parseInt(usMatch[2], 10);
    const version = parseInt(usMatch[3], 10);
    const revision = usMatch[4] ? usMatch[4].toUpperCase() : null;
    return {
      subject,
      sequence,
      version,
      revision,
      format: "old",
      raw: usMatch[0],
    };
  }

  return null;
}

/**
 * Extract an ND number from a filename.
 * Handles patterns like:
 *   ND-60.128.03_SINTRAN_III_User_Guide.pdf
 *   ND-60.128.03_EN.pdf
 *   ND_60_128_03.pdf
 *   60.128.03.pdf
 */
export function extractNdNumberFromFilename(
  filename: string
): NdNumber | null {
  if (!filename || typeof filename !== "string") return null;

  // Strip path components, keep only the filename
  const base = filename.replace(/^.*[/\\]/, "");

  // Try parsing the filename directly (will match embedded ND numbers)
  const parsed = parseNdNumber(base);
  if (parsed) return parsed;

  return null;
}

/**
 * Format an NdNumber into its canonical string representation.
 * Old format: "ND-XX.YYY.ZZ" (with zero-padding to standard widths)
 * New format: "ND-8XXYYY.ZZ"
 */
export function formatNdNumber(num: NdNumber): string {
  if (num.format === "new") {
    const subj = String(num.subject).padStart(2, "0");
    const seq = String(num.sequence).padStart(3, "0");
    const ver = String(num.version);
    return `ND-8${subj}${seq}.${ver}`;
  }

  const subj = String(num.subject).padStart(2, "0");
  const seq = String(num.sequence).padStart(3, "0");
  const ver = String(num.version).padStart(2, "0");
  const rev = num.revision ?? "";
  return `ND-${subj}.${seq}.${ver}${rev}`;
}

/**
 * Map a category ID to a group name (lowercase, suitable for paths).
 */
function categoryGroupForId(
  categoryId: string,
  categories: Category[]
): string {
  for (const group of categories) {
    if (!group.items) continue;
    for (const item of group.items) {
      if (item.id === categoryId) {
        return group.group.toLowerCase();
      }
    }
  }
  return "unknown";
}

/**
 * Map a category ID to its descriptive name (lowercase, slugified).
 */
function categoryNameForId(
  categoryId: string,
  categories: Category[]
): string {
  for (const group of categories) {
    if (!group.items) continue;
    for (const item of group.items) {
      if (item.id === categoryId) {
        return slugify(item.name);
      }
    }
  }
  return "unknown";
}

/**
 * Generate a filesystem path for a document from its ND number and categories.
 * Returns a relative path like "software/60-general-software/ND-60.128"
 */
export function ndNumberToPath(
  num: NdNumber,
  categories: Category[]
): string {
  const subj = String(num.subject).padStart(2, "0");
  const seq = String(num.sequence).padStart(3, "0");
  const group = categoryGroupForId(subj, categories);
  const catName = categoryNameForId(subj, categories);
  const docDir = `ND-${subj}.${seq}`;
  return `${group}/${subj}-${catName}/${docDir}`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
