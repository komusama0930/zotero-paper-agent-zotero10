#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
# Unofficial modifications by komusama0930, 2026-10-13; see NOTICE.
"""Build a reproducible local compatibility patch from the official 3.1.1 XPI."""
import difflib
import hashlib
import json
from pathlib import Path
import runpy
import zipfile

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "paper-agent-v3.1.1.xpi"
EXPECTED_SHA256 = "1e4d574c1df0b280bd666186ea58f4aa6232be9cb805677fb757111d525681f7"
VERSION = "3.1.1.18"
SCRIPT = "content/scripts/zoteropaperagent.js"


def replace_once(text, before, after):
    if text.count(before) != 1:
        raise ValueError(f"Patch target must occur exactly once: {before[:90]!r}")
    return text.replace(before, after, 1)


def build():
    if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != EXPECTED_SHA256:
        raise ValueError("Official XPI checksum mismatch; refusing to patch")
    with zipfile.ZipFile(SOURCE) as archive:
        files = {name: archive.read(name) for name in archive.namelist() if not name.endswith("/")}
    original = files[SCRIPT].decode()
    modified = original
    for patch in sorted((ROOT / "compatibility/patches").glob("*.py")):
        modified = runpy.run_path(str(patch))["patch"](modified)
    modified = replace_once(modified, 'var version2 = "3.1.1";', f'var version2 = "{VERSION}";')
    files[SCRIPT] = modified.encode()
    files["content/css/sidebar.css"] = (ROOT / "compatibility/assets/sidebar.css").read_bytes()
    for asset in sorted((ROOT / "compatibility/assets").glob("*")):
        files[f"compatibility-source/assets/{asset.name}"] = asset.read_bytes()
    math_vendor = ROOT / "compatibility/vendor/katex"
    for asset in sorted(math_vendor.rglob("*")):
        if asset.is_file():
            relative = asset.relative_to(math_vendor).as_posix()
            files[f"compatibility-source/vendor/katex/{relative}"] = asset.read_bytes()
            if relative == "katex.min.css" or relative.startswith("fonts/"):
                files[f"content/css/katex/{relative}"] = asset.read_bytes()
    files["LICENSES/KaTeX-MIT.txt"] = (math_vendor / "LICENSE").read_bytes()
    manifest = json.loads(files["manifest.json"])
    manifest["version"] = VERSION
    manifest["name"] = "Zotero Paper Agent (Zotero 10 compatibility)"
    manifest["applications"]["zotero"]["strict_max_version"] = "10.*"
    # Zotero 10 requires update_url even for locally patched plugins.
    # Retain the original URL and identity; compatibility gates still apply to updates.
    files["manifest.json"] = (json.dumps(manifest, indent=2) + "\n").encode()
    files["COMPATIBILITY.md"] = (ROOT / "compatibility/README.md").read_bytes()
    files["LICENSE"] = (ROOT / "LICENSE").read_bytes()
    files["NOTICE"] = (ROOT / "NOTICE").read_bytes()
    # Keep the exact, reviewable modification recipe inside the distributed XPI.
    files["compatibility-source/build.py"] = Path(__file__).read_bytes()
    for patch in sorted((ROOT / "compatibility/patches").glob("*.py")):
        files[f"compatibility-source/patches/{patch.name}"] = patch.read_bytes()
    (ROOT / "dist").mkdir(exist_ok=True)
    target = ROOT / "dist" / f"zotero-paper-agent-{VERSION}.xpi"
    extracted = ROOT / "compatibility/patched"
    for name, data in files.items():
        path = extracted / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo(name, date_time=(2026, 10, 12, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data)
    diff = "".join(difflib.unified_diff(original.splitlines(True), modified.splitlines(True),
                                    fromfile=f"upstream/{SCRIPT}", tofile=f"patched/{SCRIPT}"))
    (ROOT / "compatibility/changes.diff").write_text(diff)
    checksum = hashlib.sha256(target.read_bytes()).hexdigest()
    target.with_suffix(".xpi.sha256").write_text(f"{checksum}  {target.name}\n")
    print(target)
    print(f"SHA256 {checksum}")


if __name__ == "__main__":
    build()
