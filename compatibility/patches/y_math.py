# SPDX-License-Identifier: AGPL-3.0-or-later
# Unofficial modifications by komusama0930, 2026-10-13; see NOTICE.
from pathlib import Path


def patch(text):
    root = Path(__file__).resolve().parent.parent
    library = (root/'vendor/katex/katex.min.js').read_text()
    helpers = (root/'assets/math.js').read_text()
    before = '  var markdownit = require_index_cjs4();'
    if text.count(before) != 1: raise ValueError('KaTeX injection target mismatch')
    text = text.replace(before, before + '\n  var require_paperAgentKaTeX = __commonJS({ "vendor/katex": (exports, module) => {\n' + library + '\n  } });\n  var paperAgentKaTeX = require_paperAgentKaTeX();\n' + helpers, 1)
    start = text.index('  function renderMarkdownWithKeywords(')
    end = text.index('  // src/modules/ui/dialog/dialogui.ts', start)
    text = text[:start]+'''  paperAgentRegisterMath(md);
  function renderMarkdownWithKeywords(content, keywords = []) {
    const values = Array.isArray(keywords) ? keywords : [keywords];
    const clean = values.filter(value => typeof value === "string" && value.trim()).map(value => value.trim());
    return md.render(String(content ?? ""), { paperAgentKeywords: clean });
  }

'''+text[end:]
    return text
