# Security and privacy

Never submit API keys, authentication headers, profile files, signed upload URLs,
private documents or unredacted conversation logs to issues or pull requests.
Use a synthetic reproducer. Rotate exposed credentials with their provider.

Report exploitable vulnerabilities through GitHub private vulnerability reporting
when enabled. Otherwise use a private contact listed by the maintainer; do not
publish exploit details or secrets in an issue. No response-time guarantee is
currently offered.

PDF text extraction is local by default. Explicit MinerU OCR sends the PDF to
MinerU. Sending a model question sends relevant text, quoted content and history
to the configured provider. Credentials remain in the upstream plugin's local
configuration; this project does not add credential encryption. Raw HTML in model
Markdown is treated as text. Do not assume model output is trustworthy.

Only the current patch series is maintained. Internal Zotero APIs can change;
security fixes in upstream dependencies require a new reviewed upstream input.
