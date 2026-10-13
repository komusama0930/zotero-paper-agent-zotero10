// SPDX-License-Identifier: AGPL-3.0-or-later
// Unofficial modifications maintained by komusama0930; 2026-10-13. See NOTICE.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { File } = require('node:buffer');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const script = fs.readFileSync(path.join(root, 'compatibility/patched/content/scripts/zoteropaperagent.js'), 'utf8');
const prefix = 'zotero-paper-agent-';
function segment(start, end) {
  return script.slice(script.indexOf(start), script.indexOf(end, script.indexOf(start)));
}
function context(extra = {}) {
  return vm.createContext({ console: { log() {} }, File, ...extra });
}
function pdfItem(id, filePath) {
  return { id, isAttachment: () => true, attachmentContentType: 'application/pdf', getFilePathAsync: async () => filePath };
}
function pdfContext(items, extra = {}) {
  const ctx = context({
    Zotero: { Items: { getAsync: async id => items.get(id) }, Reader: { getByTabID: () => null } },
    ztoolkit: { getGlobal: () => ({ selectedID: 'library' }) },
    IOUtils: { read: async () => new Uint8Array([37, 80, 68, 70]) },
    PathUtils: { filename: value => value.split(/[\\/]/).pop() },
    ...extra
  });
  vm.runInContext(segment('  async function getCurrentTabItemPDFPath(', '  function checkChatWindowSizeSetting('), ctx);
  return ctx;
}

test('stored and linked PDF paths preserve Unicode, spaces and colons', async () => {
  const paths = ['/tmp/storage/A123/论文.pdf', '/Volumes/Papers/review: final 2026.pdf', 'D:\\研究文献\\paper.pdf'];
  const items = new Map(paths.map((value, i) => [i + 1, pdfItem(i + 1, value)]));
  const ctx = pdfContext(items);
  for (let i = 0; i < paths.length; i++) {
    assert.equal(await ctx.getCurrentTabItemPDFPath({ dataset: { paperAgentAttachmentId: String(i + 1) } }), paths[i]);
  }
});

test('sidebar item takes precedence over a different selected main-window tab', async () => {
  const ctx = pdfContext(new Map([[1, pdfItem(1, '/tmp/one.pdf')], [2, pdfItem(2, '/tmp/two.pdf')]]));
  ctx.Zotero.Reader.getByTabID = () => ({ itemID: 2 });
  assert.equal(await ctx.getCurrentTabItemPDFPath({ dataset: { paperAgentAttachmentId: '1' } }), '/tmp/one.pdf');
});

test('fallback uses the sidebar window reader rather than another window', async () => {
  const ctx = pdfContext(new Map([[1, pdfItem(1, '/tmp/one.pdf')], [2, pdfItem(2, '/tmp/two.pdf')]]));
  ctx.Zotero.Reader.getByTabID = tabID => ({ itemID: tabID === 'local' ? 1 : 2 });
  const chatUI = { dataset: {}, ownerDocument: { defaultView: { Zotero_Tabs: { selectedID: 'local' } } } };
  assert.equal(await ctx.getCurrentTabItemPDFPath(chatUI), '/tmp/one.pdf');
});

test('missing file, no reader and non-PDF attachment produce actionable errors', async () => {
  const items = new Map([[1, pdfItem(1, false)], [2, { ...pdfItem(2, '/tmp/image.png'), attachmentContentType: 'image/png' }]]);
  const ctx = pdfContext(items);
  await assert.rejects(ctx.getCurrentTabItemPDFPath({ dataset: { paperAgentAttachmentId: '1' } }), /missing/);
  await assert.rejects(ctx.getCurrentTabItemPDFPath({ dataset: { paperAgentAttachmentId: '2' } }), /open a PDF/);
  await assert.rejects(ctx.getCurrentTabItemPDFPath({ dataset: {} }), /open a PDF/);
});

function uploadFixture(upload, read = async () => new Uint8Array([37, 80, 68, 70])) {
  const messages = [], errors = [], rows = [];
  let click;
  const button = { disabled: false, addEventListener: (type, handler) => { click = handler; } };
  const files = { ownerDocument: {}, appendChild: row => rows.push(row) };
  const chatUI = { dataset: { paperAgentAttachmentId: '1' }, querySelector: selector => selector.endsWith('send-pdf-button') ? button : files };
  class ProgressWindow {
    createLine(line) { messages.push(line); return this; }
    show() { return this; }
  }
  const ctx = pdfContext(new Map([[1, pdfItem(1, '/tmp/one.pdf')], [2, pdfItem(2, '/tmp/two.pdf')]]));
  ctx.Zotero.logError = error => errors.push(error);
  ctx.ztoolkit.ProgressWindow = ProgressWindow;
  ctx.IOUtils.read = read;
  ctx.addon = { data: { config: { addonName: 'test' }, zoteroPaperAgentApi: { uploadFile: upload, removeRefFile() {} } } };
  ctx.createFileItem = () => {
    const controls = { style: {}, addEventListener() {} };
    return { removed: false, querySelector: () => controls, remove() { this.removed = true; } };
  };
  vm.runInContext(segment('  function registerSendPDFEvent(', '  function checkBeforeSendMessage('), ctx);
  ctx.registerSendPDFEvent(chatUI);
  return { chatUI, button, messages, errors, rows, click: () => click() };
}

test('tab switch while reading cannot mismatch uploaded file and path; duplicate click is ignored', async () => {
  let resumeRead, calls = 0;
  const fixture = uploadFixture(async (file, filePath) => {
    calls++;
    assert.equal(file.name, 'one.pdf');
    assert.equal(filePath, '/tmp/one.pdf');
    assert.equal(await file.text(), '%PDF');
    return { fileID: 'uploaded' };
  }, () => new Promise(resolve => { resumeRead = () => resolve(new Uint8Array([37, 80, 68, 70])); }));
  const first = fixture.click();
  await new Promise(setImmediate);
  assert.equal(typeof resumeRead, 'function');
  fixture.chatUI.dataset.paperAgentAttachmentId = '2';
  await fixture.click();
  resumeRead();
  await first;
  assert.equal(calls, 1);
  assert.equal(fixture.button.disabled, false);
  assert.equal(fixture.errors.length, 0);
  assert.equal(fixture.messages[0].type, 'success');
});

test('rejected upload, service error and file-read failure clean up and re-enable retry', async () => {
  const fixtures = [
    uploadFixture(async () => { throw new Error('service unavailable'); }),
    uploadFixture(async () => ({ error: 'invalid API key' })),
    uploadFixture(async () => assert.fail('should not upload'), async () => { throw new Error('file unreadable'); })
  ];
  for (const fixture of fixtures) {
    await fixture.click();
    assert.equal(fixture.button.disabled, false);
    assert.equal(fixture.errors.length, 1);
    assert.equal(fixture.messages[0].type, 'error');
    assert.ok(fixture.rows.every(row => row.removed));
  }
});

test('repeat sidepane rendering preserves draft and binds events once while updating attachment context', async () => {
  let recoverCalls = 0, bindingCalls = 0;
  const child = { querySelector: () => ({}) };
  const chatUI = { dataset: {}, isConnected: true, style: {}, draft: 'my unsent question', children: [], appendChild(node) { this.children.push(node); } };
  const body = { querySelector: () => chatUI, ownerDocument: {} };
  const ctx = context({ PLUGIN_PREFIX: prefix, addon: { data: { alive: true, zoteroPaperAgentApi: {
    recoverChatSessionCache: async () => { recoverCalls++; },
    fullMessageListByChatSessionID() {}, configManager: { getChatWindowSizeSetting: () => ({ width: 400, height: 500 }) }
  } } }, Zotero: { logError: assert.fail }, setHeaderModelDisplay() {}, paperAgentEnhanceSidebar() {}, paperAgentDrainQuotes() {}, paperAgentStartNewChat() {} });
  for (const name of ['HeaderContainer', 'OtherToolFirstContainer', 'MessageContainer', 'FileContainer', 'ToolContainer', 'PromptContainer', 'InputContainer']) ctx['create' + name] = () => child;
  for (const name of ['UploadFile', 'SendMessage', 'CreateNewChatSession', 'SelectModel', 'SelectPrompt', 'CreateSettingDialog', 'CreateHistoryUI', 'SendPDF', 'StopStreamResponse', 'SendMessageEnterKey', 'ClipboardPaste', 'NoteButtonClick']) ctx['register' + name + 'Event'] = () => { bindingCalls++; };
  vm.runInContext(segment('  function registerChatUI(body, item) {', '  // src/hooks.ts'), ctx);
  ctx.registerChatUI(body, pdfItem(1, '/tmp/one.pdf'));
  const bindings = bindingCalls;
  const childCount = chatUI.children.length;
  ctx.registerChatUI(body, pdfItem(2, '/tmp/two.pdf'));
  assert.equal(chatUI.dataset.paperAgentAttachmentId, '2');
  assert.equal(chatUI.draft, 'my unsent question');
  assert.ok(childCount > 0);
  assert.equal(chatUI.children.length, childCount);
  assert.equal(bindingCalls, bindings);
  assert.equal(recoverCalls, 1);
  await Promise.resolve();
});

test('startup initializes API and window styles before registering a sidepane', async () => {
  const order = [];
  const toolkit = { unregisterAll() { order.push('unregister'); }, ProgressWindow: class {
    createLine() { return this; } show() {} changeLine() {} startCloseTimer() {}
  } };
  const api = {};
  const win = { MozXULElement: { insertFTLIfNeeded() { order.push('localization'); } } };
  const ctx = context({
    addon: { data: { alive: true, config: { addonName: 'test', addonRef: 'test', addonInstance: 'test' } } },
    paperAgentSelectionPopup() {}, config: { addonRef: 'test' }, ztoolkit: toolkit, getString: x => x, initLocale() {},
    createApi() { order.push('api'); return api; },
    Zotero: { Reader: { registerEventListener() {}, unregisterEventListener() {} }, getMainWindows: () => [win], Promise: { delay: async () => {} }, ItemPaneManager: { unregisterSection() { order.push('section removed'); } } },
    MainUIFactory: { registerStyleSheet() { order.push('styles'); }, registerZoteroPaperAgentItemPaneSection() { assert.equal(ctx.addon.data.zoteroPaperAgentApi, api); order.push('section'); } }
  });
  vm.runInContext(segment('  async function onStartup() {', '  async function onNotify('), ctx);
  await ctx.onStartup();
  assert.ok(order.indexOf('api') < order.indexOf('section'));
  assert.ok(order.indexOf('styles') < order.indexOf('section'));
  await ctx.onMainWindowLoad(win);
  assert.equal(order.filter(x => x === 'api').length, 1);
  await ctx.onMainWindowUnload(win);
  assert.ok(!order.includes('unregister'));
  ctx.addon.data.paperAgentPaneID = 'registered-pane';
  ctx.onShutdown();
  assert.equal(ctx.addon.data.alive, false);
  assert.ok(order.includes('section removed'));
});

test('cache recovery waits for each manager, including when configuration is already ready', async () => {
  const method = segment('    async recoverChatSessionCache() {', '    async updateChatSessionCache() {');
  const ready = [true, false, true, true];
  let delays = 0, applied = 0;
  const api = {
    configManager: { getIsLoaded: () => ready[0], getChatSessionCache: () => ({ chat_session_id: 'saved', model_group_name: 'openai', model_name: 'test', model_display_name: 'test' }) },
    modelManager: { getIsLoaded: () => ready[1] }, historyManager: { getIsLoaded: () => ready[2] }, promptManager: { getIsLoaded: () => ready[3] },
    updateCurrentLLMByModelGroupAndModelDisplayName() { assert.ok(ready.every(Boolean)); applied++; }
  };
  const ctx = context({ addon: { data: { alive: true, zoteroPaperAgentApi: api } }, setTimeout(callback) { delays++; ready.fill(true); callback(); } });
  const instance = vm.runInContext(`({${method}})`, ctx);
  await instance.recoverChatSessionCache.call(api);
  assert.equal(delays, 1);
  assert.equal(applied, 1);
  assert.equal(api.chatID, 'saved');
});

test('manifest permits Zotero 10 and preserves the identity and required update URL', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'compatibility/patched/manifest.json')));
  assert.equal(manifest.applications.zotero.strict_max_version, '10.*');
  assert.equal(manifest.applications.zotero.id, 'zoteropaperagent@github.com');
  assert.equal(manifest.version, '3.1.1.17');
  assert.equal(manifest.applications.zotero.update_url, 'https://github.com/windfollowingheart/zotero-paper-agent/releases/download/release/update.json');
});

test('Zotero 10 uses ESM while earlier hosts retain the existing import path', () => {
  const calls = [];
  const ctx = context({ Zotero: { version: '10.0.6' }, ChromeUtils: {
    importESModule(uri) { calls.push(['esm', uri]); return {}; },
    import(uri) { calls.push(['legacy', uri]); return {}; }
  } });
  vm.runInContext(segment('  function _importESModule(path2) {', '  var ClipboardHelper ='), ctx);
  ctx._importESModule('resource://gre/modules/Console.sys.mjs');
  assert.equal(calls[0][0], 'esm');
  ctx.Zotero.version = '7.0.0';
  ctx._importESModule('resource://gre/modules/Console.sys.mjs');
  assert.deepEqual(calls[1], ['legacy', 'resource://gre/modules/Console.jsm']);
});

test('selection quote keeps draft and full multiline text without HTML insertion', () => {
  const input = { value: 'My question', dispatchEvent() {}, focus() {}, setSelectionRange() {}, ownerDocument: { defaultView: { Event: class {} } } };
  const ctx = context({ PLUGIN_PREFIX: prefix });
  vm.runInContext(segment('  function paperAgentInsertQuote(', '  function paperAgentDrainQuotes('), ctx);
  assert.equal(ctx.paperAgentInsertQuote({ querySelector: () => input }, { text: '<script>unsafe</script>\nline two', title: '论文.pdf', page: 'iv' }), true);
  assert.equal(input.value, 'My question\n\n[引用：PDF · 论文.pdf · 第 iv 页]\n> <script>unsafe</script>\n> line two\n[/引用]\n\n');
});

test('pending quotes are routed by both owner window and PDF attachment', () => {
  const one = {}, two = {};
  const ctx = context({ addon: { data: { paperAgentPendingQuotes: [
    { win: one, itemID: 1, text: 'right' }, { win: two, itemID: 1, text: 'other window' }, { win: one, itemID: 2, text: 'other PDF' }
  ] } }, paperAgentInsertQuote: (chat, quote) => { assert.equal(quote.text, 'right'); return true; } });
  vm.runInContext(segment('  function paperAgentDrainQuotes(', '  function paperAgentSelectionPopup('), ctx);
  ctx.paperAgentDrainQuotes({ ownerDocument: { defaultView: one }, dataset: { paperAgentAttachmentId: '1' } });
  assert.equal(ctx.addon.data.paperAgentPendingQuotes.length, 2);
});

function responsesFixture(events) {
  let sent;
  const ctx = context({ LLM: class {}, OpenAI: class {
    constructor() {
      this.responses = { create: async (payload, options) => {
        sent = { payload, options };
        return (async function* () { for (const event of events) yield event; })();
      } };
      this.chat = { completions: { create() { assert.fail('wrong transport'); } } };
    }
  } });
  vm.runInContext(segment('  var OpenAIlLLM = class extends LLM {', '  // src/api/utils/v.ts'), ctx);
  return { ctx, instance: vm.runInContext('new OpenAIlLLM()', ctx), sent: () => sent };
}

test('Responses streams text and reasoning while keeping history and references in request', async () => {
  const fixture = responsesFixture([{ type: 'response.reasoning_summary_text.delta', delta: 'reason' }, { type: 'response.output_text.delta', delta: 'answer' }, { type: 'response.completed' }]);
  const signal = {};
  const stream = await fixture.instance._completion('https://example.invalid', [{ role: 'assistant', content: 'prior' }], 'question', [], 'PDF text', 'test-only', 'configured-model', signal, 'responses');
  const parts = [];
  for await (const item of stream) parts.push(item);
  assert.equal(parts[0].type, 'reasoning_content');
  assert.equal(parts[1].content, 'answer');
  assert.equal(fixture.sent().payload.input[1].content, 'PDF text\n\nquestion');
  assert.equal(fixture.sent().payload.input[0].content, 'prior');
  assert.equal(fixture.sent().payload.store, false);
  assert.equal(fixture.sent().options.signal, signal);
  assert.equal(fixture.sent().options.maxRetries, 0);
});

test('Responses failures, incomplete results and truncated streams cannot report success', async () => {
  for (const events of [[{ type: 'error' }], [{ type: 'response.incomplete' }], [{ type: 'response.failed' }], [{ type: 'response.output_text.delta', delta: 'partial' }]]) {
    const f = responsesFixture(events);
    const stream = await f.instance._completion('', [], 'question', [], '', 'test-only', 'test', {}, 'responses');
    await assert.rejects(async () => { for await (const item of stream) {} }, /failed|completion/);
  }
});

test('official-client-only service error is explained without exposing provider credentials', () => {
  const ctx = context();
  vm.runInContext(segment('  function paperAgentLLMError(', '  var OpenAIlLLM = class'), ctx);
  assert.match(ctx.paperAgentLLMError({ status: 403, message: 'This account only allows Codex official clients' }), /Codex 官方客户端/);
  assert.equal(ctx.paperAgentLLMError({ status: 401, message: 'secret token' }), '模型服务请求失败（HTTP 401）');
});

test('reading prompts seed once, preserve edits, custom prompts and deletions', async () => {
  const records = new Map([['/data/storage/zotero_paper_agent_data/prompts/prompts.json', [{prompt_id:'custom', prompt_name:'My prompt'}]]]);
  const ctx = context({ PathUtils: { join: (...parts) => parts.join('/'), parent: p => p.slice(0, p.lastIndexOf('/')) }, Zotero: { DataDirectory: { dir:'/data' } }, IOUtils: { makeDirectory: async () => {}, exists: async p => records.has(p), readJSON: async p => structuredClone(records.get(p)), writeJSON: async (p, v) => records.set(p, structuredClone(v)) }, generateUUID: () => 'new', ztoolkit: { getGlobal: () => () => {} } });
  vm.runInContext(segment('  var PromptsManager = class {', '  // node_modules/flexsearch/'), ctx);
  const mgr = vm.runInContext('new PromptsManager()', ctx);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(mgr.getPrompts().length, 8);
  assert.equal(mgr.getPrompts()[0].prompt_name, 'My prompt');
  const builtin = mgr.getPrompts()[1];
  await mgr.updatePrompt({...builtin, system_prompt:'My edit'});
  await mgr.deletePromptByID(mgr.getPrompts()[2].prompt_id);
  await mgr.loadConfig();
  assert.equal(mgr.getPrompts().length, 7);
  assert.equal(mgr.getPromptByID(builtin.prompt_id).system_prompt, 'My edit');
});

test('local PDF parser uses the exact byte range and rejects empty scan results', async () => {
  let received;
  let output = 'Extracted paper text';
  const ctx = context({ Parser: class {}, addon: {data:{zoteroPaperAgentApi:{configManager:{getMinerUConfig:()=>({})}}}}, Zotero:{PDFWorker:{_enqueue: async fn=>fn(), _query:async (name,args)=>{received=new Uint8Array(args.buf);return {text:output};}}}, IOUtils:{read:async()=>new Uint8Array([0,37,80,68,70,0]).subarray(1,5)} });
  vm.runInContext(fs.readFileSync(path.join(root,'compatibility/assets/pdf-parsers.js'),'utf8'),ctx);
  const parser = vm.runInContext('new PaperAgentPDFParser()',ctx);
  assert.equal(await parser.parse({file_path:'/fixture.pdf'}),'Extracted paper text');
  assert.deepEqual([...received],[37,80,68,70]);
  output=' ';
  await assert.rejects(parser.parse({file_path:'/scan.pdf'}), /扫描件/);
});

test('MinerU surfaces authorization errors without leaking credentials', async () => {
  const ctx = context({Parser:class{}, AbortController, setTimeout, clearTimeout, addon:{data:{zoteroPaperAgentApi:{configManager:{getMinerUConfig:()=>({token:'test-secret'})}}}}, generateUUID:()=> 'id', fetch:async()=>({ok:false,status:401}) });
  vm.runInContext(fs.readFileSync(path.join(root,'compatibility/assets/mineru-parser.js'),'utf8'),ctx);
  const parser=vm.runInContext('new MinerUParser()',ctx);
  await assert.rejects(parser.parse({file:{name:'test.pdf'}}),error=>error.message.includes('401') && !error.message.includes('test-secret'));
});

test('new conversation waits for preferences, deduplicates opens, clears old references and preserves draft', async () => {
  let resolvePreferences, resolveCreation, creations = 0;
  const preferences = new Promise(resolve => resolvePreferences = resolve);
  const creation = new Promise(resolve => resolveCreation = resolve);
  const messages = {replaceChildren(){this.cleared=true;}}, files = {replaceChildren(){this.cleared=true;}};
  const button={disabled:false,isConnected:true};
  const api={refs:['old-pdf'],uploadingFileTaskNum:0,promptID:'reading',createChatSession:async()=>{creations++;return creation;}};
  const chat={dataset:{paperAgentMounted:'true',paperAgentOpened:'true'},_paperAgentPreferencesReady:preferences,isConnected:true,draft:'quote and question',querySelectorAll:()=>[button],querySelector:id=>id.includes('stop-')?{style:{display:''}}:id.includes('file-list')?files:messages};
  const ctx=context({PLUGIN_PREFIX:prefix,addon:{data:{alive:true,zoteroPaperAgentApi:api}},Zotero:{logError:assert.fail},setHeaderModelDisplay(){},setPromptContainer(){}});
  vm.runInContext(fs.readFileSync(path.join(root,'compatibility/assets/new-chat.js'),'utf8'),ctx);
  const task=ctx.paperAgentStartNewChat(chat);
  assert.equal(button.disabled,true);assert.equal(creations,0);
  assert.equal(ctx.paperAgentStartNewChat(chat),task);
  resolvePreferences();await new Promise(resolve => setImmediate(resolve));assert.equal(creations,1);
  resolveCreation({chatID:'fresh'});await task;
  assert.equal(chat.dataset.paperAgentChatId,'fresh');assert.equal(api.refs.length,0);
  assert.ok(messages.cleared && files.cleared);assert.equal(chat.draft,'quote and question');assert.equal(button.disabled,false);
  api.uploadingFileTaskNum=1;await ctx.paperAgentStartNewChat(chat);assert.equal(creations,1);
});

test('actual bundled Markdown engine renders answer structure, tables and partial streamed fences safely', () => {
  const ctx=context({});
  vm.runInContext(segment('  var __create =', '  // node_modules/jszip/dist/jszip.min.js'),ctx);
  vm.runInContext(segment('  var markdownit = require_index_cjs4();','  // src/modules/ui/dialog/dialogui.ts'),ctx);
  const text='# 结论\n\n**证据**与 *推断*，`x = 1`。\n\n- 第一项\n  - 子项\n\n> 引用原文\n\n| 方法 | 结果 |\n| --- | --- |\n| A | 42 |\n\n```python\nprint("<safe>")\n```\n\n[原文](https://example.com)';
  const html=ctx.renderMarkdownWithKeywords(text);
  for (const pattern of [/<h1>结论<\/h1>/, /<strong>证据<\/strong>/, /<em>推断<\/em>/, /<ul>/, /<blockquote>/, /paper-agent-markdown-table/, /<th>方法<\/th>/, /language-python/, /&lt;safe&gt;/, /href="https:\/\/example.com"/]) assert.match(html,pattern);
  assert.match(ctx.renderMarkdownWithKeywords('```python\nprint(1)'),/<pre><code class="language-python">/);
  const unsafe=ctx.renderMarkdownWithKeywords('<img src=x onerror=alert(1)>\n<script>alert(1)</script>\n[bad](javascript:alert(1))');
  assert.doesNotMatch(unsafe,/<img|<script|href="javascript:/);
  assert.match(ctx.renderMarkdownWithKeywords('**证据**', ['证据']),/keyword-highlight/);
});

function mathContext() {
  const ctx=context({});
  vm.runInContext(segment('  var __create =', '  // node_modules/jszip/dist/jszip.min.js'),ctx);
  vm.runInContext(segment('  var markdownit = require_index_cjs4();','  // src/modules/ui/dialog/dialogui.ts'),ctx);
  return ctx;
}

test('TeX inline/block delimiters render locally with fractions matrices and accessible MathML', () => {
  const ctx=mathContext();
  const text=String.raw`行内 $E=mc^2$ 与 \(\alpha+\beta\)。

$$
\int_0^1 x^2\,dx=\frac{1}{3}
$$

\[
\begin{pmatrix}a & b \\ c & d\end{pmatrix}
\]`;
  const html=ctx.renderMarkdownWithKeywords(text);
  assert.equal((html.match(/class="paper-agent-math /g)||[]).length,4);
  assert.equal((html.match(/<math /g)||[]).length,4);
  assert.match(html,/class="mfrac"/);assert.match(html,/class="mtable"/);
  assert.match(html,/paper-agent-math-display/);
  assert.match(ctx.renderMarkdownWithKeywords('$$x^2$$'),/paper-agent-math-display/);
});

test('formula parsing preserves code currency escaped dollars unfinished streams and invalid TeX', () => {
  const ctx=mathContext();
  for(const text of ['`$x$`','```tex\n$$x$$\n```','Price $5 and $10',String.raw`escaped \$x\$`,'unfinished $x','unfinished $$\n\\frac{a}']) {
    assert.doesNotMatch(ctx.renderMarkdownWithKeywords(text),/class="katex"/);
  }
  const invalid=ctx.renderMarkdownWithKeywords(String.raw`$\unknowncommand{x}$`);
  assert.match(invalid,/paper-agent-math-source/);assert.match(invalid,/unknowncommand/);
  const dangerous=ctx.renderMarkdownWithKeywords(String.raw`$\href{javascript:alert(1)}{x}$ $\includegraphics{https://example.com/private.png}$`);
  assert.doesNotMatch(dangerous,/<img|href="javascript:/);
  const highlighted=ctx.renderMarkdownWithKeywords('$x^2$ x',['x']);
  assert.equal((highlighted.match(/keyword-highlight/g)||[]).length,1);
  assert.match(highlighted,/<math /);
});
