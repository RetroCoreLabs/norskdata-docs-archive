.PHONY: all setup serve import search check check-deps ia-sync ia-verify ia-upload site-build site-serve mcp cache-clean ocr-strip ocr-redo ai-text

all: setup serve

setup:
	cd tools && npm install && npm run build

serve: setup
	cd tools && node dist/server.js

# CLI (primary interface in early phases)
import:
	cd tools && node dist/cli.js import $(SRC) $(ARGS)

search:
	cd tools && node dist/cli.js search "$(Q)"

check:
	cd tools && node dist/cli.js check

check-deps:
	cd tools && node dist/cli.js check-deps

# Internet Archive
ia-sync:
	cd tools && node dist/cli.js ia-sync $(if $(DRY),--dry-run)

ia-verify:
	cd tools && node dist/cli.js ia-verify

ia-upload:
	cd tools && node dist/cli.js ia-upload $(ITEM)

# OCR Pipeline
ocr-strip:
	cd tools && node dist/cli.js ocr-strip $(SRC) $(ARGS)

ocr-redo:
	cd tools && node dist/cli.js ocr-redo $(SRC) $(ARGS)

ai-text:
	cd tools && node dist/cli.js ai-text $(SRC) $(ARGS)

# Site
site-build:
	cd tools && node dist/cli.js build-site

site-serve: site-build
	cd tools && npx serve site -p 8000

# MCP
mcp:
	cd tools && node dist/mcp/server.js

# Cache
cache-clean:
	rm -rf ~/.norskdata/cache/*
