# Zotero Paper Agent — Zotero 10 compatibility patches

[English](README_EN.md) · [上游项目](https://github.com/windfollowingheart/zotero-paper-agent) · [许可证](LICENSE)

这是基于 **windfollowingheart / Zotero Paper Agent** 的非官方兼容补丁项目。

修改代码按 **AGPL-3.0-or-later** 发布。上游及依赖的版权、作者和许可证通知必须保留，详见 [NOTICE](NOTICE) 和 [来源记录](docs/PROVENANCE.md)。

## 功能

- Zotero 10 侧栏启动、HTML 命名空间、模块导入和生命周期兼容。
- 随侧栏宽高变化的界面、首次展开高度修复、明暗主题支持。
- PDF 选中文字及页码引用到输入框，点击发送后交给模型。
- 默认本地 PDF 文字提取；可主动选择 MinerU 云端 OCR。
- 七套可编辑的文献阅读提示词、可搜索的模型和提示词选择面板。
- 打开侧栏默认新建本地对话，旧会话保留在历史中。
- 流式及历史回答的 Markdown 排版，包括可滚动表格与代码块。
- 流式性能优化：有界公式缓存、100–250ms 合并刷新、复用未变化段落的 DOM；结束立即显示完整回答，向上阅读时保持滚动位置。
- 本地 KaTeX 公式渲染：`$…$`、`$$…$$`、`\(...\)`、`\[...\]`；分数、积分、矩阵、长公式滚动及错误回退。
- OpenAI 兼容 Chat Completions，以及可选 Responses 流式传输。

## 发布范围与上游源码差异

**本仓库当前发布修改源码与构建工具，不发布 XPI 二进制、修改后的完整编译包或上游编译包。**

上游公开 v3.1.1 标签对应的 TypeScript 源码与官方 v3.1.1 XPI 的模块结构和插件身份存在差异；当前无法据此确认正式包的完整对应源码。本项目不把编译 JavaScript 冒充完整对应源码，不宣称已完成二进制再分发所需的源码核验。发布二进制前，须核实完整对应源码、依赖和构建材料，并按 AGPL 的要求一并提供。参见 [发布流程](docs/RELEASING.md)。

KaTeX 0.16.22 的官方发行库和字体按 MIT 许可证随源码项目保存，保留其原通知，详见 [依赖记录](docs/DEPENDENCIES.md)。它们属于第三方依赖，不是本项目声称原创的代码；公式无需访问 CDN。

本仓库中的 Python 补丁、JavaScript/CSS 资产及 JSON 提示词是本项目修改的直接可编辑来源。它们针对上游公开发布的固定校验值 XPI，由使用者自行取得该包后本地应用；没有 API 密钥、聊天记录、个人文献或账号同步工具。

## 本地构建

需要 Python 3.9+，运行测试还需要 Node.js 20+。构建不依赖 npm 安装。

```sh
python3 tools/fetch_upstream.py
python3 compatibility/build.py
node --check compatibility/patched/content/scripts/zoteropaperagent.js
node --test compatibility/tests/runtime.test.cjs
```

下载脚本只访问上游官方 GitHub release，强制核验 SHA-256；已下载的文件亦重新核验。输出为 `dist/zotero-paper-agent-3.1.1.18.xpi`。生成文件与原包均不纳入版本控制。

在 Zotero「工具 → 插件」齿轮菜单选择「从文件安装插件」，安装本地生成的 XPI 后重启。**沿用上游插件 ID，会替换已有 Paper Agent 插件**。建议备份 Zotero 配置；回退时重新安装上游合适版本。本地包保留上游更新地址，未来上游更新可能替换这些修改，可在 Zotero 插件管理中关闭该插件自动更新。

## 使用

配置你自己的模型 API 地址和密钥；点击「阅读提示词」选择阅读任务，点击「读取 PDF」或选择原文「引用到对话」，再输入问题并发送。Enter 发送，Shift+Enter 换行。自动新建会话不调用模型 API；生成回答才产生模型请求。

普通文字 PDF 默认在本机提取。扫描 PDF 可在「设置 → PDF 解析设置」选择 MinerU OCR，并自行配置凭据。**选择云端 OCR 会将 PDF 上传到 MinerU；发送问题会将相关提取文本、引用及会话上下文交给所配置的模型服务。** 本项目没有提供、代理或收费的模型账号。

## 验证与限制

测试环境：Zotero 10.0.6 / macOS。27项 Node 回归测试与57项隔离 Zotero 原生检查通过；后者使用合成 PDF 和模拟模型回答，不上传个人文献。云端 OCR及所有模型服务未做完整在线验证。Windows、Linux 和其他 Zotero 版本未验证。

本地 PDF 提取依赖 Zotero 内部 worker API，未来升级可能需要调整。扫描件、加密文件和长全文可能受提取能力或模型上下文长度限制。多窗口仍共享上游 API 状态，不保证独立并行会话。Markdown 支持基础结构及 KaTeX 数学公式，尚未新增代码语法着色；KaTeX 不支持全部 LaTeX 宏包。

## 参与

请先阅读 [CONTRIBUTING](CONTRIBUTING.md)、[行为准则](CODE_OF_CONDUCT.md) 和 [安全说明](SECURITY.md)。报告问题时提供版本、复现步骤和脱敏日志，不上传 API 密钥、私人论文或聊天记录。纯上游问题可提交至上游；本项目特有的问题请在本仓库报告。
