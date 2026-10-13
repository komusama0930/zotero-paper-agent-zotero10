# Unofficial Zotero 10 compatibility modifications

Modification date: 2026-10-13. Maintainer: komusama0930.
Derived from windfollowingheart/zotero-paper-agent; AGPL-3.0-or-later.
This is a changed version, not an official upstream release.

The patch scripts and assets are the editable sources of these modifications.
See the repository README, NOTICE and docs/PROVENANCE.md for attribution,
upstream source differences, local build steps, limitations and publication scope.

Modified behavior: Zotero 10 startup and reader sidebar compatibility; responsive
light/dark UI and first-open height; selection quotes; default local PDF extraction
with optional MinerU OCR; seven reading prompts; keyboard/search dialogs; default
new local conversation; Chat Completions/optional Responses; Markdown formatting.

The plugin ID and upstream update URL are intentionally preserved for compatibility.
This build replaces the existing Paper Agent add-on, uses its configuration and
history, and does not contain credentials. Extracted references are sent to the
configured model only when the user sends a query; explicitly selected MinerU OCR
uploads PDFs to MinerU.

Local build: python3 tools/fetch_upstream.py; python3 compatibility/build.py.
Do not publish generated XPI files until complete corresponding source and all
required license/build materials have been verified (docs/RELEASING.md).

Streaming performance: bounded formula cache, coalesced/adaptive updates, stable
Markdown block DOM, immediate completion flush, scroll preservation, and dialog
observer filtering. The complete Markdown source is still parsed for references.
