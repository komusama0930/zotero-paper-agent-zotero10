# Release policy

## Current source-only publication

Publish editable compatibility patches, assets, reading prompts, tests, license,
attribution, provenance and build tools. Do not publish upstream XPI files,
generated patched JavaScript, compiled plugin trees, XPI release assets or CI
artifacts containing them. Users may fetch the official input and apply patches
locally. The input checksum must be fixed and verified.

## Before a binary release

Resolve the observed mismatch between the official release and public source tag.
Obtain and verify complete corresponding source for the exact upstream input,
including required dependency sources and build/install materials. Include our
editable modification sources, preserve notices, and make corresponding source
available by an applicable AGPL distribution method alongside the binary. A link
to mismatched source or only a compiled bundle is not a substitute for that work.

Check each dependency's terms, upstream notices, changed-version attribution,
source and binary reproducibility, and publication contents. Record verified
source references and hashes. If any source or licensing issue remains unresolved,
continue publishing only the patch project.

Inspect the Git index and release archive for secrets and personal files. Run
`python3 tools/check_publication.py` and the relevant tests. Release notes must
state the derivative/unofficial status, changes, validation and known limitations.
Do not silently repoint the retained upstream updater to an unverified channel.

Vendored KaTeX distribution JS/CSS/fonts are a MIT-licensed dependency, not a
redistributed upstream Zotero plugin binary. Keep its original license, version
and source/provenance record. Do not edit the vendored library without documenting
the modification; project math integration sources remain directly editable.
