# Norsk Data Documentation Archive

[![CI](https://github.com/RetroCoreLabs/norskdata-docs-archive/actions/workflows/validate.yml/badge.svg)](https://github.com/RetroCoreLabs/norskdata-docs-archive/actions/workflows/validate.yml)

Definitive catalog and preservation metadata for all Norsk Data documentation -- manuals, technical notes, reference cards, schematics, and program descriptions.

## Architecture

- **Metadata in Git**: Catalog JSON, schemas, checksums, and OCR/AI-generated text live in this repository.
- **PDFs on Internet Archive**: All PDF artifacts are stored on the [Internet Archive](https://archive.org/) for permanent, mirrored preservation. Every document has a stable, direct download URL.
- **ND numbering preserved**: Documents retain their original ND numbering system (e.g., `ND-60.128.03A EN`).

## Quick Start

```bash
# Clone the repository
git clone https://github.com/RetroCoreLabs/norskdata-docs-archive.git
cd norskdata-docs-archive

# Verify prerequisites are installed
make check-deps

# Install tools and build
make setup

# Search the catalog
make search Q="SINTRAN"

# Validate catalog integrity
make check
```

## Documentation

- [INSTALL.md](INSTALL.md) -- Prerequisites and setup guide
- [CONTRIBUTING.md](CONTRIBUTING.md) -- How to contribute documents
- [BACKUP.md](BACKUP.md) -- Backup and disaster recovery strategy

## Repository Structure

```
catalog/            Catalog JSON files, schemas, checksums
  schema/           JSON Schema definitions (v1.0)
  documents.json    Master document registry (metadata only)
  categories.json   ND document categories with officialness annotations
  products.json     Product cross-reference
  releases.json     Cross-repo release links
  SHA256SUMS.txt    Preservation-grade checksums
documents/          Per-document OCR/AI text and README (NO PDFs in git)
  hardware/         Hardware documentation (categories 01-14)
  mixed/            Mixed hardware/software documentation (categories 20-70)
  software/         Software documentation (categories 60-80)
  reference/        Reference cards (category 99)
  third-party/      Non-ND documents (component datasheets, standards)
  uncategorized/    Documents not yet categorized
tools/              Node.js/TypeScript import, catalog, OCR pipeline, and sync tools
site/               GitHub Pages static site (auto-generated)
```

## Internet Archive Collections

- `norskdata-documentation` -- ND PDFs, scans, schematics

## Related Projects

- [norskdata-software-archive](https://github.com/RetroCoreLabs/norskdata-software-archive) -- Software media preservation
- [NDInsight](https://github.com/RetroCoreLabs/NDInsight) -- Curated research and knowledge layer

## License

This is a historical preservation project. Original documentation is copyright Norsk Data A/S.
Catalog metadata and tooling are provided for research and preservation purposes.
