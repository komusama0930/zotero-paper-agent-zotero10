// SPDX-License-Identifier: AGPL-3.0-or-later
// Unofficial modifications maintained by komusama0930; 2026-10-13. See NOTICE.
  var MinerUParser = class extends Parser {
    async request(url, options = {}) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60000);
      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        if (!response.ok) throw new Error(`MinerU 请求失败（HTTP ${response.status}）`);
        return response;
      } catch (error) {
        if (error.name === "AbortError") throw new Error("MinerU 请求超时，请检查网络后重试。");
        throw error;
      } finally { clearTimeout(timer); }
    }
    async parse(request) {
      const token = addon.data.zoteroPaperAgentApi.configManager.getMinerUConfig().token;
      if (!token) throw new Error("MinerU OCR 尚未配置密钥；普通文字 PDF 可选择本地提取。");
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
      const response = await this.request("https://mineru.net/api/v4/file-urls/batch", {
        method: "POST", headers,
        body: JSON.stringify({ files: [{ name: request.file?.name || PathUtils.filename(request.file_path), data_id: generateUUID() }], model_version: "vlm" })
      });
      const result = await response.json();
      if (result.code !== 0 || !result.data?.batch_id || !result.data?.file_urls?.[0]) throw new Error(`MinerU 未能创建解析任务（代码 ${result.code ?? "未知"}），请检查密钥和服务配额。`);
      const bytes = request.file_path ? await IOUtils.read(request.file_path) : new Uint8Array(await request.file.arrayBuffer());
      await this.request(result.data.file_urls[0], { method: "PUT", body: bytes });
      let zipURL;
      const deadline = Date.now() + 300000;
      while (Date.now() < deadline) {
        const statusResponse = await this.request(`https://mineru.net/api/v4/extract-results/batch/${encodeURIComponent(result.data.batch_id)}`, { headers });
        const status = await statusResponse.json();
        if (status.code !== 0) throw new Error(`MinerU 查询失败（代码 ${status.code ?? "未知"}）。`);
        const file = status.data?.extract_result?.[0];
        if (file?.state === "failed") throw new Error("MinerU 解析失败，请检查 PDF 是否损坏、加密或超出服务限制。");
        if (file?.state === "done") { zipURL = file.full_zip_url; break; }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      if (!zipURL) throw new Error("MinerU 在等待时限内未返回结果，请稍后重试或选择本地提取。");
      const zip = await this.request(zipURL);
      const files = await extractZipToMap(new Uint8Array(await zip.arrayBuffer()));
      const name = [...files.keys()].find(name => name === "full.md" || name.endsWith("/full.md"));
      if (!name) throw new Error("MinerU 结果中缺少 full.md。");
      const text = uint8ArrayToText(arrayBufferToUint8Array(files.get(name))).trim();
      if (!text) throw new Error("MinerU 返回了空的解析文本。");
      return text;
    }
  };
