# 来源与修改记录

- 上游作者/维护者：windfollowingheart；上游 package.json author 为 wind。
- 上游项目：https://github.com/windfollowingheart/zotero-paper-agent
- 公开标签：v3.1.1；检查到的提交：`763a82e670596a689ac94b3058bac61af48697e5`。
- 包中声明的许可证：`AGPL-3.0-or-later`，本项目复制原 LICENSE 原文并延续此声明。
- 官方输入文件：https://github.com/windfollowingheart/zotero-paper-agent/releases/download/v3.1.1/zotero-paper-agent.xpi
- 输入 SHA-256：`1e4d574c1df0b280bd666186ea58f4aa6232be9cb805677fb757111d525681f7`。
- 修改维护账号：komusama0930；本次修改日期：2026-10-12 至 2026-10-13。

## 公开源码与正式包的差异

该公开标签的 package.json version 为 2.0.1，addonID 为 zoteropaperagent@windfollowingheart.com；正式 v3.1.1 XPI ID 为 zoteropaperagent@github.com，其编译包包含 src/api/mgr/file.ts、PromptsManager 等模块，在该标签的源码树未找到对应模块。这里仅记录观察到的差异，不判断其原因，也不暗示原作者授权或背书。

因此本仓库保留修改的直接可编辑材料和确定性的构建配方；不将公开标签称作正式包的完整对应源码。任何二进制发布需先核实该问题。

## 修改映射

| 材料 | 内容 |
| --- | --- |
| compatibility/patches/runtime.py | Zotero 10 生命周期、路径、加载顺序等兼容 |
| compatibility/patches/responses.py | 可选 Responses 流式传输及错误处理 |
| compatibility/patches/s_pdf.py；assets/*parser*.js | 本地提取与 MinerU 错误、上传和缓存处理 |
| compatibility/patches/t_prompts.py；assets/reading-prompts.json | 七套阅读提示词及一次性迁移 |
| compatibility/patches/ui.py；assets/sidebar.* | 主题、宽高与选区引用 |
| compatibility/patches/v_dialogs.py；assets/dialogs.js | 选择面板及键盘交互 |
| compatibility/patches/w_new_chat.py；assets/new-chat.js | 默认新会话及重复展开控制 |
| compatibility/patches/x_markdown.py | Markdown 配置、表格和搜索高亮 |

构建保留上游 JavaScript 内部的依赖许可证注释、manifest 作者和主页。沿用插件身份及更新地址为兼容既有数据的决定，非声明本项目是上游。
