# SPDX-License-Identifier: AGPL-3.0-or-later
# Unofficial modifications maintained by komusama0930; 2026-10-13. See NOTICE.
from pathlib import Path

def patch(text):
    def replace(before, after):
        nonlocal text
        if text.count(before) != 1: raise ValueError('New chat target mismatch: '+before[:100])
        text=text.replace(before,after,1)
    replace('  function registerChatUI(body, item) {', (Path(__file__).resolve().parent.parent/'assets/new-chat.js').read_text()+'\n  function registerChatUI(body, item) {')
    start=text.index('    addon.data.zoteroPaperAgentApi.recoverChatSessionCache().then(() => {',text.index('  function registerChatUI(body, item) {'))
    end=text.index('    registerUploadFileEvent(',start)
    text=text[:start]+'''    chatUI.dataset.paperAgentOpened = "true";
    chatUI._paperAgentPreferencesReady = addon.data.zoteroPaperAgentApi.recoverChatSessionCache();
    paperAgentStartNewChat(chatUI);
'''+text[end:]
    replace('''        // Optional, can be asynchronous.
        onAsyncRender:''','''        onToggle: paperAgentToggleConversation,
        // Optional, can be asynchronous.
        onAsyncRender:''')
    start=text.index('  function registerCreateNewChatSessionEvent(')
    end=text.index('  function registerSendMessageEvent(',start)
    text=text[:start]+'''  function registerCreateNewChatSessionEvent(chatUI) {
    chatUI.querySelector(`#${PLUGIN_PREFIX}new-chat-button`).addEventListener("click", () => paperAgentStartNewChat(chatUI));
  }
'''+text[end:]
    replace('  function sendMessage(chatUI, successCallback, failCallback) {', '  function sendMessage(chatUI, successCallback, failCallback) {\n    if (chatUI._paperAgentNewChat) return;')
    replace('      paperAgentDrainQuotes(chatUI);\n      return;', '      paperAgentDrainQuotes(chatUI);\n      chatUI._paperAgentResizeSidebar?.();\n      return;')
    return text
