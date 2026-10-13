// SPDX-License-Identifier: AGPL-3.0-or-later
// Unofficial modifications maintained by komusama0930; 2026-10-13. See NOTICE.
  function paperAgentEnhanceDialogs(chatUI) {
    const win = chatUI.ownerDocument.defaultView;
    let active = null;
    let previousFocus = null;
    const decorate = panel => {
      const list = panel.querySelector(`.${PLUGIN_PREFIX}dialog-list-container`);
      if (!list) return;
      for (const row of list.children) {
        const name = row.dataset.modelDisplayName || row.dataset.promptName;
        if (!name) continue;
        const title = row.querySelector(`.${PLUGIN_PREFIX}dialog-list-item-title`);
        if (title.textContent !== name) title.textContent = name;
        row.hidden = !!panel._search && !name.toLocaleLowerCase().includes(panel._search.value.toLocaleLowerCase());
        if (row.dataset.paSelectable) continue;
        row.dataset.paSelectable = "true";
        const main = row.querySelector(`.${PLUGIN_PREFIX}dialog-list-item-main-container`);
        main.tabIndex = 0; main.setAttribute("role", "button"); main.setAttribute("aria-label", name);
        main.addEventListener("keydown", e => {
          if (e.target !== main) return;
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); row.click(); }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const choices = [...list.children].filter(r => !r.hidden && r.dataset.paSelectable).map(r => r.querySelector(`.${PLUGIN_PREFIX}dialog-list-item-main-container`));
            choices[(choices.indexOf(main) + (e.key === "ArrowDown" ? 1 : choices.length - 1)) % choices.length]?.focus();
          }
        });
      }
    };
    const refresh = () => {
      const panels = [...chatUI.querySelectorAll(`.${PLUGIN_PREFIX}dialog, #${PLUGIN_PREFIX}history-container`)];
      const top = panels.at(-1) || null;
      if (top && !active) previousFocus = chatUI.ownerDocument.activeElement;
      for (const child of chatUI.children) child.inert = !!top && child !== top && child.id !== `${PLUGIN_PREFIX}mask`;
      for (const panel of panels) {
        panel.hidden = panel !== top;
        if (!panel.dataset.paEnhanced) {
          panel.dataset.paEnhanced = "true";
          panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true");
          if (panel.id === `${PLUGIN_PREFIX}history-container`) { panel.setAttribute("aria-label", "历史对话"); continue; }
          panel.setAttribute("aria-label", panel.querySelector(`.${PLUGIN_PREFIX}dialog-title-container`)?.textContent || "设置");
          const cancel = panel.querySelector(`.${PLUGIN_PREFIX}dialog-bottom-button-cancel`);
          const confirm = panel.querySelector(`.${PLUGIN_PREFIX}dialog-bottom-button-confirm`);
          if (cancel) cancel.textContent = "取消";
          if (confirm) confirm.textContent = "确定";
          const close = panel.ownerDocument.createElement("button");
          close.textContent = "×"; close.setAttribute("aria-label", "关闭面板"); close.addEventListener("click", () => cancel?.click());
          panel.querySelector(`.${PLUGIN_PREFIX}dialog-header-container`).appendChild(close);
          if (/select-(model|prompt)-dialog$/.test(panel.id)) {
            const search = panel.ownerDocument.createElement("input");
            search.type = "search"; search.placeholder = "搜索名称…"; search.setAttribute("aria-label", "搜索模型或提示词"); search.className = "paper-agent-dialog-search";
            panel._search = search; panel.insertBefore(search, panel.querySelector(`.${PLUGIN_PREFIX}dialog-list-container`));
            search.addEventListener("input", () => decorate(panel));
          }
        }
        decorate(panel);
      }
      if (top !== active) {
        active = top;
        if (top) (top._search || top.querySelector("input,textarea,select,button"))?.focus();
        else { chatUI.querySelectorAll(`#${PLUGIN_PREFIX}mask`).forEach(mask => mask.remove()); previousFocus?.isConnected && previousFocus.focus(); }
      }
    };
    const keydown = e => {
      if (!active) return;
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); active.querySelector(`.${PLUGIN_PREFIX}dialog-bottom-button-cancel, #${PLUGIN_PREFIX}history-container-button-close`)?.click(); }
      if (e.key === "Tab") {
        const controls = [...active.querySelectorAll('button,input,textarea,select,[tabindex="0"]')].filter(el => !el.disabled && el.getClientRects().length);
        const first = controls[0], last = controls.at(-1);
        if (e.shiftKey && chatUI.ownerDocument.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && chatUI.ownerDocument.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    const observer = new win.MutationObserver(refresh);
    observer.observe(chatUI, { childList: true, subtree: true });
    chatUI.addEventListener("keydown", keydown);
    const cleanup = () => { observer.disconnect(); chatUI.removeEventListener("keydown", keydown); win.removeEventListener("unload", cleanup); addon.data.paperAgentUICleanups?.delete(cleanup); };
    (addon.data.paperAgentUICleanups ||= new Set()).add(cleanup);
    win.addEventListener("unload", cleanup, { once: true });
  }
