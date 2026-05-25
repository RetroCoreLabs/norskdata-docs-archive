# Backup and Disaster Recovery

## Primary Storage: Internet Archive

All PDF artifacts are stored on the Internet Archive. IA mirrors content across multiple data centers and provides permanent, stable URLs. Items are versioned -- replacing a file preserves the previous version.

## Verification

- `make ia-verify` -- Checksum verification of all IA items against catalog SHA256SUMS
- GitHub Actions cron: weekly `ia-verify` run, alerts on failures
- IA auto-generates its own checksums per item

## Git Repository

- All metadata is version-controlled in git (full history)
- GitHub is the primary host; local clones provide redundancy
- Catalog JSON + OCR text files are small enough that any clone is a full backup
- GitHub Actions CI validates catalog integrity on every PR

## Cold Backup

A complete mirror of all original PDF artifacts is maintained on local storage:

- **Location**: documented offline (not in git for security)
- **Updated**: after each bulk import/upload cycle
- **Contents**: all PDF renditions, original scans, checksums

## Recovery Procedures

1. **Git repo lost**: Re-clone from GitHub (or any local clone)
2. **IA item corrupted**: Re-upload from cold backup, verify checksums
3. **GitHub down**: Work from local clone, push when available
4. **Complete loss**: Rebuild from cold backup + any surviving clone

## Checksum Integrity

- `catalog/SHA256SUMS.txt` contains preservation-grade checksums for all artifacts
- Every IA upload is verified against these checksums
- The `make check` target validates catalog consistency
