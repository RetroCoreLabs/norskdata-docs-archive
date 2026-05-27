/**
 * Static site generator for the Norsk Data Documentation Archive.
 * Reads the document catalog and produces HTML files in the site/ directory.
 */

import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CatalogEntry } from "./catalog.js";
import type { Category } from "./nd-numbering.js";

interface CategoryGroup {
  group: string;
  items: Array<{ id: string; name: string; status: string; evidence: string }>;
  note?: string;
  _meta?: Record<string, unknown>;
}

/** Build the complete static site into site/ */
export function buildSite(rootDir: string): void {
  const catalogPath = join(rootDir, "catalog", "documents.json");
  const categoriesPath = join(rootDir, "catalog", "categories.json");
  const siteDir = join(rootDir, "site");

  console.log("Loading catalog...");
  const catalog: CatalogEntry[] = JSON.parse(
    readFileSync(catalogPath, "utf-8")
  );
  const categoryGroups: CategoryGroup[] = JSON.parse(
    readFileSync(categoriesPath, "utf-8")
  );

  // Build flat category map
  const categoryMap = new Map<string, string>();
  for (const group of categoryGroups) {
    if (group.items) {
      for (const item of group.items) {
        categoryMap.set(item.id, item.name);
      }
    }
  }

  console.log(`Loaded ${catalog.length} documents.`);

  // Create site directory
  mkdirSync(siteDir, { recursive: true });

  // Build search index JSON
  const searchIndex = catalog.map((entry) => ({
    id: entry.id,
    title: entry.title,
    category: entry.category,
    categoryId: entry.categoryId,
    description: entry.description,
    keywords: entry.keywords,
    productIds: entry.productIds,
    pages: entry.pages,
    language: entry.language,
  }));
  writeFileSync(
    join(siteDir, "search-index.json"),
    JSON.stringify(searchIndex),
    "utf-8"
  );
  console.log(`  search-index.json (${searchIndex.length} entries)`);

  // Group catalog by category
  const byCategory = new Map<string, CatalogEntry[]>();
  for (const entry of catalog) {
    const cat = entry.category || "Uncategorized";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(entry);
  }

  // Compute stats
  const totalPages = catalog.reduce(
    (sum, e) => sum + (e.pages ?? 0),
    0
  );
  const categories = Array.from(byCategory.keys()).sort();
  const productIds = new Set<string>();
  for (const entry of catalog) {
    for (const pid of entry.productIds) {
      productIds.add(pid);
    }
  }

  // Build index.html
  const indexHtml = renderIndexPage(
    catalog,
    byCategory,
    categoryMap,
    totalPages,
    productIds.size
  );
  writeFileSync(join(siteDir, "index.html"), indexHtml, "utf-8");
  console.log("  index.html");
  console.log("Site build complete.");
}

function esc(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderIndexPage(
  catalog: CatalogEntry[],
  byCategory: Map<string, CatalogEntry[]>,
  categoryMap: Map<string, string>,
  totalPages: number,
  totalProducts: number
): string {
  // Sort categories
  const sortedCategories = Array.from(byCategory.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  let cardsHtml = "";
  for (const [category, entries] of sortedCategories) {
    const sortedEntries = entries.sort((a, b) =>
      a.id.localeCompare(b.id)
    );

    let entriesHtml = "";
    for (const entry of sortedEntries) {
      const productLinks = entry.productIds
        .map((pid) => `<span class="nd-badge nd-badge-product">${esc(pid)}</span>`)
        .join(" ");

      const pageInfo = entry.pages
        ? `<span class="nd-text-muted">${entry.pages} pages</span>`
        : "";

      const iaLink = entry.storage?.internetArchive?.itemId
        ? `<a href="https://archive.org/details/${esc(entry.storage.internetArchive.itemId)}" target="_blank" rel="noopener" class="nd-badge nd-badge-info">IA</a>`
        : "";

      entriesHtml += `
        <div class="nd-doc-card">
          <div class="nd-doc-card-header">
            <code class="nd-doc-id">${esc(entry.id)}</code>
            ${iaLink}
            ${pageInfo}
          </div>
          <div class="nd-doc-card-title">${esc(entry.title)}</div>
          <div class="nd-doc-card-meta">
            <span class="nd-badge">${esc(entry.language || "EN")}</span>
            ${productLinks}
          </div>
          ${entry.description ? `<div class="nd-doc-card-desc">${esc(entry.description)}</div>` : ""}
        </div>`;
    }

    cardsHtml += `
      <div class="nd-category-section" id="cat-${esc(entries[0]?.categoryId || "other")}">
        <h2 class="nd-category-header">
          ${esc(category)}
          <span class="nd-badge">${entries.length}</span>
        </h2>
        <div class="nd-doc-grid">
          ${entriesHtml}
        </div>
      </div>`;
  }

  // Category navigation
  let catNavHtml = "";
  for (const [category, entries] of sortedCategories) {
    const catId = entries[0]?.categoryId || "other";
    catNavHtml += `<a href="#cat-${esc(catId)}" class="nd-chip">${esc(category)} (${entries.length})</a>`;
  }

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Norsk Data Documentation Archive</title>
<style>
:root, [data-theme="dark"] {
  --bg: #1a1a2e;
  --bg-elev: #16213e;
  --bg-sunken: #0f0f1e;
  --text: #e0e0e0;
  --text-muted: #9090a8;
  --border: #2a3a5e;
  --accent: #4a8de8;
  --accent-bg: #1a2840;
  --blue: #5a9ee8;  --blue-bg: #1a2a4a;
  --teal: #4fb8c4;  --teal-bg: #15363a;
  --green: #5cb85c; --green-bg: #1a3a1f;
  --purple: #b07ad0; --purple-bg: #2e1a3a;
  --orange: #ff8a3d; --orange-bg: #3a2010;
}

[data-theme="light"] {
  --bg: #fbfaf6;
  --bg-elev: #ffffff;
  --bg-sunken: #f0eee9;
  --text: #1a1a1a;
  --text-muted: #6a6a6a;
  --border: #d0cdc4;
  --accent: #0D47A1;
  --accent-bg: #E3F2FD;
  --blue: #0D47A1;  --blue-bg: #E3F2FD;
  --teal: #00838F;  --teal-bg: #E0F7FA;
  --green: #2E7D32; --green-bg: #E8F5E9;
  --purple: #7B1FA2; --purple-bg: #F3E5F5;
  --orange: #E65100; --orange-bg: #FFF3E0;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  min-height: 100vh;
}

a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
code { font-family: 'Consolas', 'Courier New', monospace; }

.nd-header {
  background: var(--bg-elev);
  border-bottom: 1px solid var(--border);
  padding: 0 1.5rem;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  height: 3.25rem;
}

.nd-logo {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--accent);
  white-space: nowrap;
}

.nd-theme-toggle {
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.35rem 0.5rem;
  font-size: 1rem;
  line-height: 1;
  margin-left: auto;
}

.nd-theme-toggle:hover { color: var(--text); border-color: var(--text-muted); }

.nd-main {
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 1.5rem;
}

.nd-hero-stats {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.nd-stat {
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem 1.5rem;
  text-align: center;
  min-width: 120px;
  flex: 1;
}

.nd-stat-value {
  font-size: 2rem;
  font-weight: 700;
  font-family: 'Consolas', 'Courier New', monospace;
  color: var(--accent);
}

.nd-stat-label {
  font-size: 0.8rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.nd-search-box {
  margin-bottom: 1.25rem;
}

.nd-search-box input {
  background: var(--bg-sunken);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.9rem;
  width: 100%;
  max-width: 500px;
}

.nd-search-box input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-bg);
}

.nd-cat-nav {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.nd-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.65rem;
  border-radius: 16px;
  font-size: 0.78rem;
  font-weight: 500;
  background: var(--bg-sunken);
  color: var(--text-muted);
  border: 1px solid var(--border);
  cursor: pointer;
  transition: all 0.15s;
  text-decoration: none;
}

.nd-chip:hover { border-color: var(--accent); color: var(--text); text-decoration: none; }

.nd-category-section { margin-bottom: 2rem; }

.nd-category-header {
  font-size: 1.2rem;
  color: var(--accent);
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--accent);
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.nd-doc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 0.75rem;
}

.nd-doc-card {
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem;
  transition: border-color 0.15s;
}

.nd-doc-card:hover { border-color: var(--accent); }

.nd-doc-card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
}

.nd-doc-id {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--accent);
}

.nd-doc-card-title {
  font-size: 0.95rem;
  font-weight: 600;
  margin-bottom: 0.4rem;
  line-height: 1.3;
}

.nd-doc-card-meta {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
  margin-bottom: 0.3rem;
}

.nd-doc-card-desc {
  font-size: 0.82rem;
  color: var(--text-muted);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.nd-badge {
  display: inline-block;
  padding: 0.1rem 0.5rem;
  border-radius: 4px;
  font-size: 0.72rem;
  font-weight: 600;
  background: var(--accent-bg);
  color: var(--accent);
  border: 1px solid var(--accent);
}

.nd-badge-product { background: var(--blue-bg); color: var(--blue); border-color: var(--blue); }
.nd-badge-info { background: var(--teal-bg); color: var(--teal); border-color: var(--teal); }

.nd-text-muted { color: var(--text-muted); font-size: 0.82rem; }

.nd-footer {
  background: var(--bg-sunken);
  border-top: 1px solid var(--border);
  padding: 0.4rem 1.5rem;
  font-size: 0.8rem;
  color: var(--text-muted);
  text-align: center;
  margin-top: 2rem;
}

.nd-hidden { display: none !important; }

@media (max-width: 768px) {
  .nd-doc-grid { grid-template-columns: 1fr; }
  .nd-hero-stats { gap: 0.5rem; }
  .nd-stat { min-width: 80px; padding: 0.75rem; }
  .nd-stat-value { font-size: 1.5rem; }
}
</style>
</head>
<body>

<header class="nd-header">
  <span class="nd-logo">nd docs</span>
  <button class="nd-theme-toggle" id="theme-toggle" title="Toggle theme"></button>
</header>

<main class="nd-main">
  <div class="nd-hero-stats">
    <div class="nd-stat"><div class="nd-stat-value">${catalog.length}</div><div class="nd-stat-label">documents</div></div>
    <div class="nd-stat"><div class="nd-stat-value">${totalPages}</div><div class="nd-stat-label">pages</div></div>
    <div class="nd-stat"><div class="nd-stat-value">${totalProducts}</div><div class="nd-stat-label">products</div></div>
    <div class="nd-stat"><div class="nd-stat-value">${sortedCategories.length}</div><div class="nd-stat-label">categories</div></div>
  </div>

  <div class="nd-search-box">
    <input type="text" id="doc-search" placeholder="Search documents (title, ND number, product...)">
  </div>

  <div class="nd-cat-nav">
    ${catNavHtml}
  </div>

  <div id="doc-results">
    ${cardsHtml}
  </div>
</main>

<footer class="nd-footer">
  Norsk Data Documentation Archive &middot; ${catalog.length} documents
</footer>

<script>
(function() {
  var html = document.documentElement;
  var themeBtn = document.getElementById('theme-toggle');
  var stored = localStorage.getItem('nd-docs-theme');
  var theme = (stored === 'light' || stored === 'dark') ? stored : 'dark';
  html.setAttribute('data-theme', theme);
  themeBtn.textContent = theme === 'dark' ? '\\u263E' : '\\u2600';
  themeBtn.addEventListener('click', function() {
    theme = theme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', theme);
    localStorage.setItem('nd-docs-theme', theme);
    themeBtn.textContent = theme === 'dark' ? '\\u263E' : '\\u2600';
  });

  var searchInput = document.getElementById('doc-search');
  var allCards = document.querySelectorAll('.nd-doc-card');
  var allSections = document.querySelectorAll('.nd-category-section');

  searchInput.addEventListener('input', function() {
    var q = this.value.toLowerCase().trim();
    if (!q) {
      allCards.forEach(function(c) { c.classList.remove('nd-hidden'); });
      allSections.forEach(function(s) { s.classList.remove('nd-hidden'); });
      return;
    }
    allCards.forEach(function(card) {
      var text = card.textContent.toLowerCase();
      card.classList.toggle('nd-hidden', !text.includes(q));
    });
    allSections.forEach(function(section) {
      var visible = section.querySelectorAll('.nd-doc-card:not(.nd-hidden)');
      section.classList.toggle('nd-hidden', visible.length === 0);
    });
  });
})();
</script>
</body>
</html>`;
}
