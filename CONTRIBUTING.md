# Contributing

This is an unofficial derivative of windfollowingheart/zotero-paper-agent.
Contributions to the modifications are accepted under AGPL-3.0-or-later; no
copyright transfer is required. Keep upstream attribution and dependency notices.

1. Open an issue for a substantial change; explain the user-visible problem.
2. Edit compatibility/patches or compatibility/assets. Do not edit generated files.
3. Fetch and verify the official input; build, run the syntax check and Node tests
   described in README. For reader/lifecycle changes, use the isolated native test.
4. Submit a focused pull request with behavior, validation and limitations.

Never commit credentials, user profiles, private PDFs, chat records, generated
XPI packages, or machine-specific logs. Use synthetic documents in tests. Native
checks do not need external model requests. Record added dependencies and their
license terms; do not remove upstream licensing comments.

Patch targets are fixed to official v3.1.1. When updating upstream, verify the
input checksum, inspect changes, preserve attribution, and rerun relevant tests.
Before distributing binaries, follow docs/RELEASING.md. Report upstream-only
issues upstream and link relevant context without claiming upstream endorsement.
