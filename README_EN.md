# Zotero Paper Agent — Zotero 10 compatibility patches

[简体中文](README.md) · [Upstream](https://github.com/windfollowingheart/zotero-paper-agent)

An **unofficial** patch project maintained by **komusama0930**, derived from Zotero Paper Agent by **windfollowingheart**. The original application and its primary features belong to upstream. This project's modifications are licensed **AGPL-3.0-or-later**. Preserve author, copyright and dependency license notices; see [NOTICE](NOTICE) and [provenance](docs/PROVENANCE.md).

Features: Zotero 10 lifecycle support; responsive light/dark reader sidebar; first-open height recovery; quoted PDF selections with pages; default local PDF text extraction and optional MinerU OCR; seven editable reading prompts; searchable keyboard-operated dialogs; a new local conversation on opening; streaming/history Markdown and offline KaTeX formulas; Chat Completions and optional Responses transport.

## Publication scope

This repository publishes editable **patch sources and build tooling only**, not upstream or modified XPI binaries. The public upstream v3.1.1 source tag differs from the official v3.1.1 release bundle. We have not verified complete corresponding source for that binary and do not represent compiled JavaScript as complete corresponding source. Verify that source, dependencies and build materials before distributing any binary; see [release policy](docs/RELEASING.md).

KaTeX 0.16.22 is vendored with its CSS/fonts under its original MIT license; see [dependency provenance](docs/DEPENDENCIES.md). Streaming uses a bounded formula cache, coalesces updates every 100–250ms, and preserves unchanged block DOM and the reader’s scroll position. Completion flushes immediately. Math supports `$...$`, `$$...$$`, `\(...\)` and `\[...\]`, with raw-source fallback for unsupported expressions.

## Local build

Python 3.9+ and Node.js 20+ for tests; no npm installation required.

```sh
python3 tools/fetch_upstream.py
python3 compatibility/build.py
node --check compatibility/patched/content/scripts/zoteropaperagent.js
node --test compatibility/tests/runtime.test.cjs
```

The downloader obtains the official GitHub release with a mandatory SHA-256 check. Install the locally generated `dist/zotero-paper-agent-3.1.1.18.xpi` using Zotero's add-on manager, then restart. **The package retains upstream's add-on ID and replaces an existing installation**, sharing its settings and history. Back up your profile first. The upstream update URL is retained and future updates may replace modifications.

Configure your own model credentials. Select a reading prompt, read a PDF or quote a selection, and send a question. Creating a local conversation makes no model request. Local PDF extraction sends no binary to a cloud service, but sending a question sends relevant text, quotes and conversation context to your configured model. Explicitly selecting MinerU OCR uploads the PDF to MinerU.

Verified on macOS / Zotero 10.0.6 with 27 Node checks and 57 isolated native checks, synthetic PDFs and mocked model responses. Cloud services, Windows/Linux, and all Zotero versions are not fully tested. The local extractor uses internal Zotero APIs; encrypted/scanned PDFs and long context may need additional handling. Multiple windows still share upstream API state. Markdown and offline KaTeX math are supported; syntax highlighting and all LaTeX packages are not included.

See [contribution guidelines](CONTRIBUTING.md), [code of conduct](CODE_OF_CONDUCT.md) and [security guidance](SECURITY.md). Never include keys or private documents in issues.
