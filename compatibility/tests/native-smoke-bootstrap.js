async function startup() {
  const profile = Services.dirsvc.get("ProfD", Components.interfaces.nsIFile).path;
  if (profile !== __PROFILE__) return;
  const result = { profile, checks: [] };
  const check = (name, ok) => {
    result.checks.push({ name, passed: !!ok });
    if (!ok) throw new Error(name);
  };
  const waitUntil = async predicate => {
    const until = Date.now() + 30000;
    while (!predicate()) {
      if (Date.now() > until) throw new Error("Timed out waiting for plugin");
      await Zotero.Promise.delay(200);
    }
  };
  try {
    await Promise.all([Zotero.initializationPromise, Zotero.unlockPromise, Zotero.uiReadyPromise]);
    check("isolated data directory", Zotero.DataDirectory.dir === __DATA__);
    result.zoteroVersion = Zotero.version;
    await waitUntil(() => Zotero.ZoteroPaperAgent?.data.initialized);
    const addon = Zotero.ZoteroPaperAgent;
    check("patched plugin started", addon.data.alive);
    const options = Zotero.ItemPaneManager.customSectionData.options.find(option => option.paneID === addon.data.paperAgentPaneID);
    check("sidepane registered", !!options);
    await addon.data.zoteroPaperAgentApi.recoverChatSessionCache();
    const item = await Zotero.Attachments.linkFromFile({ file: __FIXTURE__ });
    check("linked PDF resolves", await item.getFilePathAsync() === __FIXTURE__);
    const win = Zotero.getMainWindow();
    const body = win.document.createElementNS("http://www.w3.org/1999/xhtml", "div");
    body.appendChild(win.MozXULElement.parseXULToFragment(options.bodyXHTML));
    win.document.documentElement.appendChild(body);
    options.onItemChange({ body, item });
    await options.onAsyncRender({ body, item });
    await Zotero.Promise.delay(200);
    const chat = body.querySelector("#zotero-paper-agent-chat-ui");
    check("native HTML sidepane mounted", chat?.namespaceURI === "http://www.w3.org/1999/xhtml" && chat.dataset.paperAgentMounted === "true");
    await waitUntil(() => !!chat.dataset.paperAgentChatId && !chat._paperAgentNewChat);
    await Zotero.Promise.delay(100);
    check("first display measures available viewport height", Math.abs(parseFloat(chat.style.height) - Math.max(300, win.innerHeight - Math.max(0, chat.getBoundingClientRect().top) - 24)) < 2);
    const firstAutoChat = addon.data.zoteroPaperAgentApi.chatID;
    check("opening panel creates a new empty local conversation", !!firstAutoChat && addon.data.zoteroPaperAgentApi.historyManager.getMessageListByChatSessionID(firstAutoChat).length === 0);
    const input = chat.querySelector("textarea");
    check("chat input exists", !!input);
    input.value = "Unsent test question";
    await options.onAsyncRender({ body, item });
    check("repeat render does not create another conversation", addon.data.zoteroPaperAgentApi.chatID === firstAutoChat);
    const sessionsBeforeReopen = Object.keys(addon.data.zoteroPaperAgentApi.historyManager.chatSessionMap).length;
    options.onToggle({ body, item, event: {target:{open:false}} });
    options.onToggle({ body, item, event: {target:{open:true}} });
    options.onToggle({ body, item, event: {target:{open:true}} });
    await waitUntil(() => !chat._paperAgentNewChat);
    check("reopening creates exactly one fresh conversation", addon.data.zoteroPaperAgentApi.chatID !== firstAutoChat && Object.keys(addon.data.zoteroPaperAgentApi.historyManager.chatSessionMap).length === sessionsBeforeReopen + 1);
    check("old conversation remains in history", !!addon.data.zoteroPaperAgentApi.historyManager.getChatSessionItemByID(firstAutoChat));
    check("repeat render preserves draft", input.value === "Unsent test question" && input.isConnected);
    const realAPI = addon.data.zoteroPaperAgentApi;
    const fixture = new win.File([await IOUtils.read(__FIXTURE__)], "fixture.pdf", { type: "application/pdf" });
    const local = await realAPI.uploadFile(fixture, __FIXTURE__);
    check("real local PDF worker extraction", !local.error && realAPI.fileManager.getFileItemByID(local.fileID).file_text_content.includes("Synthetic literature methods passage."));
    check("local PDF is included in conversation references", realAPI.refs.includes(local.fileID));
    const picked = await realAPI.uploadFile(fixture, "");
    check("picker PDF without mozFullPath extracts locally", !picked.error && realAPI.fileManager.getFileItemByID(picked.fileID).file_text_content.includes("Synthetic literature"));
    check("seven built-in reading prompts seeded", realAPI.promptManager.getPrompts().filter(p => p.prompt_id.startsWith("paper-agent-reading-v1-")).length === 7);
    chat.querySelector("#zotero-paper-agent-prompt-button").click();
    await Zotero.Promise.delay(100);
    const promptPanel = chat.querySelector("#zotero-paper-agent-select-prompt-dialog");
    check("prompt chooser has search and dialog semantics", !!promptPanel.querySelector("input[type=search]") && promptPanel.getAttribute("role") === "dialog");
    const search = promptPanel.querySelector("input[type=search]");
    search.value = "段落"; search.dispatchEvent(new win.Event("input"));
    const shown = [...promptPanel.querySelectorAll("[data-pa-selectable]")].filter(row => !row.hidden);
    check("prompt search filters full names", shown.length === 1 && shown[0].dataset.promptName === "段落精读");
    body.style.cssText = "position:fixed;top:60px;left:0;width:260px;";
    await Zotero.Promise.delay(100);
    result.dialogMetrics = {width:promptPanel.getBoundingClientRect().width, chat:chat.clientWidth, scroll:promptPanel.scrollWidth, client:promptPanel.clientWidth, rect:promptPanel.getBoundingClientRect().toJSON(), style:win.getComputedStyle(promptPanel).cssText, left:win.getComputedStyle(promptPanel).left, right:win.getComputedStyle(promptPanel).right, children:[...promptPanel.children].map(el=>({class:el.className,rect:el.getBoundingClientRect().toJSON(),margin:win.getComputedStyle(el).margin,width:el.getBoundingClientRect().width,scroll:el.scrollWidth}))};
    check("prompt chooser fits narrow sidebar", promptPanel.getBoundingClientRect().width <= chat.clientWidth && promptPanel.scrollWidth <= promptPanel.clientWidth + 1);
    shown[0].querySelector(".zotero-paper-agent-dialog-list-item-main-container").dispatchEvent(new win.KeyboardEvent("keydown", {key:"Enter", bubbles:true}));
    await Zotero.Promise.delay(100);
    check("keyboard prompt selection applies built-in", realAPI.promptID === shown[0].dataset.promptID && !promptPanel.isConnected);
    let promptRequest;
    const originalLLM = realAPI.llm;
    realAPI.chatID = "prompt-test";
    realAPI.llm = { completion: async request => { promptRequest = request; return {}; } };
    const originalHistory = realAPI.historyManager.getChatHistoryForNextChat;
    realAPI.historyManager.getChatHistoryForNextChat = () => [];
    await realAPI.completion({query:"解释这段话"});
    realAPI.historyManager.getChatHistoryForNextChat = originalHistory;
    realAPI.llm = originalLLM;
    check("built-in system prompt and local PDF references reach LLM request", promptRequest.systemPrompt.includes("不编造") && promptRequest.query.includes("段落精读") && promptRequest.refs.includes(local.fileID));
    chat.querySelector("#zotero-paper-agent-setting-button").click();
    await Zotero.Promise.delay(100);
    const settings = chat.querySelector("#zotero-paper-agent-setting-dialog");
    [...settings.querySelectorAll(".zotero-paper-agent-dialog-list-item")].find(row => row.textContent.includes("PDF 解析设置")).click();
    await Zotero.Promise.delay(100);
    const pdfSettings = [...chat.querySelectorAll(".zotero-paper-agent-dialog")].at(-1);
    check("nested PDF settings show local and OCR choices", settings.hidden && pdfSettings.querySelector("select").options.length === 2 && pdfSettings.querySelector("input").type === "password");
    pdfSettings.dispatchEvent(new win.KeyboardEvent("keydown", {key:"Escape", bubbles:true}));
    await Zotero.Promise.delay(100);
    check("Escape restores parent settings panel", !settings.hidden && !pdfSettings.isConnected);
    settings.querySelector(".zotero-paper-agent-dialog-bottom-button-cancel").click();
    await Zotero.Promise.delay(100);
    check("closing dialogs restores composer interactions", !input.closest("[inert]"));
    let uploaded;
    addon.data.zoteroPaperAgentApi.uploadFile = async (file, filePath) => {
      uploaded = { filePath, name: file.name, bytes: file.size };
      return { fileID: "fixture-test" };
    };
    chat.querySelector("#zotero-paper-agent-send-pdf-button").click();
    await waitUntil(() => !!uploaded);
    check("linked PDF read and passed to mock service", uploaded.filePath === __FIXTURE__ && uploaded.name === "fixture.pdf" && uploaded.bytes > 0);
    result.uploaded = uploaded;
    body.style.display = "none";
    await Zotero.Promise.delay(100);
    chat.style.height = "120px";
    body.style.display = "block";
    await Zotero.Promise.delay(150);
    check("hidden then visible panel recovers height without manual resize", parseFloat(chat.style.height) >= 300);

    body.style.cssText = "position:fixed;top:60px;left:0;width:260px;";
    await Zotero.Promise.delay(150);
    check("narrow sidebar follows parent width", Math.abs(chat.getBoundingClientRect().width - 260) < 2 && chat.scrollWidth <= chat.clientWidth + 1);
    body.style.width = "600px";
    await Zotero.Promise.delay(150);
    check("wide sidebar follows parent width", Math.abs(chat.getBoundingClientRect().width - 600) < 2);
    const listener = Zotero.Reader._registeredListeners.find(entry => entry.pluginID === "zoteropaperagent@github.com" && entry.type === "renderTextSelectionPopup");
    check("selection popup listener registered", !!listener);
    for (const other of win.document.querySelectorAll("#zotero-paper-agent-chat-ui")) { if (other !== chat) other.style.display = "none"; }
    let quoteButton;
    listener.handler({ reader: { _window: win, itemID: item.id }, doc: win.document,
      params: { annotation: { text: "Selected PDF passage\n第二行原文", pageLabel: "7" } }, append: button => { quoteButton = button; } });
    quoteButton.click();
    result.quoteValue = input.value;
    result.quoteButton = quoteButton.textContent;
    check("quote preserves draft and adds full text and page", input.value.includes("Unsent test question") && input.value.includes("Selected PDF passage") && input.value.includes("第二行原文") && input.value.includes("第 7 页"));
    let sentQuery;
    const api = addon.data.zoteroPaperAgentApi;
    api.chatID = "quote-test";
    api.llmGroupName = "openai";
    api.historyManager.getChatSessionItemByID = () => ({ model_group_name: "openai" });
    api.completion = async ({ query }) => { sentQuery = query; return { error: "mock response: no external request" }; };
    chat.querySelector("#zotero-paper-agent-send-message-button").click();
    await waitUntil(() => !!sentQuery);
    check("LLM request includes quote and question", sentQuery.includes("Selected PDF passage") && sentQuery.includes("Unsent test question") && sentQuery.includes("第 7 页"));
    await waitUntil(() => chat.querySelector("#zotero-paper-agent-send-message-button").style.display !== "none");
    await api.createChatSession();
    const markdownChatID = api.chatID;
    const markdownAnswer = '# 研究结论\n\n**主要证据**和 *推断*。\n\n- 第一项\n  - 子项\n\n> 引用原文\n\n| 方法 | 结果 |\n| --- | --- |\n| A | 42 |\n\n```python\nprint("<safe>")\n```\n\n[原文](https://example.com)' + "\n\n行内 $E=mc^2$ 和 \\(\\alpha+\\beta\\)。\n\n$$\n\\int_0^1 x^2\\,dx=\\frac{1}{3}\n$$\n\n\\[\n\\begin{pmatrix}a & b \\\\ c & d\\end{pmatrix}\n\\]\n\n`$literal$` 与 $\\unknowncommand{x}$。\n" + "\n\n\\[\\sum_{i=1}^{n} x_i^2 = a_{1}b_{1} + a_{2}b_{2} + a_{3}b_{3} + a_{4}b_{4} + a_{5}b_{5} + a_{6}b_{6} + a_{7}b_{7} + a_{8}b_{8} + a_{9}b_{9} + a_{10}b_{10} + a_{11}b_{11}\\]";
    api.completion = async ({streamCallback}) => {
      for (let i=0; i<markdownAnswer.length; i+=11) streamCallback({type:"content",content:markdownAnswer.slice(i,i+11)});
      return {userRefs:[]};
    };
    input.value = "Markdown rendering test";
    chat.querySelector("#zotero-paper-agent-send-message-button").click();
    await waitUntil(() => api.historyManager.getMessageListByChatSessionID(markdownChatID).length === 2);
    const answerNodes = () => [...chat.querySelectorAll(".zotero-paper-agent-message-item-text-item-content #zotero-paper-agent-message-item-text-item-text-container")];
    let markdownNode = answerNodes().find(node => node.querySelector("h1"));
    check("streamed Markdown renders headings emphasis lists quotes tables code and links", !!markdownNode && ["strong","em","ul ul","blockquote",".paper-agent-markdown-table table","pre code.language-python","a"].every(selector=>markdownNode.querySelector(selector)));
    check("streamed formulas render all four TeX delimiter forms", markdownNode.querySelectorAll(".paper-agent-math .katex").length === 5);
    check("formula renderer preserves accessible MathML and original TeX", markdownNode.querySelectorAll("math").length === 5 && markdownNode.querySelector('annotation[encoding="application/x-tex"]').textContent === "E=mc^2");
    check("invalid TeX falls back to original source", markdownNode.querySelector(".paper-agent-math-source")?.textContent.includes("unknowncommand"));
    check("formula fonts are loaded from packaged offline resources", await win.document.fonts.load('16px KaTeX_Main').then(fonts=>fonts.length>0));
    check("Markdown code is preserved as text", markdownNode.querySelector("pre code").textContent.includes('<safe>') && !markdownNode.querySelector("safe"));
    api.fullMessageListByChatSessionID(chat, markdownChatID);
    markdownNode = answerNodes().find(node => node.querySelector("h1"));
    check("restored history uses the same Markdown renderer", !!markdownNode?.querySelector(".paper-agent-markdown-table") && !!markdownNode.querySelector("pre code"));
    check("history restores rendered formulas", markdownNode.querySelectorAll(".paper-agent-math .katex").length === 5);
    body.style.width = "260px";
    await Zotero.Promise.delay(150);
    const displays = [...markdownNode.querySelectorAll(".paper-agent-math-display")];
    check("long display formulas scroll within the narrow answer", displays.every(node=>node.clientWidth<=markdownNode.clientWidth) && displays.some(node=>node.scrollWidth>node.clientWidth));
    check("Markdown table stays within narrow answer", markdownNode.querySelector(".paper-agent-markdown-table").clientWidth <= markdownNode.clientWidth && chat.scrollWidth <= chat.clientWidth + 1);
    // Actual Zotero chrome theme variables, without injecting mock text colors.
    const rgb = value => value.match(/[\d.]+/g).map(Number);
    const composite = (fg, bg) => fg.slice(0, 3).map((value, i) => value * (fg[3] ?? 1) + bg[i] * (1 - (fg[3] ?? 1)));
    const luminance = color => color.map(value => { value /= 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
    const contrast = (fg, bg) => { const a = luminance(composite(rgb(fg), rgb(bg))), b = luminance(rgb(bg)); return (Math.max(a,b)+.05)/(Math.min(a,b)+.05); };
    result.themeChecks = [];
    for (const dark of [true, false]) {
      Services.prefs.setIntPref("ui.systemUsesDarkTheme", dark ? 1 : 0);
      await Zotero.Promise.delay(400);
      check(`${dark ? "dark" : "light"} native theme applied`, win.matchMedia("(prefers-color-scheme: dark)").matches === dark);
      const styles = win.getComputedStyle(chat);
      const background = styles.backgroundColor;
      const button = chat.querySelector("#zotero-paper-agent-history-button");
      const buttonStyles = win.getComputedStyle(button);
      const inputStyles = win.getComputedStyle(input);
      const placeholder = win.getComputedStyle(input, "::placeholder");
      const hint = win.getComputedStyle(chat.querySelector(".paper-agent-composer-hint"));
      const values = { dark, background, foreground: styles.color,
        root: contrast(styles.color, background), button: contrast(buttonStyles.color, buttonStyles.backgroundColor),
        input: contrast(inputStyles.color, inputStyles.backgroundColor),
        placeholder: contrast(placeholder.color, inputStyles.backgroundColor), hint: contrast(hint.color, background) };
      result.themeChecks.push(values);
      const mathStyle = win.getComputedStyle(markdownNode.querySelector(".paper-agent-math"));
      check(`${dark ? "dark" : "light"} formulas inherit readable theme text`, contrast(mathStyle.color, background) >= 4.5);
      const codeStyle = win.getComputedStyle(markdownNode.querySelector("pre code"));
      const preStyle = win.getComputedStyle(markdownNode.querySelector("pre"));
      const linkStyle = win.getComputedStyle(markdownNode.querySelector("a"));
      check(`${dark ? "dark" : "light"} Markdown code and links have readable contrast`, contrast(codeStyle.color, preStyle.backgroundColor) >= 4.5 && contrast(linkStyle.color, background) >= 4.5);
      check(`${dark ? "dark" : "light"} text controls and hints have readable contrast`, [values.root, values.button, values.input, values.placeholder, values.hint].every(value => value >= 4.5));
    }
    // Synthetic streams only: no provider request and no personal document.
    await api.createChatSession();
    const performanceChatID = api.chatID;
    const longAnswer = Array.from({length:40}, (_, i) => `### 推导 ${i+1}\n\n研究段落：给出推导依据和限制。 $E_${i}=mc^2$\n\n$$\\int_0^1 x^{${i+1}}\\,dx=\\frac{1}{${i+2}}$$\n\n`).join("");
    let burstTime;
    api.completion = async ({streamCallback}) => {
      const started = win.performance.now();
      for(let i=0;i<longAnswer.length;i+=11) streamCallback({type:"content",content:longAnswer.slice(i,i+11)});
      burstTime = win.performance.now()-started;
      return {userRefs:[]};
    };
    input.value = "Synthetic streaming performance test";
    const started = win.performance.now();
    chat.querySelector("#zotero-paper-agent-send-message-button").click();
    await waitUntil(() => api.historyManager.getMessageListByChatSessionID(performanceChatID).length === 2);
    const longNode=answerNodes().find(node=>node.textContent.includes("推导 40"));
    result.streamingPerformance={characters:longAnswer.length,chunks:Math.ceil(longAnswer.length/11),callbackMs:burstTime,completionObservedMs:win.performance.now()-started};
    check("long burst stream flushes all 80 formulas before history persistence", longNode.querySelectorAll(".katex").length === 80 && api.historyManager.getMessageListByChatSessionID(performanceChatID)[1].content === longAnswer);
    const finalHTML=longNode.innerHTML;
    await Zotero.Promise.delay(350);
    check("completion cancels delayed stream writes",longNode.innerHTML===finalHTML);
    await api.createChatSession();
    const incrementalID=api.chatID;
    let savedHeading,savedMath,incrementalNode;
    const scroller=chat.querySelector("#zotero-paper-agent-message-container");
    api.completion=async({streamCallback})=>{
      streamCallback({type:"content",content:"# Stable heading\n\n$x^2$\n\n"});
      await Zotero.Promise.delay(150);
      incrementalNode=answerNodes().find(node=>node.querySelector("h1")?.textContent === "Stable heading");
      savedHeading=incrementalNode.querySelector("h1"); savedMath=incrementalNode.querySelector(".katex");
      for(let i=0;i<10;i++) {
        streamCallback({type:"content",content:`Paragraph ${i}. `.repeat(50)+"\n\n"});
        await Zotero.Promise.delay(120);
      }
      scroller.scrollTop=0;
      streamCallback({type:"reasoning_content",content:"Late reasoning must not erase the answer"});
      streamCallback({type:"content",content:"Final paragraph."});
      await Zotero.Promise.delay(150);
      check("stream does not pull reader back to bottom",scroller.scrollTop === 0);
      return {userRefs:[]};
    };
    input.value="Incremental streaming DOM test";
    chat.querySelector("#zotero-paper-agent-send-message-button").click();
    await waitUntil(()=>api.historyManager.getMessageListByChatSessionID(incrementalID).length===2);
    check("stream retains completed heading and formula DOM",incrementalNode.querySelector("h1")===savedHeading && incrementalNode.querySelector(".katex")===savedMath);
    check("late reasoning preserves streamed answer",incrementalNode.textContent.includes("Final paragraph."));
    body.remove();
    await addon.hooks.onShutdown();
    check("sidepane unregistered on shutdown", !Zotero.ItemPaneManager.customSectionData.options.some(option => option.paneID === options.paneID));
    check("selection listener removed on shutdown", !Zotero.Reader._registeredListeners.some(entry => entry.pluginID === "zoteropaperagent@github.com"));
    check("resize handlers released", addon.data.paperAgentUICleanups.size === 0);
    result.passed = true;
  } catch (error) {
    result.error = String(error) + "\n" + (error.stack || "");
    result.passed = false;
  } finally {
    await IOUtils.writeJSON(__RESULT__, result);
    Services.startup.quit(Components.interfaces.nsIAppStartup.eForceQuit);
  }
}
function install() {}
function shutdown() {}
function uninstall() {}
