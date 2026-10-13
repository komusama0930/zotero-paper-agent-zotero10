# SPDX-License-Identifier: AGPL-3.0-or-later
# Unofficial modifications maintained by komusama0930; 2026-10-13. See NOTICE.
from pathlib import Path

def patch(text):
    text = text.replace('  function paperAgentEnhanceSidebar(chatUI) {', (Path(__file__).resolve().parent.parent/'assets/dialogs.js').read_text()+'\n  function paperAgentEnhanceSidebar(chatUI) {\n    paperAgentEnhanceDialogs(chatUI);', 1)
    text = text.replace('      const llmModelListItem = modelListItems[i];', '      const llmModelListItem = modelListItems[i];\n      if (!llmModelListItem.dataset.modelName) continue;', 1)
    for before, after in [('"Setting", SETTING_DIALOG_ID', '"设置", SETTING_DIALOG_ID'), ('"Prompt",\n        SELECT_PROMPT_DIALOG_ID', '"文献阅读提示词",\n        SELECT_PROMPT_DIALOG_ID'), ('"Chat Window Size Setting"', '"侧栏自动适应宽高"')]:
        text = text.replace(before, after)
    return text
