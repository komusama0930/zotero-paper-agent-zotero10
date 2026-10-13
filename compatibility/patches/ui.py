# SPDX-License-Identifier: AGPL-3.0-or-later
# Unofficial modifications maintained by komusama0930; 2026-10-13. See NOTICE.
from pathlib import Path


def patch(text):
    def replace(before, after):
        nonlocal text
        if text.count(before) != 1:
            raise ValueError(f"UI patch target count: {before[:100]}")
        text = text.replace(before, after, 1)
    helpers = (Path(__file__).resolve().parent.parent / "assets/sidebar.js").read_text()
    replace('  function registerChatUI(body, item) {', helpers + '\n  function registerChatUI(body, item) {')
    replace('if (chatUI.dataset.paperAgentMounted === "true") return;', 'if (chatUI.dataset.paperAgentMounted === "true") {\n      paperAgentDrainQuotes(chatUI);\n      return;\n    }')
    replace('    chatUI.appendChild(inputContainer);', '    chatUI.appendChild(inputContainer);\n    paperAgentEnhanceSidebar(chatUI);')
    replace('      const windowSize = addon.data.zoteroPaperAgentApi.configManager.getChatWindowSizeSetting();\n      chatUI.style.width = windowSize.width + "px";\n      chatUI.style.height = windowSize.height + "px";', '      // Width follows the item pane; height follows its available viewport.')
    replace('      doc.getElementById("zotero-item-pane-content")?.classList.add("makeItRed");', '''      const sidebarStyle = doc.createElementNS("http://www.w3.org/1999/xhtml", "link");
      sidebarStyle.rel = "stylesheet";
      sidebarStyle.href = `chrome://${addon.data.config.addonRef}/content/css/sidebar.css`;
      doc.documentElement.appendChild(sidebarStyle);''')
    replace('    addon.data.initialized = true;', '    Zotero.Reader.registerEventListener("renderTextSelectionPopup", paperAgentSelectionPopup, addon.data.config.addonID);\n    addon.data.initialized = true;')
    replace('  function onShutdown() {\n    addon.data.alive = false;', '''  function onShutdown() {
    Zotero.Reader.unregisterEventListener("renderTextSelectionPopup", paperAgentSelectionPopup);
    for (const cleanup of addon.data.paperAgentUICleanups || []) cleanup();
    addon.data.paperAgentPendingQuotes = [];
    addon.data.alive = false;''')
    start = text.index('  function createChatWindowSizeSettingDialog(')
    end = text.index('  // src/modules/ui/listener/editMinerUApiListener.ts', start)
    text = text[:start] + '  function createChatWindowSizeSettingDialog(chatUI, dialog, mask, windowSize) {\n    mask.remove();\n    ztoolkit.getGlobal("alert")("侧栏已自动适应窗口大小，无需设置固定宽高。");\n  }\n\n' + text[end:]
    start = text.index('  function registerSendMessageEnterKeyEvent(')
    end = text.index('  function registerClipboardPasteEvent(', start)
    text = text[:start] + '''  function registerSendMessageEnterKeyEvent(chatUI) {
    chatUI.querySelector(`#${PLUGIN_PREFIX}input-textarea`).addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        if (chatUI.querySelector(`#${PLUGIN_PREFIX}send-message-button`).style.display !== "none") sendMessage(chatUI);
      }
    });
  }
''' + text[end:]
    return text
