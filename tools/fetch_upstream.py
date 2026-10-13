#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
# Unofficial modifications maintained by komusama0930; 2026-10-13. See NOTICE.
"""Fetch the official upstream input with mandatory hash verification."""
from pathlib import Path
import hashlib
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
URL = 'https://github.com/windfollowingheart/zotero-paper-agent/releases/download/v3.1.1/zotero-paper-agent.xpi'
EXPECTED = '1e4d574c1df0b280bd666186ea58f4aa6232be9cb805677fb757111d525681f7'
target = ROOT / 'paper-agent-v3.1.1.xpi'
if target.exists():
    content = target.read_bytes()
else:
    with urllib.request.urlopen(URL, timeout=60) as response:
        content = response.read()
if hashlib.sha256(content).hexdigest() != EXPECTED:
    raise SystemExit('Upstream SHA-256 mismatch; refusing to save or build')
if not target.exists():
    temporary = target.with_suffix('.download')
    temporary.write_bytes(content)
    temporary.replace(target)
print('Official upstream input verified:', target.name)
