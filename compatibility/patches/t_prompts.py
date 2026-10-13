# SPDX-License-Identifier: AGPL-3.0-or-later
# Unofficial modifications maintained by komusama0930; 2026-10-13. See NOTICE.
import json
from pathlib import Path

def patch(text):
    prompts = json.loads((Path(__file__).resolve().parent.parent / 'assets/reading-prompts.json').read_text())
    start = text.index('  var PromptsManager = class {')
    end = text.index('    getPrompts() {', start)
    part = text[start:end]
    needle = '        await IOUtils.writeJSON(this.promptPath, this.prompts);\n      }\n    }'
    if part.count(needle) != 1: raise ValueError('Prompt seeding target mismatch')
    replacement = '''        await IOUtils.writeJSON(this.promptPath, this.prompts);
      }
      const seedPath = PathUtils.join(PathUtils.parent(this.promptPath), "reading-prompts-v1.seeded.json");
      if (!await IOUtils.exists(seedPath)) {
        const builtins = ''' + json.dumps(prompts,ensure_ascii=False) + ''';
        const ids = new Set(this.prompts.map(prompt => prompt.prompt_id));
        this.prompts = [...this.prompts, ...builtins.filter(prompt => !ids.has(prompt.prompt_id))];
        await IOUtils.writeJSON(this.promptPath, this.prompts);
        await IOUtils.writeJSON(seedPath, { version: 1 });
      }
    }'''
    return text[:start]+part.replace(needle,replacement)+text[end:]
