#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
# Unofficial modifications maintained by komusama0930; 2026-10-13. See NOTICE.
"""Check tracked publication material without printing potential secrets."""
from pathlib import Path
import re
import subprocess

root = Path(__file__).resolve().parents[1]
result = subprocess.run(['git','ls-files','-z'],cwd=root,capture_output=True,check=True)
paths = [Path(p) for p in result.stdout.decode().split('\0') if p]
if not paths:
    raise SystemExit('Stage publication material before running this check')
issues = []
secret_pattern = re.compile(rb'\bsk-[A-Za-z0-9_-]{20,}|\bgh[pousr]_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----')
for relative in paths:
    path = root / relative
    if path.suffix in {'.xpi','.png','.pdf','.zip','.bak'} or any(part in {'patched','dist','analysis','node_modules'} for part in relative.parts):
        issues.append(str(relative)+': prohibited generated/private/binary publication input')
    if path.is_file():
        data = path.read_bytes()
        if secret_pattern.search(data): issues.append(str(relative)+': possible credential')
        if re.search(rb'/' + rb'Users/[^/\s]+/|ai\.ower\.top',data): issues.append(str(relative)+': personal path or service setting')
if issues:
    raise SystemExit('\n'.join(issues))
print(f'Publication check passed for {len(paths)} tracked files. Also review prose and licensing manually.')
