// SPDX-License-Identifier: AGPL-3.0-or-later
// Unofficial modifications maintained by komusama0930; 2026-10-13. See NOTICE.
  function paperAgentStartNewChat(chatUI) {
    if (chatUI._paperAgentNewChat) return chatUI._paperAgentNewChat;
    const api = addon.data.zoteroPaperAgentApi;
    const stop = chatUI.querySelector(`#${PLUGIN_PREFIX}stop-message-button`);
    if (api.uploadingFileTaskNum > 0 || (stop && stop.style.display === "flex")) return Promise.resolve();
    const buttons = [...chatUI.querySelectorAll("button")].filter(button => !button.disabled);
    buttons.forEach(button => button.disabled = true);
    const task = (async () => {
      // Recover model/prompt preferences once; do not restore the old conversation into the panel.
      if (chatUI._paperAgentPreferencesReady) await chatUI._paperAgentPreferencesReady;
      if (!addon.data.alive || !chatUI.isConnected) return;
      const response = await api.createChatSession();
      if (!response || response.error) throw new Error(response?.error || "新对话创建失败");
      api.refs = [];
      chatUI.querySelector(`#${PLUGIN_PREFIX}message-container`).replaceChildren();
      chatUI.querySelector(`#${PLUGIN_PREFIX}file-list-container`).replaceChildren();
      setHeaderModelDisplay(chatUI);
      if (api.promptID) setPromptContainer(chatUI, api.promptID);
      chatUI.dataset.paperAgentChatId = response.chatID;
    })();
    chatUI._paperAgentNewChat = task.catch(error => {
      Zotero.logError(error);
      new ztoolkit.ProgressWindow(addon.data.config.addonName).createLine({ text: "新对话创建失败，请点击「新对话」重试。", type: "error", progress: 100 }).show();
    }).finally(() => {
      buttons.forEach(button => { if (button.isConnected) button.disabled = false; });
      chatUI._paperAgentNewChat = null;
    });
    return chatUI._paperAgentNewChat;
  }
  function paperAgentToggleConversation({ body, item, event }) {
    const chatUI = body.querySelector(`#${PLUGIN_PREFIX}chat-ui`);
    if (!chatUI) return;
    chatUI._paperAgentResizeSidebar?.();
    if (!event.target.open) { chatUI.dataset.paperAgentOpened = "false"; return; }
    if (chatUI.dataset.paperAgentOpened === "true") return;
    chatUI.dataset.paperAgentOpened = "true";
    if (chatUI.dataset.paperAgentMounted === "true") paperAgentStartNewChat(chatUI);
    else registerChatUI(body, item);
  }
