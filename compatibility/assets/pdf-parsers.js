// SPDX-License-Identifier: AGPL-3.0-or-later
// Unofficial modifications maintained by komusama0930; 2026-10-13. See NOTICE.
  // PDF text extraction stays local unless the user explicitly selects MinerU OCR.
  var PaperAgentPDFParser = class extends Parser {
    async parse(request) {
      const mode = addon.data.zoteroPaperAgentApi.configManager.getMinerUConfig().parser || "local";
      if (mode === "mineru") return new MinerUParser().parse(request);
      const worker = Zotero.PDFWorker;
      if (!worker?._enqueue || !worker?._query) throw new Error("当前 Zotero 不支持本地 PDF 提取，请在 PDF 解析设置中选择 MinerU。");
      const bytes = request.file_path ? await IOUtils.read(request.file_path) : new Uint8Array(await request.file.arrayBuffer());
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      const result = await worker._enqueue(() => worker._query("pdf.getFulltext", { buf: buffer }, [buffer]), true);
      const text = result?.text?.trim();
      if (!text) throw new Error("PDF 没有可提取的文字，可能是扫描件。请在设置 → PDF 解析设置中选择 MinerU OCR 后重试。");
      return text;
    }
  };
