# SPDX-License-Identifier: AGPL-3.0-or-later
# Unofficial modifications maintained by komusama0930; 2026-10-13. See NOTICE.
"""Checked edits to the official bundled JavaScript, without rebuilding stale sources."""


def patch(text):
    def replace(before, after):
        nonlocal text
        if text.count(before) != 1:
            raise ValueError(f"Expected exactly one patch target: {before[:100]!r}")
        text = text.replace(before, after, 1)

    def block(start, end, after):
        if text.count(start) != 1:
            raise ValueError(f"Ambiguous start: {start!r}")
        first = text.index(start)
        last = text.index(end, first)
        replace(text[first:last], after)

    replace('if (typeof ChromeUtils.import === "undefined") return ChromeUtils.importESModule(path2, { global: "contextual" });',
            'if (typeof ChromeUtils.import === "undefined" || parseInt(Zotero.version, 10) >= 10) return ChromeUtils.importESModule(path2, { global: "contextual" });')

    block('  function getCurrentTabItemPDFPath() {',
          '  function checkChatWindowSizeSetting(setting) {', '''  async function getCurrentTabItemPDFPath(chatUI) {
    const attachmentID = Number(chatUI?.dataset.paperAgentAttachmentId);
    let item;
    if (attachmentID) {
      item = await Zotero.Items.getAsync(attachmentID);
    } else {
      const tabs = chatUI?.ownerDocument?.defaultView?.Zotero_Tabs || ztoolkit.getGlobal("Zotero_Tabs");
      const reader = tabs?.selectedID && Zotero.Reader.getByTabID(tabs.selectedID);
      if (reader?.itemID) item = await Zotero.Items.getAsync(reader.itemID);
    }
    if (!item?.isAttachment() || item.attachmentContentType !== "application/pdf") {
      throw new Error("Please open a PDF attachment before sending it to Paper Agent.");
    }
    const pdfPath = await item.getFilePathAsync();
    if (!pdfPath) {
      throw new Error("The PDF file is missing. Download or locate the attachment first.");
    }
    return pdfPath;
  }
  async function getCurrentTabItemPDFFile(pdfPath) {
    const uint8Array = await IOUtils.read(pdfPath);
    return new File([uint8Array], PathUtils.filename(pdfPath), {
      type: "application/pdf",
      lastModified: Date.now()
    });
  }
''')
    block('  function registerSendPDFEvent(chatUI, uploadSuccesscallback, removeSuccesscallback) {',
          '  function checkBeforeSendMessage(llmGroupName) {', '''  function registerSendPDFEvent(chatUI, uploadSuccesscallback, removeSuccesscallback) {
    const sendPDFButton = chatUI.querySelector("#zotero-paper-agent-send-pdf-button");
    sendPDFButton.addEventListener("click", async () => {
      if (sendPDFButton.disabled) return;
      sendPDFButton.disabled = true;
      let fileItem;
      try {
        // Resolve once, so a tab switch during file reading cannot mix two PDFs.
        const filePath = await getCurrentTabItemPDFPath(chatUI);
        const file = await getCurrentTabItemPDFFile(filePath);
        const fileListContainer = chatUI.querySelector("#zotero-paper-agent-file-list-container");
        fileItem = createFileItem(fileListContainer.ownerDocument, file.name, file.size);
        fileListContainer.appendChild(fileItem);
        const response = await addon.data.zoteroPaperAgentApi.uploadFile(file, filePath);
        if (!response || response.error) {
          throw new Error(response?.error || "The upload returned no result.");
        }
        const deleteContainer = fileItem.querySelector("#zotero-paper-agent-file-item-delete-container");
        const uploadStatusContainer = fileItem.querySelector("#zotero-paper-agent-file-item-upload-status-container");
        deleteContainer.style.display = "flex";
        uploadStatusContainer.style.display = "none";
        deleteContainer.addEventListener("click", () => {
          fileItem.remove();
          addon.data.zoteroPaperAgentApi.removeRefFile(response.fileID);
          if (removeSuccesscallback) removeSuccesscallback(response);
        });
        if (uploadSuccesscallback) uploadSuccesscallback(response);
        new ztoolkit.ProgressWindow(addon.data.config.addonName).createLine({
          text: "File Uploaded!", type: "success", progress: 100
        }).show();
      } catch (error) {
        fileItem?.remove();
        Zotero.logError(error);
        new ztoolkit.ProgressWindow(addon.data.config.addonName).createLine({
          text: "File Upload Failed: " + (error?.message || String(error)),
          type: "error", progress: 100
        }).show();
      } finally {
        sendPDFButton.disabled = false;
      }
    });
  }
''')
    replace('      while (!addon.data.zoteroPaperAgentApi?.configManager.getIsLoaded() && !this.modelManager.getIsLoaded()) {',
            '''      while (!this.configManager.getIsLoaded() || !this.modelManager.getIsLoaded()
        || !this.historyManager.getIsLoaded() || !this.promptManager.getIsLoaded()) {
        if (!addon.data.alive) return;''')
    replace('      Zotero.ItemPaneManager.registerSection({',
            '      addon.data.paperAgentPaneID = Zotero.ItemPaneManager.registerSection({')
    replace('bodyXHTML: `<div id="${PLUGIN_PREFIX}chat-ui-container"><div id="${PLUGIN_PREFIX}chat-ui"></div><div id="${PLUGIN_PREFIX}chat-ui-slider"></div></div>`,',
            'bodyXHTML: `<html:div id="${PLUGIN_PREFIX}chat-ui-container"><html:div id="${PLUGIN_PREFIX}chat-ui"></html:div><html:div id="${PLUGIN_PREFIX}chat-ui-slider"></html:div></html:div>`,')
    replace('''        onItemChange: ({ body, item }) => {
          console.log("onItemChange", item);
          if (!item) return;
          clearChatUI(body);
          registerChatUI(body);
        },''', '''        onItemChange: ({ body, item }) => {
          if (!item) return;
          registerChatUI(body, item);
        },''')
    replace('''          await Zotero.Promise.delay(1e3);
          clearChatUI(body);
          registerChatUI(body);''', '          registerChatUI(body, item);')
    block('  function clearChatUI(body) {',
          '    const headerContainer = createHeaderContainer(chatUI);', '''  function registerChatUI(body, item) {
    const chatUI = body.querySelector(`#${PLUGIN_PREFIX}chat-ui`);
    if (!chatUI || !addon.data.alive || !addon.data.zoteroPaperAgentApi) return;
    if (item?.isAttachment() && item.attachmentContentType === "application/pdf") {
      chatUI.dataset.paperAgentAttachmentId = String(item.id);
    } else {
      delete chatUI.dataset.paperAgentAttachmentId;
    }
    // Item changes and async render must not erase drafts or double-bind events.
    if (chatUI.dataset.paperAgentMounted === "true") return;
    chatUI.dataset.paperAgentMounted = "true";
''')
    replace('''    addon.data.zoteroPaperAgentApi.recoverChatSessionCache().then(() => {
      setHeaderModelDisplay(chatUI);''', '''    addon.data.zoteroPaperAgentApi.recoverChatSessionCache().then(() => {
      if (!addon.data.alive || !chatUI.isConnected) return;
      setHeaderModelDisplay(chatUI);''')
    replace('''      chatUI.style.height = windowSize.height + "px";
    });''', '''      chatUI.style.height = windowSize.height + "px";
    }).catch((error) => Zotero.logError(error));''')
    replace('''    initLocale();
    MainUIFactory.registerZoteroPaperAgentItemPaneSection();
    await Promise.all(
      Zotero.getMainWindows().map((win) => onMainWindowLoad(win))
    );''', '''    initLocale();
    addon.data.zoteroPaperAgentApi = createApi();
    await Promise.all(
      Zotero.getMainWindows().map((win) => onMainWindowLoad(win))
    );
    await MainUIFactory.registerZoteroPaperAgentItemPaneSection();''')
    replace('''    addon.data.ztoolkit = createZToolkit();
    addon.data.zoteroPaperAgentApi = createApi();''', '''    // Keep the existing toolkit and API when a second main window opens.
    if (!addon.data.zoteroPaperAgentApi) addon.data.zoteroPaperAgentApi = createApi();''')
    replace('''  async function onMainWindowUnload(win) {
    ztoolkit.unregisterAll();
    addon.data.dialog?.window?.close();
  }
  function onShutdown() {
    ztoolkit.unregisterAll();''', '''  async function onMainWindowUnload(win) {
    // Shared resources are released on plugin shutdown, not when one window closes.
  }
  function onShutdown() {
    addon.data.alive = false;
    if (addon.data.paperAgentPaneID) {
      Zotero.ItemPaneManager.unregisterSection(addon.data.paperAgentPaneID);
    }
    ztoolkit.unregisterAll();''')
    return text
