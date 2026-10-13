# SPDX-License-Identifier: AGPL-3.0-or-later
# Unofficial modifications maintained by komusama0930; 2026-10-13. See NOTICE.
"""Create a disposable Zotero profile, synthetic PDF and local diagnostic add-on."""
from pathlib import Path
import json
import sys
import shutil
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[2]
base = Path(tempfile.mkdtemp(prefix="paper-agent-z10-", dir=tempfile.gettempdir()))
profile = base / "profile"
(profile / "extensions").mkdir(parents=True)
(base / "data").mkdir()
prefs = {
    "ui.systemUsesDarkTheme": 1,
    "extensions.zotero.dataDir": str(base / "data"),
    "extensions.zotero.useDataDir": True,
    "extensions.zotero.firstRun2": False,
    "extensions.zotero.firstRunGuidance": False,
    "extensions.zotero.automaticScraperUpdates": False,
    "extensions.zotero.httpServer.enabled": False,
    "extensions.zotero.sync.autoSync": False,
    "extensions.autoDisableScopes": 0,
    "extensions.enabledScopes": 15,
    "extensions.update.enabled": False,
    "app.update.enabled": False,
    "browser.shell.checkDefaultBrowser": False,
}
(profile / "user.js").write_text("".join(
    f"user_pref({json.dumps(key)}, {json.dumps(value)});\n" for key, value in prefs.items()
))
shutil.copy2(ROOT / "dist/zotero-paper-agent-3.1.1.17.xpi",
             profile / "extensions/zoteropaperagent@github.com.xpi")
chunks = [b"%PDF-1.4\n"]
offsets = []
objects = [
    b"<< /Type /Catalog /Pages 2 0 R >>",
    b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    b"<< /Length " + str(len(b"BT /F1 12 Tf 20 250 Td (Synthetic literature methods passage.) Tj ET")).encode() + b" >>\nstream\nBT /F1 12 Tf 20 250 Td (Synthetic literature methods passage.) Tj ET\nendstream",
    b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
]
for index, obj in enumerate(objects, 1):
    offsets.append(sum(map(len, chunks)))
    chunks.append(str(index).encode() + b" 0 obj\n" + obj + b"\nendobj\n")
xref = sum(map(len, chunks))
chunks.append(b"xref\n0 6\n0000000000 65535 f \n" + b"".join(
    f"{offset:010d} 00000 n \n".encode() for offset in offsets
) + b"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" + str(xref).encode() + b"\n%%EOF\n")
(base / "fixture.pdf").write_bytes(b"".join(chunks))
bootstrap = (ROOT / "compatibility/tests/native-smoke-bootstrap.js").read_text()
for key, value in {
    "__PROFILE__": str(profile), "__DATA__": str(base / "data"),
    "__FIXTURE__": str(base / "fixture.pdf"), "__RESULT__": str(base / "result.json"),
}.items():
    bootstrap = bootstrap.replace(key, json.dumps(value))
if "--preview" in sys.argv:
    bootstrap = bootstrap.replace('    body.remove();', '    Services.prefs.setIntPref("ui.systemUsesDarkTheme", 1);\n    body.style.width = "360px";\n    chat.querySelector("#zotero-paper-agent-prompt-button").click();\n    win.document.title = "Paper Agent isolated preview";\n    await Zotero.Promise.delay(60000);\n    body.remove();')
manifest = {
    "manifest_version": 2, "name": "Paper Agent isolated smoke test", "version": "1.0",
    "applications": {"zotero": {
        "id": "paper-agent-smoke-test@local",
        "update_url": "https://example.invalid/smoke-update.json",
        "strict_min_version": "10.0", "strict_max_version": "10.*",
    }},
}
with zipfile.ZipFile(profile / "extensions/paper-agent-smoke-test@local.xpi", "w") as archive:
    archive.writestr("manifest.json", json.dumps(manifest))
    archive.writestr("bootstrap.js", bootstrap)
print(base)
