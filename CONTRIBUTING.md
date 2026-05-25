# Contributing to the Norsk Data Documentation Archive

Thank you for helping preserve Norsk Data documentation history.

## How to Contribute Documents

### Option 1: Open a GitHub Issue (recommended for new contributors)

1. **Open a GitHub Issue** with the following information:
   - Description of the document (title, ND number if known, what it covers)
   - Provenance: where you obtained it, how it was scanned
   - Link to the PDF (hosted temporarily on Google Drive, Dropbox, personal server, etc.)
   - Any additional context (physical condition, completeness, language)

2. **Maintainer reviews** the submission:
   - Verifies provenance
   - Checks for duplicates (MD5 + SHA256)
   - Parses the ND document number from filename and/or first-page OCR
   - Runs the import tool to extract metadata and assign a catalog entry

3. **Import and catalog**:
   - The maintainer imports the document, uploads to Internet Archive, and updates the catalog
   - A PR is created with the catalog changes
   - Once merged, the document is permanently preserved

### Option 2: Direct PR (for trusted contributors)

If you have been granted contributor access:

1. Clone the repository and install tools:
   ```bash
   git clone https://github.com/HackerCorpLabs/norskdata-docs-archive.git
   cd norskdata-docs-archive
   make setup
   ```

2. Run the import tool locally:
   ```bash
   make import SRC=/path/to/document.pdf
   ```

3. Review the generated metadata, then submit a PR with the catalog changes.

## What We Accept

- Norsk Data manuals and technical documentation (PDFs, scans)
- Reference cards
- Schematics and engineering drawings
- Program descriptions (PD sheets)
- Installation guides and revision logs
- Third-party component datasheets relevant to ND hardware

## Document Renditions

A single logical document may have multiple renditions:

- **Scan**: The original scanned PDF (preservation master)
- **OCR**: PDF with searchable text layer added
- **AI text**: Machine-generated plain text (marked as a finding aid, not authoritative)

All renditions of the same document are grouped under one catalog entry.

## Duplicate Policy

- **Exact match** (same MD5 + SHA256): rejected as duplicate
- **Same ND number, different scan source**: stored as a rendition (e.g., Gandalf scan vs. Bitsavers scan)
- **Different OCR of same scan**: stored as a rendition with the OCR tool noted

## Metadata Quality

Please provide as much provenance information as possible:

- Who scanned the document
- Scanner resolution and settings
- Physical condition of the original
- Completeness (any missing pages?)
- Language (EN, NO, etc.)

## Code of Conduct

Be respectful. This is a historical preservation effort. All contributions are valued.
