# SPDX-License-Identifier: AGPL-3.0-or-later
# Unofficial modifications maintained by komusama0930; 2026-10-13. See NOTICE.
"""Add opt-in Responses transport while retaining Chat Completions defaults."""
def patch(text):
    def replace(before, after):
        nonlocal text
        if text.count(before) != 1:
            raise ValueError(f"Responses patch target count: {before[:100]}")
        text = text.replace(before, after, 1)
    replace('async _completion(baseURL, history, query, refs = [], refsContent = "", apiKey, model, signal) {', 'async _completion(baseURL, history, query, refs = [], refsContent = "", apiKey, model, signal, apiWire = "chat", reasoningEffort) {')
    replace('      const stream = await client.chat.completions.create(\n        {\n          model,\n          messages: [...history, { role: "user", content: newQuery }],', r'''      if (apiWire === "responses") {
        const events = await client.responses.create({
          model,
          instructions: history.filter(item => ["system", "developer"].includes(item.role)).map(item => item.content).join("\n") || "You are a helpful reading assistant.",
          input: [...history.filter(item => !["system", "developer"].includes(item.role)), { role: "user", content: newQuery }],
          ...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}),
          stream: true,
          store: false
        }, { signal, maxRetries: 0 });
        async function* responsesGenerator() {
          let completed = false;
          for await (const event of events) {
            if (event.type === "response.output_text.delta" || event.type === "response.refusal.delta") {
              if (event.delta) yield { type: "content", content: event.delta };
            } else if (event.type === "response.reasoning_summary_text.delta") {
              if (event.delta) yield { type: "reasoning_content", content: event.delta };
            } else if (event.type === "response.completed") {
              completed = true;
            } else if (["error", "response.failed", "response.incomplete"].includes(event.type)) {
              const detail = event.error?.code || event.response?.error?.code || event.response?.incomplete_details?.reason || event.code || "unknown";
              const safeCode = String(detail).replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 80);
              const message = event.response?.error?.message || event.error?.message || event.message || "";
              const safeMessage = String(message).split(apiKey).join("[redacted]").replace(/Bearer\s+\S+|sk-[a-zA-Z0-9_-]+/g, "[redacted]").slice(0, 240);
              throw new Error(`Responses request failed or incomplete (${event.type}: ${safeCode}) ${safeMessage}`);
            }
          }
          if (!completed) throw new Error("Responses stream ended before completion");
        }
        return responsesGenerator();
      }
      const stream = await client.chat.completions.create(
        {
          model,
          messages: [...history, { role: "user", content: newQuery }],''')
    replace('          model,\n          historyMessageList,', '          model,\n          apiWire,\n          reasoningEffort,\n          historyMessageList,')
    replace('          model,\n          signal\n        );', '          model,\n          signal,\n          apiWire,\n          reasoningEffort\n        );')
    replace('        baseUrl: this.modelsMap["openai"].models[modelDisplayName].base_url', '        reasoningEffort: this.modelsMap["openai"].models[modelDisplayName].reasoning_effort,\n        apiWire: this.modelsMap["openai"].models[modelDisplayName].wire_api || "chat",\n        baseUrl: this.modelsMap["openai"].models[modelDisplayName].base_url')
    replace('      request["baseUrl"] = modelConfig.baseUrl;', '      request["baseUrl"] = modelConfig.baseUrl;\n      request["apiWire"] = modelConfig.apiWire;\n      request["reasoningEffort"] = modelConfig.reasoningEffort;')
    replace('        base_url: baseUrl,\n        api_key: apiKey,', '        base_url: baseUrl,\n        reasoning_effort: this.modelsMap["openai"].models[oldModelDisplayName]?.reasoning_effort,\n        wire_api: this.modelsMap["openai"].models[oldModelDisplayName]?.wire_api || "chat",\n        api_key: apiKey,')
    replace('  var OpenAIlLLM = class extends LLM {', '''  function paperAgentLLMError(error) {
    if (error?.status === 403 && String(error.message).includes("only allows Codex official clients")) {
      return "服务端仅允许 Codex 官方客户端：当前密钥不能用于 Zotero 插件。请使用允许第三方调用的 API Key。";
    }
    if (Number.isInteger(error?.status)) return `模型服务请求失败（HTTP ${error.status}）`;
    return "流式请求失败或未完成，请检查模型服务配置。";
  }
  var OpenAIlLLM = class extends LLM {''')
    replace('        console.error("\\u9519\\u8BEF\\uFF1A", err);\n        return {\n          error: "\\u6D41\\u5F0F\\u8BF7\\u6C42\\u5931\\u8D25"\n        };', '''        const message = paperAgentLLMError(err);
        Zotero.logError(new Error(message));
        return { error: message };''')
    start = text.index('  function sendMessage(chatUI,')
    end = text.index('  function registerSendPDFEvent(', start)
    section = text[start:end]
    section = section.replace('text: "\\u274C\\u8BF7\\u6C42\\u5931\\u8D25",', 'text: "请求失败：" + response.error,')
    section = section.replace('agentMessageTextItemContentTextContainer.textContent = "\\u274C\\u8BF7\\u6C42\\u5931\\u8D25";', 'agentMessageTextItemContentTextContainer.textContent = "请求失败：" + response.error;')
    text = text[:start] + section + text[end:]
    return text
