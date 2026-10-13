// SPDX-License-Identifier: AGPL-3.0-or-later
// Unofficial modifications maintained by komusama0930; 2026-10-13. See NOTICE.
  // Local UI enhancement: selection is only transmitted when the user sends it.
  function paperAgentInsertQuote(chatUI, quote) {
    const input = chatUI.querySelector(`#${PLUGIN_PREFIX}input-textarea`);
    if (!input) return false;
    const source = `PDF · ${quote.title || "选中文字"}${quote.page ? ` · 第 ${quote.page} 页` : ""}`;
    const block = `[引用：${source}]\n${quote.text.split("\n").map(line => "> " + line).join("\n")}\n[/引用]`;
    input.value = (input.value.trimEnd() ? input.value.trimEnd() + "\n\n" : "") + block + "\n\n";
    input.dispatchEvent(new input.ownerDocument.defaultView.Event("input", { bubbles: true }));
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    return true;
  }
  function paperAgentDrainQuotes(chatUI) {
    const pending = addon.data.paperAgentPendingQuotes || [];
    addon.data.paperAgentPendingQuotes = pending.filter(quote => {
      if (quote.win !== chatUI.ownerDocument.defaultView || String(quote.itemID) !== chatUI.dataset.paperAgentAttachmentId) return true;
      return !paperAgentInsertQuote(chatUI, quote);
    });
  }
  function paperAgentSelectionPopup({ reader, doc, params, append }) {
    const text = params?.annotation?.text?.trim();
    if (!text || !addon.data.alive) return;
    const button = doc.createElement("button");
    button.textContent = "引用到对话";
    button.title = "将选中文字和页码加入 Paper Agent 输入框；点击发送后交给 LLM";
    button.style.cssText = "border:1px solid #8e9bb0;border-radius:6px;padding:5px 9px;cursor:pointer;font:inherit;";
    button.addEventListener("click", () => {
      const win = reader._window;
      if (!win || win.closed) return;
      const annotation = params.annotation;
      const page = annotation.pageLabel || (Number.isInteger(annotation.position?.pageIndex) ? String(annotation.position.pageIndex + 1) : "");
      const item = Zotero.Items.get(reader.itemID);
      const quote = { win, itemID: reader.itemID, text, page, title: item?.getDisplayTitle?.() || "" };
      const chats = [...win.document.querySelectorAll(`#${PLUGIN_PREFIX}chat-ui`)].filter(chat => chat.isConnected && chat.dataset.paperAgentAttachmentId === String(reader.itemID));
      const chat = chats.find(node => node.getBoundingClientRect().width > 0);
      if (chat && paperAgentInsertQuote(chat, quote)) {
        button.textContent = "已加入对话 ✓";
      } else {
        (addon.data.paperAgentPendingQuotes ||= []).push(quote);
        button.textContent = "已暂存 · 请打开 Paper Agent 侧栏";
      }
      button.disabled = true;
    });
    append(button);
  }
  function paperAgentEnhanceSidebar(chatUI) {
    for (const [id, label] of [["send-pdf-button", "读取 PDF"], ["history-button", "历史"], ["setting-button", "设置"], ["prompt-button", "阅读提示词"]]) {
      const button = chatUI.querySelector(`#${PLUGIN_PREFIX}${id}`);
      if (button) button.textContent = label;
    }
    const win = chatUI.ownerDocument.defaultView;
    const input = chatUI.querySelector(`#${PLUGIN_PREFIX}input-textarea`);
    input.placeholder = "输入问题，或在 PDF 中选中文字后点击「引用到对话」…";
    input.setAttribute("aria-label", "向 LLM 提问或编辑引用原文");
    const hint = chatUI.ownerDocument.createElement("div");
    hint.className = "paper-agent-composer-hint";
    hint.textContent = "选中 PDF 原文 → 引用到对话 · Enter 发送 / Shift+Enter 换行";
    chatUI.appendChild(hint);
    const resize = () => {
      if (!chatUI.isConnected || !addon.data.alive || !chatUI.getClientRects().length) return;
      const top = Math.max(0, chatUI.getBoundingClientRect().top);
      const height = Math.max(300, win.innerHeight - top - 24);
      if (chatUI.style.height !== height + "px") chatUI.style.height = height + "px";
    };
    let frame = 0;
    const scheduleResize = () => {
      if (frame) win.cancelAnimationFrame(frame);
      // Sidebar expansion and Zotero layout settle over successive frames.
      frame = win.requestAnimationFrame(() => {
        resize();
        frame = win.requestAnimationFrame(() => { frame = 0; resize(); });
      });
    };
    chatUI._paperAgentResizeSidebar = scheduleResize;
    const observer = new win.ResizeObserver(scheduleResize);
    observer.observe(chatUI.parentElement);
    const visibility = new win.IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) scheduleResize();
    });
    visibility.observe(chatUI);
    win.addEventListener("resize", scheduleResize);
    const cleanup = () => {
      observer.disconnect();
      visibility.disconnect();
      if (frame) win.cancelAnimationFrame(frame);
      delete chatUI._paperAgentResizeSidebar;
      win.removeEventListener("resize", scheduleResize);
      win.removeEventListener("unload", cleanup);
      addon.data.paperAgentUICleanups?.delete(cleanup);
      addon.data.paperAgentPendingQuotes = (addon.data.paperAgentPendingQuotes || []).filter(quote => quote.win !== win);
    };
    (addon.data.paperAgentUICleanups ||= new Set()).add(cleanup);
    win.addEventListener("unload", cleanup, { once: true });
    scheduleResize();
    paperAgentDrainQuotes(chatUI);
  }
