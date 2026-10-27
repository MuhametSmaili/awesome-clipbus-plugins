# Clipbus 插件合集

[English](./README.md) | 中文

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

**Clipbus 官方插件合集 —— 面向 macOS 的可编程剪贴板。** 持续增加的现成插件，外加自己动手写插件的完整工具链。

[clipbus.com](https://clipbus.com) · [插件文档](https://clipbus.com/plugin-doc)

## 安装到 Clipbus

使用这些插件的主要方式是直接从本仓库安装——无需 clone，无需本地构建。

1. 打开 Clipbus，进入 **设置 → 插件 → 安装 → Git 仓库**，会打开 **“从 Git 仓库安装”** 面板。
2. 填写表单：

   | 字段 | 填写值 |
   |---|---|
   | 仓库地址 | `https://github.com/scubers/awesome-clipbus-plugins` |
   | 子目录 | 插件的目录名，例如 `clipbus-decoder-plugin`——见下方[插件列表](#插件列表)中的**子目录**列 |
   | Ref | 留空即跟随 `main`，也可填 branch / tag / commit 固定版本 |

3. 点击 **安装**。

Clipbus 免费版每类能力（detector / renderer / action）各有 3 个插件槽位；Pro 提升这个上限，并加入 Cloud Sync。

## 用 AI 创建和维护插件

1. Clone 本仓库。
2. 用你常用的 AI Coding Agent 打开仓库。
3. 直接描述要创建的插件或要执行的维护任务。

`.agents/skills/`、`.codex/skills/` 和 `.claude/skills/` 各保留一份内容一致的最新技能。
Windows / macOS 新 clone 后即可直接使用，无需额外初始化。修改时同步三份，CI 自动检查内容一致。

仓库在 `.agents/skills/` 中提供了两套专用工作流：

- **Create — `clipbus-plugin-generator`：**先勘察现有插件，再把功能并入最匹配的插件或创建新插件；完成实现与全量验证，同时避免产生近重复插件。
- **Sync — `clipbus-template-sync`：**拉取官方插件模板与 Plugin SDK 更新，判断哪些共享改动会影响现有插件，并按需完成迁移与验证。

## 插件列表

下表每个插件都是独立的顶层目录，完全自包含（各自 `npm install`、各自构建）——仓库根目录没有统一的 `package.json` 或构建编排。**子目录**列可直接复制进上方的安装表单。

| 插件 | 子目录 | 描述 | 演示 |
|------|--------|------|------|
| [clipbus-decoder-plugin](./clipbus-decoder-plugin/README.md) | `clipbus-decoder-plugin` | 识别可读 UTF-8 Base64、JWT 与 `data:` URI，并提供 10 个独立、可由宿主级联的 URL / HTML / Base64 / Unicode / JSON 编解码 auto-run action | [GIF](./docs/gifs/decoder.gif) |
| [clipbus-formatter-plugin](./clipbus-formatter-plugin/README.md) | `clipbus-formatter-plugin` | 识别并格式化 JSON / XML，支持 JSON 美化、压缩与 YAML 视图；将 CSV/TSV 渲染为表格并导出 JSON | — |
| [clipbus-converter-plugin](./clipbus-converter-plugin/README.md) | `clipbus-converter-plugin` | 数值、时间、单位与权限转换，并提供 10 个独立、可由宿主级联的命名风格 auto-run action | — |
| [clipbus-extractor-plugin](./clipbus-extractor-plugin/README.md) | `clipbus-extractor-plugin` | 提取与解析 URL、裸查询字符串、实体、IP/CIDR、坐标、MAC 和 UUID；URL Details 支持移除追踪参数并保留重复 query pair | — |
| [clipbus-preview-plugin](./clipbus-preview-plugin/README.md) | `clipbus-preview-plugin` | 颜色（含 WCAG 对比度）、CSS 渐变与安全 Markdown 可视化预览 | [GIF](./docs/gifs/preview.gif) |
| [clipbus-text-plugin](./clipbus-text-plugin/README.md) | `clipbus-text-plugin` | 9 个独立 auto-run 文本 action：JSON 美化/压缩、排序、去重、整理空白、移除 ANSI，以及反转或排序字符/行 | — |
| [clipbus-cron-plugin](./clipbus-cron-plugin/README.md) | `clipbus-cron-plugin` | 识别 5 段 cron 表达式，逐字段中文释义表、一句执行概述,以及接下来 5 次触发时刻（实时本地时间）（带护栏避免误判普通数字行）| — |
| [clipbus-vibe-plugin](./clipbus-vibe-plugin/README.md) | `clipbus-vibe-plugin` | 情绪兜底动画：当没有任何插件能展示某条纯文本时，提供三种可切换的 Three.js 粒子动画——①Particle Core：粒子自字形炸开、噪声漂移后重组为发光球体；②Text Reveal：文字完整可读（字号自适应卡片尺寸）→ 光扫描 → 边缘裂解 → 爆发 → 回收为多面体光核；③Text Loop：8 阶段无缝循环——文字→粒子化→爆发→漂浮能量云→旋涡回收成球→稳定悬浮→解构→重组文字（首尾完全衔接）；原生按钮栏切换，展示哪些动画及顺序可用 `plugin.vibe.animations` 设置项配置（默认全部三个） | [GIF](./docs/gifs/vibe.gif) |

`template-plugin/` 是官方脚手架 + 全能力参考——用于被**复制**，而非安装。它不是产品插件，因此不出现在上表中。上方 AI 创建流程生成的新插件，起点都是它的一份拷贝。

## 社区插件

在这个合集之外维护自己的 Clipbus 插件？欢迎在这里收录。

| 插件 | 描述 | 仓库 | 安装子目录 |
|------|------|------|-----------|
| [Copy Sound](https://github.com/MuhametSmaili/clipbus-plugins/tree/main/sound-plugin) | 为 macOS 提供轻柔的复制提示音，支持自定义音频文件和音量。 | `https://github.com/MuhametSmaili/clipbus-plugins` | `sound-plugin` |

添加一行，提交一个 PR 即可——见下方**贡献**。

## 贡献

两条贡献路径：

1. **PR 进本仓库**，成为官方合集的一员。你的插件目录必须通过自己的构建与测试门禁——在该目录内执行 `npm install && npm run verify`（build + test）。架构、四个扩展点（detector / renderer / action / messageHandlers）、跨文件接线不变量与新增插件流程见 **[AGENTS.md](./AGENTS.md)**。
2. **自己维护仓库**，提交 PR 在上方[社区插件](#社区插件)表格中加一行。审核只看链接与描述，不审代码。
