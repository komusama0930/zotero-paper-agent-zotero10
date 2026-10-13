# SPDX-License-Identifier: AGPL-3.0-or-later
# Unofficial modifications maintained by komusama0930; 2026-10-13. See NOTICE.
from pathlib import Path


def patch(text):
    def replace(before, after):
        nonlocal text
        if text.count(before) != 1:
            raise ValueError(f"PDF patch target count: {before[:90]}")
        text = text.replace(before, after, 1)
    start = text.index('  var MinerUParser = class extends Parser {')
    end = text.index('  // src/api/mgr/file.ts', start)
    text = text[:start] + (Path(__file__).resolve().parent.parent / 'assets/mineru-parser.js').read_text() + '\n' + text[end:]
    helpers = (Path(__file__).resolve().parent.parent / 'assets/pdf-parsers.js').read_text()
    replace('  // src/api/mgr/file.ts', helpers + '\n  // src/api/mgr/file.ts')
    replace('    parser = new MinerUParser();', '    parser = new PaperAgentPDFParser();')
    replace('''      if (filePath === "") {
        filePath = file.mozFullPath;
      }
      if (filePath === "") {
        throw new Error("\\u6587\\u4EF6\\u8DEF\\u5F84\\u4E0D\\u80FD\\u4E3A\\u7A7A");
      }
      const md5 = Zotero.Utilities.Internal.md5(Zotero.File.pathToFile(filePath));''', '''      filePath = filePath || file.mozFullPath || "";
      let md5;
      if (filePath) {
        md5 = Zotero.Utilities.Internal.md5(Zotero.File.pathToFile(filePath));
      } else {
        const digest = await ztoolkit.getGlobal("window").crypto.subtle.digest("SHA-256", await file.arrayBuffer());
        md5 = "sha256:" + [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
      }''')
    replace('''        if (existingFileID) {
          console.log("\\u6587\\u4EF6\\u5DF2\\u5B58\\u5728", existingFileID);''', '''        const parserMode = addon.data.zoteroPaperAgentApi.configManager.getMinerUConfig().parser || "local";
        if (existingFileID && this.filesMap[existingFileID]?.file_text_content?.trim() && this.filesMap[existingFileID]?.other_info?.parser === parserMode) {
          console.log("PDF text already cached", existingFileID);''')
    replace('''        const pdfContent = await this.parser.parse({
          file_path: filePath
        });''', '''        const pdfContent = await this.parser.parse({ file_path: filePath, file });''')
    replace('''          file_text_content: pdfContent,
          other_info: {}''', '''          file_text_content: pdfContent,
          other_info: { parser: parserMode }''')
    replace('''        this.uploadingFileTaskNum++;
        const apiKey = this.modelManager''', '''        this.uploadingFileTaskNum++;
        const apiKey = this.modelManager''')
    # Preserve a useful parser error instead of coercing an Error object to [object Object].
    replace('''        console.log(error);
        this.uploadingFileTaskNum--;
        return { error };''', '''        Zotero.logError(error);
        this.uploadingFileTaskNum--;
        return { error: error?.message || String(error) };''')
    replace('''    editMinerUApiDialogListContainerItemInput.value = addon.data.zoteroPaperAgentApi.configManager.getMinerUConfig().token;''', '''    const parserLabel = editMinerUApiDialog.ownerDocument.createElement("label");
    parserLabel.className = "paper-agent-parser-choice";
    parserLabel.textContent = "PDF 解析方式";
    const parserSelect = editMinerUApiDialog.ownerDocument.createElement("select");
    parserSelect.className = "paper-agent-parser-select";
    parserSelect.setAttribute("aria-label", "PDF 解析方式");
    for (const [value, label] of [["local", "本地提取（无需 MinerU）"], ["mineru", "MinerU 云端 OCR（需密钥）"]]) {
      const option = editMinerUApiDialog.ownerDocument.createElement("option");
      option.value = value; option.textContent = label; parserSelect.appendChild(option);
    }
    parserSelect.value = addon.data.zoteroPaperAgentApi.configManager.getMinerUConfig().parser || "local";
    parserLabel.appendChild(parserSelect);
    editMinerUApiDialog.querySelector(`.${PLUGIN_PREFIX}dialog-list-container`).prepend(parserLabel);
    editMinerUApiDialogListContainerItemInput.type = "password";
    editMinerUApiDialogListContainerItemInput.placeholder = "仅 MinerU 云端 OCR 需要密钥";
    editMinerUApiDialogListContainerItemInput.value = addon.data.zoteroPaperAgentApi.configManager.getMinerUConfig().token;''')
    replace('''      mineruConfig.token = editMinerUApiDialogListContainerItemInput.value;''', '''      mineruConfig.token = editMinerUApiDialogListContainerItemInput.value;
      mineruConfig.parser = editMinerUApiDialog.querySelector(".paper-agent-parser-select").value;''')
    text = text.replace('"MinerU Setting"', '"PDF 解析设置"')
    # The sidepanel action attaches parsed text; it does not upload a binary to the LLM.
    replace('text: "File Uploaded!", type: "success", progress: 100', 'text: "PDF 文本已加入对话", type: "success", progress: 100')
    start = text.index('  function registerUploadFileEvent(')
    end = text.index('  function registerSendPDFEvent(', start)
    text = text[:start] + '''  function registerUploadFileEvent(uploadButton, uploadFileInput, fileListContainer, uploadSuccesscallback, removeSuccesscallback) {
    uploadButton.addEventListener("click", () => uploadFileInput.click());
    uploadFileInput.addEventListener("change", async e => {
      const file = e.target.files?.[0];
      if (!file || uploadButton.disabled) return;
      uploadButton.disabled = true;
      let row;
      try {
        row = createFileItem(fileListContainer.ownerDocument, file.name, file.size);
        fileListContainer.appendChild(row);
        const response = await addon.data.zoteroPaperAgentApi.uploadFile(file, "");
        if (!response || response.error) throw new Error(response?.error || "PDF 解析没有返回结果");
        row.dataset.fileID = response.fileID;
        row.querySelector(`#${PLUGIN_PREFIX}file-item-upload-status-container`).style.display = "none";
        const remove = row.querySelector(`#${PLUGIN_PREFIX}file-item-delete-container`);
        remove.style.display = "flex";
        remove.addEventListener("click", () => {
          row.remove(); addon.data.zoteroPaperAgentApi.removeRefFile(response.fileID);
          removeSuccesscallback?.(response);
        });
        uploadSuccesscallback?.(response);
      } catch (error) {
        row?.remove(); Zotero.logError(error);
        new ztoolkit.ProgressWindow(addon.data.config.addonName).createLine({ text: "PDF 解析失败：" + error.message, type: "error", progress: 100 }).show();
      } finally { uploadButton.disabled = false; uploadFileInput.value = ""; }
    });
  }
''' + text[end:]
    text = text.replace('          deleteContainer.style.display = "flex";\n          uploadStatusContainer.style.display = "none";', '          if (!response || response.error) throw new Error(response?.error || "PDF 解析没有返回结果");\n          deleteContainer.style.display = "flex";\n          uploadStatusContainer.style.display = "none";', 1)
    return text
