# Installation Guide

## Prerequisites

### Required (all platforms)

| Tool | Version | Check |
|------|---------|-------|
| Node.js | 20+ | `node --version` |
| npm | 10+ | `npm --version` |
| git | 2.30+ | `git --version` |

### Required for Internet Archive Operations

| Tool | Version | Check |
|------|---------|-------|
| Python | 3.8+ | `python3 --version` |
| internetarchive | latest | `ia --version` |

Install the IA CLI:

```bash
pip install internetarchive
ia configure
```

Credentials are stored in `~/.config/internetarchive/`.

### Required for OCR Pipeline (Linux only)

| Tool | Package | Check |
|------|---------|-------|
| ocrmypdf | `ocrmypdf` | `ocrmypdf --version` |
| qpdf | `qpdf` | `qpdf --version` |
| pdftoppm | `poppler-utils` | `pdftoppm -v` |

Install on Debian/Ubuntu:

```bash
sudo apt install ocrmypdf qpdf poppler-utils
```

### Optional

| Tool | Purpose | Check |
|------|---------|-------|
| ANTHROPIC_API_KEY | AI text generation | `echo $ANTHROPIC_API_KEY` |

Set the environment variable for AI-assisted text extraction:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

### Offline Mode

The tools work fully offline for:

- Catalog browsing and editing
- Metadata import (without IA upload)
- Search across cached catalog
- OCR processing of local PDFs

IA features (upload, download, verify) and AI text generation require internet access. The tools detect connectivity and disable these features gracefully.

## Setup

```bash
# Clone the repository
git clone https://github.com/HackerCorpLabs/norskdata-docs-archive.git
cd norskdata-docs-archive

# Verify prerequisites
make check-deps

# Install dependencies and build tools
make setup
```

## Validate Prerequisites

Run `make check-deps` to check that all required tools are installed. The output will show what is available and what is missing, with platform-specific install instructions.

```bash
make check-deps
```

Example output:

```
[OK] node v22.0.0
[OK] npm 10.5.0
[OK] git 2.43.0
[OK] python3 3.12.0
[OK] ia 4.1.0
[OK] ocrmypdf 16.0.0
[OK] qpdf 11.6.3
[OK] pdftoppm 24.02.0
[--] ANTHROPIC_API_KEY not set (optional)
```

## Platform Notes

### Linux (Debian/Ubuntu)

```bash
sudo apt update
sudo apt install nodejs npm git python3 python3-pip ocrmypdf qpdf poppler-utils
pip install internetarchive
```

### macOS

```bash
brew install node git python3 ocrmypdf qpdf poppler
pip3 install internetarchive
```

### Windows (WSL recommended)

Use Windows Subsystem for Linux (WSL) with Ubuntu, then follow the Linux instructions.
OCR tools are Linux-only; they are not available natively on Windows.
