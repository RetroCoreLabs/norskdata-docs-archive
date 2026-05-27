#!/usr/bin/env node

/**
 * MCP server for the Norsk Data Documentation Archive.
 * Exposes document search, lookup, and statistics tools.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { loadDocCatalog, readTextFile } from "../api/catalog.js";
import type { CatalogEntry } from "../api/catalog.js";

// Determine repo root (tools/dist/mcp/server.js -> up 3 levels)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, "..", "..");

// Load catalog once at startup
let catalog: CatalogEntry[] = [];
try {
  catalog = loadDocCatalog(ROOT_DIR);
} catch (e) {
  console.error("Failed to load catalog:", e);
}

// Simple tokenized search
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function searchDocuments(
  query: string,
  limit: number = 20
): CatalogEntry[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const scored: Array<{ entry: CatalogEntry; score: number }> = [];

  for (const entry of catalog) {
    let score = 0;
    const qLower = query.toLowerCase();

    // Direct ID match
    if (entry.id.toLowerCase().includes(qLower)) score += 10;

    // Title match
    if (entry.title.toLowerCase().includes(qLower)) score += 8;

    // Token-based matching
    const entryText = [
      entry.title,
      entry.description,
      entry.abstract,
      entry.id,
      ...entry.keywords,
      ...entry.productIds,
      ...entry.tags,
    ]
      .join(" ")
      .toLowerCase();

    for (const qt of queryTokens) {
      if (entryText.includes(qt)) score += 2;
    }

    // Product ID match
    for (const pid of entry.productIds) {
      if (pid.toLowerCase().includes(qLower)) score += 5;
    }

    // Keyword match
    for (const kw of entry.keywords) {
      if (kw.toLowerCase().includes(qLower)) score += 3;
    }

    if (score > 0) scored.push({ entry, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.entry);
}

function formatEntry(entry: CatalogEntry): string {
  const lines: string[] = [
    `ID: ${entry.id}`,
    `Title: ${entry.title}`,
    `Category: ${entry.category} (${entry.categoryId})`,
    `Language: ${entry.language}`,
  ];

  if (entry.pages) lines.push(`Pages: ${entry.pages}`);
  if (entry.author) lines.push(`Author: ${entry.author}`);
  if (entry.date) lines.push(`Date: ${entry.date}`);
  if (entry.description) lines.push(`Description: ${entry.description}`);
  if (entry.abstract) lines.push(`Abstract: ${entry.abstract}`);
  if (entry.productIds.length > 0)
    lines.push(`Products: ${entry.productIds.join(", ")}`);
  if (entry.keywords.length > 0)
    lines.push(`Keywords: ${entry.keywords.join(", ")}`);
  if (entry.tags.length > 0)
    lines.push(`Tags: ${entry.tags.join(", ")}`);
  if (entry.supersedes) lines.push(`Supersedes: ${entry.supersedes}`);
  if (entry.supersededBy) lines.push(`Superseded by: ${entry.supersededBy}`);

  // Renditions
  if (entry.renditions.length > 0) {
    lines.push(`Renditions: ${entry.renditions.length}`);
    for (const r of entry.renditions) {
      lines.push(`  - ${r.role} (${r.source})${r.isPrimary ? " [primary]" : ""}`);
    }
  }

  // Internet Archive
  if (entry.storage?.internetArchive?.itemId) {
    lines.push(
      `Internet Archive: https://archive.org/details/${entry.storage.internetArchive.itemId}`
    );
  }

  // Sources
  if (entry.sources.length > 0) {
    lines.push("Sources:");
    for (const src of entry.sources) {
      lines.push(`  - ${src.title}: ${src.url}`);
    }
  }

  return lines.join("\n");
}

function formatEntrySummary(entry: CatalogEntry): string {
  return `${entry.id} - ${entry.title} [${entry.category}]${entry.pages ? ` (${entry.pages}p)` : ""}`;
}

// Create server
const server = new Server(
  {
    name: "norskdata-docs-archive",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_documents",
      description:
        "Search the Norsk Data documentation archive by title, description, keywords, ND number, or product ID. Returns matching documents ranked by relevance.",
      inputSchema: {
        type: "object" as const,
        properties: {
          query: {
            type: "string",
            description: "Search query (title, ND number, keyword, product ID)",
          },
          limit: {
            type: "number",
            description: "Maximum results to return (default: 20)",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "get_document",
      description:
        "Get full metadata for a specific document by its ID (e.g. ND-60.128.03). Returns all fields including renditions, sources, and storage info.",
      inputSchema: {
        type: "object" as const,
        properties: {
          id: {
            type: "string",
            description: "Document ID (e.g. ND-60.128.03)",
          },
        },
        required: ["id"],
      },
    },
    {
      name: "list_category",
      description:
        "List all documents in a specific category by category ID code (e.g. '06' for NORD-10 hardware, '60' for general software).",
      inputSchema: {
        type: "object" as const,
        properties: {
          categoryId: {
            type: "string",
            description:
              "Category ID code (e.g. '06', '60', '30'). Common codes: 06=CPUs, 11=Storage, 12=I/O, 30=Operations, 60=Software, 63=NOTIS",
          },
        },
        required: ["categoryId"],
      },
    },
    {
      name: "list_product_docs",
      description:
        "List all documents associated with a specific product ID (e.g. ND-10048 for SINTRAN III).",
      inputSchema: {
        type: "object" as const,
        properties: {
          productId: {
            type: "string",
            description: "Product ID (e.g. ND-10048)",
          },
        },
        required: ["productId"],
      },
    },
    {
      name: "get_doc_stats",
      description:
        "Get summary statistics about the documentation archive: total documents, categories, pages, products, languages.",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "search_documents": {
      const query = String(args?.query ?? "");
      const limit = Number(args?.limit ?? 20);
      if (!query) {
        return {
          content: [{ type: "text", text: "Error: query is required" }],
        };
      }
      const results = searchDocuments(query, limit);
      if (results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No documents found for query: "${query}"`,
            },
          ],
        };
      }
      const text =
        `Found ${results.length} document(s) for "${query}":\n\n` +
        results.map((e) => formatEntrySummary(e)).join("\n");
      return { content: [{ type: "text", text }] };
    }

    case "get_document": {
      const id = String(args?.id ?? "");
      if (!id) {
        return {
          content: [{ type: "text", text: "Error: id is required" }],
        };
      }
      const entry = catalog.find(
        (e) => e.id === id || e.id.toLowerCase() === id.toLowerCase()
      );
      if (!entry) {
        return {
          content: [
            { type: "text", text: `Document not found: ${id}` },
          ],
        };
      }
      return { content: [{ type: "text", text: formatEntry(entry) }] };
    }

    case "list_category": {
      const categoryId = String(args?.categoryId ?? "");
      if (!categoryId) {
        return {
          content: [
            { type: "text", text: "Error: categoryId is required" },
          ],
        };
      }
      const entries = catalog.filter((e) => e.categoryId === categoryId);
      if (entries.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No documents found for category: ${categoryId}`,
            },
          ],
        };
      }
      const text =
        `Category ${categoryId} - ${entries[0].category} (${entries.length} documents):\n\n` +
        entries.map((e) => formatEntrySummary(e)).join("\n");
      return { content: [{ type: "text", text }] };
    }

    case "list_product_docs": {
      const productId = String(args?.productId ?? "");
      if (!productId) {
        return {
          content: [
            { type: "text", text: "Error: productId is required" },
          ],
        };
      }
      const entries = catalog.filter((e) =>
        e.productIds.includes(productId)
      );
      if (entries.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No documents found for product: ${productId}`,
            },
          ],
        };
      }
      const text =
        `Product ${productId} (${entries.length} documents):\n\n` +
        entries.map((e) => formatEntrySummary(e)).join("\n");
      return { content: [{ type: "text", text }] };
    }

    case "get_doc_stats": {
      const byCategory: Record<string, number> = {};
      const byLanguage: Record<string, number> = {};
      const productSet = new Set<string>();
      let totalPages = 0;
      let withIA = 0;
      let withText = 0;

      for (const entry of catalog) {
        // Category
        const cat = entry.category || "Uncategorized";
        byCategory[cat] = (byCategory[cat] ?? 0) + 1;

        // Language
        const lang = entry.language || "unknown";
        byLanguage[lang] = (byLanguage[lang] ?? 0) + 1;

        // Products
        for (const pid of entry.productIds) productSet.add(pid);

        // Pages
        totalPages += entry.pages ?? 0;

        // Internet Archive
        if (entry.storage?.internetArchive?.itemId) withIA++;

        // Text
        if (entry.files?.text) withText++;
      }

      const categoryLines = Object.entries(byCategory)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, count]) => `  ${cat}: ${count}`)
        .join("\n");

      const langLines = Object.entries(byLanguage)
        .sort((a, b) => b[1] - a[1])
        .map(([lang, count]) => `  ${lang}: ${count}`)
        .join("\n");

      const text = [
        `Norsk Data Documentation Archive Statistics`,
        ``,
        `Total documents: ${catalog.length}`,
        `Total pages: ${totalPages}`,
        `Unique products referenced: ${productSet.size}`,
        `Documents on Internet Archive: ${withIA}`,
        `Documents with extracted text: ${withText}`,
        ``,
        `By category:`,
        categoryLines,
        ``,
        `By language:`,
        langLines,
      ].join("\n");

      return { content: [{ type: "text", text }] };
    }

    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});

// Run
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Norsk Data Docs MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
