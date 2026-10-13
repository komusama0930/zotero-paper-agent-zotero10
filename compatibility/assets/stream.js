// SPDX-License-Identifier: AGPL-3.0-or-later
// Unofficial modifications by komusama0930, 2026-10-13; see NOTICE.
  // Parse the entire document for correct references/lists, but retain unchanged block DOM.
  function paperAgentMarkdownBlocks(source) {
    const env = { paperAgentKeywords: [] };
    const tokens = md.parse(source, env);
    const blocks = [];
    let start = 0, depth = 0;
    for (let i = 0; i < tokens.length; i++) {
      depth += tokens[i].nesting;
      if (depth === 0) {
        blocks.push(md.renderer.render(tokens.slice(start, i + 1), md.options, env));
        start = i + 1;
      }
    }
    return blocks;
  }
  function paperAgentCreateStreamRenderer(answer, thinking, thinkingPanel, scroller) {
    const win = answer.ownerDocument.defaultView;
    let timer = null, closed = false, contentDirty = false, thinkingDirty = false;
    let blocks = [], duration = 0;
    const flush = () => {
      if (timer !== null) { win.clearTimeout(timer); timer = null; }
      if (closed || (!contentDirty && !thinkingDirty)) return;
      if (!answer.isConnected) { dispose(); return; }
      const started = win.performance.now();
      const follow = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80;
      if (contentDirty) {
        const source = answer.dataset.originalMessage;
        try {
          const next = paperAgentMarkdownBlocks(source);
          // Initial loading placeholder is not part of the block list.
          if (!blocks.length) answer.replaceChildren();
          for (let i = 0; i < next.length; i++) {
            if (blocks[i]?.html === next[i]) continue;
            const node = answer.ownerDocument.createElementNS("http://www.w3.org/1999/xhtml", "div");
            node.className = "paper-agent-stream-block";
            node.style.display = "contents";
            node.innerHTML = next[i];
            if (blocks[i]) blocks[i].node.replaceWith(node);
            else answer.appendChild(node);
            blocks[i] = { html: next[i], node };
          }
          for (let i = next.length; i < blocks.length; i++) blocks[i].node.remove();
          blocks.length = next.length;
        } catch (_) { answer.textContent = source; blocks = []; }
        contentDirty = false;
      }
      if (thinkingDirty) {
        thinkingPanel.style.display = "block";
        if (!answer.dataset.originalMessage && !blocks.length) answer.replaceChildren();
        const thinkingFollow = thinking.scrollHeight - thinking.scrollTop - thinking.clientHeight < 80;
        thinking.textContent = thinking.dataset.originalMessage;
        if (thinkingFollow) thinking.scrollTop = thinking.scrollHeight;
        thinkingDirty = false;
      }
      if (follow) scroller.scrollTop = scroller.scrollHeight;
      duration = win.performance.now() - started;
    };
    const push = response => {
      if (closed) return;
      if (response.type === "content") {
        answer.dataset.originalMessage += response.content;
        contentDirty = true;
      } else if (response.type === "reasoning_content") {
        thinking.dataset.originalMessage += response.content;
        thinkingDirty = true;
      } else return;
      // Keep a bounded refresh rate; expensive answers receive more time between paints.
      if (timer === null) timer = win.setTimeout(flush, Math.min(250, Math.max(100, duration * 2)));
    };
    const dispose = () => {
      if (timer !== null) win.clearTimeout(timer);
      timer = null; closed = true; blocks = [];
      win.removeEventListener("unload", dispose);
      addon.data.paperAgentUICleanups?.delete(dispose);
    };
    (addon.data.paperAgentUICleanups ||= new Set()).add(dispose);
    win.addEventListener("unload", dispose, { once: true });
    return { push, finish() { flush(); dispose(); }, dispose };
  }
