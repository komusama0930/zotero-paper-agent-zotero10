// SPDX-License-Identifier: AGPL-3.0-or-later
// Unofficial modifications by komusama0930, 2026-10-13; see NOTICE.
  function paperAgentRegisterMath(markdown) {
    // Bound both entry count and retained HTML; never retain whole conversations.
    const cache = new Map();
    let cacheSize = 0;
    const remember = (key, html) => {
      const size = key.length + html.length;
      if (size > 2 * 1024 * 1024) return;
      while (cache.size >= 256 || cacheSize + size > 2 * 1024 * 1024) {
        const oldest = cache.keys().next().value;
        cacheSize -= oldest.length + cache.get(oldest).length;
        cache.delete(oldest);
      }
      cache.set(key, html); cacheSize += size;
    };
    const escaped = (source, position) => {
      let count = 0;
      while (position > 0 && source[--position] === "\\") count++;
      return count % 2 === 1;
    };
    const delimiters = [["$$", "$$", true], ["\\[", "\\]", true], ["\\(", "\\)", false], ["$", "$", false]];
    const findClose = (source, closing, from, max, singleDollar) => {
      for (let pos = source.indexOf(closing, from); pos >= 0 && pos < max; pos = source.indexOf(closing, pos + closing.length)) {
        if (escaped(source, pos)) continue;
        if (singleDollar && (/\s/.test(source[pos - 1] || " ") || /\d/.test(source[pos + 1] || "") || source[pos + 1] === "$")) continue;
        return pos;
      }
      return -1;
    };
    markdown.inline.ruler.before("escape", "paper_agent_math", (state, silent) => {
      const start = state.pos;
      const delimiter = delimiters.find(([opening]) => state.src.startsWith(opening, start));
      if (!delimiter) return false;
      const [opening, closing, display] = delimiter;
      const from = start + opening.length;
      const single = opening === "$";
      if (single && /\s/.test(state.src[from] || " ")) return false;
      const end = findClose(state.src, closing, from, state.posMax, single);
      if (end < 0 || end === from || (single && state.src.slice(from, end).includes("\n"))) return false;
      if (!silent) {
        const token = state.push("paper_agent_math", "", 0);
        token.content = state.src.slice(from, end);
        token.meta = { display, opening, closing };
      }
      state.pos = end + closing.length;
      return true;
    });
    markdown.block.ruler.before("fence", "paper_agent_math_block", (state, startLine, endLine, silent) => {
      if (state.sCount[startLine] - state.blkIndent >= 4) return false;
      const start = state.bMarks[startLine] + state.tShift[startLine];
      const delimiter = delimiters.slice(0, 2).find(([opening]) => state.src.startsWith(opening, start));
      if (!delimiter) return false;
      const [opening, closing] = delimiter;
      const limit = state.eMarks[endLine - 1];
      const end = findClose(state.src, closing, start + opening.length, limit, false);
      if (end < 0) return false;
      let closingLine = startLine;
      while (closingLine < endLine && state.eMarks[closingLine] < end + closing.length) closingLine++;
      if (closingLine >= endLine || state.src.slice(end + closing.length, state.eMarks[closingLine]).trim()) return false;
      if (silent) return true;
      const token = state.push("paper_agent_math", "", 0);
      token.block = true;
      token.content = state.src.slice(start + opening.length, end).trim();
      token.meta = { display: true, opening, closing };
      token.map = [startLine, closingLine + 1];
      state.line = closingLine + 1;
      return true;
    }, { alt: ["paragraph", "reference", "blockquote", "list"] });
    markdown.renderer.rules.paper_agent_math = (tokens, index) => {
      const token = tokens[index];
      const { display, opening, closing } = token.meta;
      const tag = token.block ? "div" : "span";
      const kind = display ? "paper-agent-math-display" : "paper-agent-math-inline";
      const key = JSON.stringify([token.block, display, opening, closing, token.content]);
      if (cache.has(key)) {
        const html = cache.get(key);
        cache.delete(key); cache.set(key, html);
        return html;
      }
      let result;
      try {
        if (token.content.length > 20000) throw new Error("Formula too long");
        const html = paperAgentKaTeX.renderToString(token.content, { displayMode: display, throwOnError: true, trust: false, strict: "ignore", maxExpand: 1000, maxSize: 10, output: "htmlAndMathml" });
        result = `<${tag} class="paper-agent-math ${kind}">${html}</${tag}>`;
      } catch (_) {
        result = `<${tag} class="paper-agent-math-source ${kind}" title="公式未能解析，保留原文">${markdown.utils.escapeHtml(opening + token.content + closing)}</${tag}>`;
      }
      remember(key, result);
      return result;
    };
    // Highlight text tokens only, so search cannot change MathML or formula layout.
    markdown.renderer.rules.text = (tokens, index, options, env) => {
      const content = tokens[index].content;
      const keywords = env?.paperAgentKeywords || [];
      if (!keywords.length) return markdown.utils.escapeHtml(content);
      const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(keywords.map(escapeRegExp).join("|"), "gi");
      let result = "", last = 0;
      for (const match of content.matchAll(regex)) {
        result += markdown.utils.escapeHtml(content.slice(last, match.index)) + '<span class="keyword-highlight">' + markdown.utils.escapeHtml(match[0]) + '</span>';
        last = match.index + match[0].length;
      }
      return result + markdown.utils.escapeHtml(content.slice(last));
    };
  }
