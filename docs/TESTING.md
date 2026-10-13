# Validation

Local macOS / Zotero 10.0.6 validation on 2026-10-13: 23 Node tests and 52 native
checks passed. Native tests use a generated synthetic PDF and mocked LLM streams;
they do not require a model key or send private documents. Machine paths, profiles
and diagnostic outputs are intentionally excluded from this repository.

Run the README build and Node checks first. On a host with Zotero 10:

```sh
python3 compatibility/tests/prepare_native_smoke.py
```

The script prints a disposable directory. Launch Zotero with that directory's
`profile` (use the appropriate executable path for your platform):

```sh
/Applications/Zotero.app/Contents/MacOS/zotero -no-remote -profile /tmp/<directory>/profile -headless -ZoteroDebugText
```

Use the actual printed path, not the example placeholder. The diagnostic add-on
writes result.json in that temporary directory and quits that isolated instance.
Do not install it in your normal profile. --preview keeps its synthetic preview
visible for one minute. Windows/Linux execution paths need platform validation.

Tests cover startup, linked/picker PDF extraction and refs, prompt migration and
requests, search/keyboard/nested dialogs, new conversations and draft preservation,
visibility/height recovery, quotes, streaming/history Markdown, dark/light contrast,
and cleanup. External MinerU/model service compatibility and independent concurrent
multi-window conversations remain outside the fully validated scope.
