---
name: clipbus-plugin-generator
description: >-
  在本剪贴板插件合集仓库里生成一个真实可用的新 Clipbus 插件（参考 template-plugin
  与已有插件、避开重复、同类合并/新类另起、目录名 clipbus-{topic}-plugin、面向用户文案用英文、跑到
  npm run verify 全绿）。只要用户想新建/生成/扩展/再来一个剪贴板插件——哪怕只是
  模糊地说"做个解码插件""再来一个插件""generate a clipbus plugin""扩展一下功能"，
  或点名某个 clipbus-*-plugin——就用这个 skill。涉及在本合集新增能力时优先用它。
---

# Clipbus 插件生成器

在这个**剪贴板插件合集**仓库里，参考样板 `template-plugin/` 与已有插件，生成一个**功能实用、开箱即用**的新插件，并修到 `npm run verify` 全绿。选题优先级：**功能实用 > 视觉呈现 > 整活/情绪价值**——目标是实用，不是演示。

完整设计见同目录 `DESIGN.md`。本文件是执行手册。

## 自我迭代（遇到插件问题就回写本 skill）

这个 skill 是**活文档**：只要在本合集里**踩到或解决了一个此前没记录的 clipbus 插件问题**——bug、隐蔽坑、构建/测试/调试陷阱、UI 或接线约定——就在**同一次会话里顺手把根因 + 可执行规则沉淀回本 skill**：接线/约定类进「铁律」或对应 `references/`，视觉类进 `references/authoring-guide.md` §11，工作流类进对应阶段。让 skill 随每次实战复利增厚，下次不再重复踩同一个坑。skill 本身在 git 里，改完按需提交。

## 何时用 / 何时不用

- **用**：用户想在本仓库新建/生成/扩展剪贴板插件，或给了选题让你实现，或说"自动来一个"。
- **不用**：用户只是想读懂/调试某个已有插件的代码（那是普通编码任务）；或当前不在这个合集仓库里。

## 前置：确认环境

1. 确认在合集仓库根：存在 `template-plugin/` 目录。不在则停下并说明。
2. 目标插件先 npm install，并读安装 SDK 的 docs/README.md 与 API.md；当前标准为 SDK 2.x / schema 5。
3. 本 skill 的脚本路径（相对本 skill 目录）：`scripts/survey.mjs`、`scripts/scaffold.mjs`。深入资料在 `references/`。

## 工作流（七阶段）

把下面每个阶段建成一个 todo，按序推进。

### 0 · 解析意图

判断两件事：
- **模式**：用户是否要求"全自主"（出现"自动选题/直接生成/全自主/随便来一个"等）。否则走**默认模式**（提选题等确认）。
- **选题**：用户是否已给定选题/功能。给定就直接用，跳过阶段 2 的提案部分、只做归属判断。

### 1 · 勘察现状

运行 `node <skill>/scripts/survey.mjs <repoRoot>`，解析它输出的 JSON，掌握：已有 `clipbus-*-plugin`、各自**类别**与功能点、**已占用的 plugin.id / attachmentType / 目录名**。这是避重与命名防撞的依据。必要时再读相关插件的 `README.md` 看它已覆盖什么。

### 2 · 选题与归属

分两步：**先自由选题，再 survey 驱动归属。**

**A. 选题（自由发散）**
- 自由构思一个"剪贴板里常见、做了有用"的 feature。`references/topic-ideas.md` 只是**灵感源**（卡壳时翻），**不是清单、更不是归类约束**——鼓励提出表里没有的新点子，发掘新能力正是本 skill 的目的。
- 优先级：实用 > 视觉 > 整活。用户给定选题则直接用。

**B. 归属（survey 驱动，合并优先）**
拿选定的 feature，**基于阶段 1 survey 出的「现有插件真实职责」**判断（看每个插件的 `readmeSummary` + detectors/renderers/actions——**看实际职责，不是看名字、更不是拿 topic 表的分组对号入座**）：
- 逐个问"这个 feature 并入哪个现有插件最自然？"——**找到职责契合的宿主就并入它（作为新 feature 扩展）**，别与它已覆盖的重复。
- **确实没有任何现有插件职责契合 → 才新建** `clipbus-{topic}-plugin`。
- **判不准时默认"并入最接近的"，不默认"新建"。**

两条归属经验法则：
- **被动 vs 主动**：被动检测+展示（detector+renderer）的 feature，并入以 detector/renderer 为主的插件；用户主动调用（action）的 feature，并入以 action 为主的插件。例：解码（被动识别编码串，detector 驱动）与格式转换（用户主动换格式，action 驱动）**即使都沾"转换"，也分属不同插件**。
- **一个职责一个插件**：同一职责域只应有一个插件。发现天然归属已存在就扩展进去。

然后按模式：
- **默认模式**：提 2-4 个候选，每个给「一句卖点 / 定位（实用·视觉·整活）/ 归属（survey 里并入 X 或新建 Y）/ 计划扩展点」。用 AskUserQuestion 让用户选定，再继续。
- **全自主模式**：自己挑一个**现有插件尚未覆盖的 feature**（挑 feature，**不是**"挑一个没建过的插件名"），直接继续、不停顿。**新建前必须过硬门控**，先输出一行：
  `选定 feature：<topic>；考察候选宿主：<逐个列 survey 里相关插件 + 各自为何不契合>；归属：并入 <X> ／ 新建 <Y>；理由：<一句>`
  **若写不出"每个相关插件都不契合的具体理由"，就不许新建，必须并入最接近的那个。**

避重/合并铁律（survey 驱动）：① 不重复已有插件已覆盖的功能；② plugin.id / attachmentType / 目录名都不能和 survey 结果撞；③ **同一职责域只能有一个插件**——并入是默认、新建是例外。全自主模式靠上面的硬门控挡住"为同类另起插件"的退化（这是本 skill 最常见的退化：20 次调用生成 20 个本应合并的插件，务必守住）。

### 3 · 落地基线

- **新建**：`node <skill>/scripts/scaffold.mjs <topic> --title "<人类标题>" --repo <repoRoot>`。它从 template 派生一个**干净通用基线**（去掉演示代码，`build-ui.mjs`/`verify-build.mjs` 已改为读 manifest 自动适配）。产物是"能 build 的空骨架"。
- **扩展已有**：进入目标插件目录，准备在 `src/features/` 下新增 feature；不要跑 scaffold。

### 4 · 实现能力（实用优先）

读 `references/authoring-guide.md` 跟着写。要点：
- 按选题只实现需要的贡献：展示附件配 renderer，只写搜索扩展可无 renderer；Action 只在提供独立变换时添加，避免重复复制入口。
- 有卡片页的 feature 目录名与 renderer id 一致，包含 app.vue、main.ts、index.html；Action 只有 Runtime 函数。
- payload.ts 放跨端安全的类型、defineAttachment 契约、构造与解码；detector/Action 放 Runtime。每个 renderer 都有真实 V2 scenario 和组件挂载，非固定高度使用 /dom 的 autoFit({ target })。
- detector/Action 的 manifest id 与 Runtime key 对齐；renderer 的 id、源目录、page 与 preview 组件映射对齐。
- 附件类型使用本插件 id + "." 前缀，并列在 manifest writes.attachmentTypes；搜索 scope 列在 writes.searchScopes。合并 feature 时同步契约、manifest、测试和 scenario 的命名空间。
- 视觉只用 `var(--clipbus-*, 回退)` 主题 token，适配明暗，版式干净（详见 authoring-guide 的视觉规范）。
- 写**精简冒烟测试**（范式见 authoring-guide）。

### 5 · 验证闭环

在目标插件目录：
1. `npm install`（拉 `@clipbus/plugin-sdk`）。
2. **先读 `node_modules/@clipbus/plugin-sdk/API.md`** 校准能力签名——它是 capability 真相源，本仓库示例可能滞后；冲突以 API.md 为准。也可读 `node_modules/@clipbus/plugin-sdk/docs/README.md` 文档地图。
3. `npm run verify`，**修到全绿**（typecheck/lint/build/verify-build/冒烟测试）。扩展场景是整插件重验。

遇到失败别绕过：用 systematic-debugging 的思路定位根因再改。

**在 Clipbus 里目测视觉改动时（坑）**：每个插件的 `dist/` 是 **gitignore 的构建产物**，宿主实际加载的就是它。① 改完要 `npm run build`（或 verify）**刷新 `dist/`**，否则 Clipbus 重载看到的还是旧 UI；② 在 **git worktree** 里改时，要么让用户把 Clipbus Developer Plugin **指向 worktree 目录**，要么直接在用户实际加载的路径重建；③ **把源码合并回 main 不会重建 main 的 `dist/`**——合并后须对受影响插件**重跑 `npm run build`**，否则用户在 main 路径重载仍是旧产物（真实踩过：用户一直在测 main 的陈旧 dist，误判成"改了没生效"，白绕一圈）。

### 6 · 更新目录索引（中英双写，强制）

- 更新目标插件 `README.md`：写清它**覆盖了哪些功能**（feature 清单），**用英文写**（见「铁律 · 文案语言」）。
- **措辞自检（强制）**：按「铁律 · 文案风格统一」复查本次的 `plugin.title` / README H1 / detector·renderer 标题；**本次 survey 或扩展触及的现有插件**若发现裸 slug、`Detection`、过去分词等不一致，**顺手一并修正**（这是用户期望的"顺带 review 现有插件措辞"）。
- 更新根索引——**`README.md`（英文，仓库主页）与 `README_zh.md`（中文）两个文件必须同步加/改同一条**（简述 + 链接到该插件 README）。两文件的插件条目须一一对应；任一不存在则创建。**只更新一个、漏掉另一个 = 没完成。**

### 7 · 汇报

给出：插件目录、新增/变更的能力、验证结果（命令 + 结论）、**中英双索引（`README.md` + `README_zh.md`）的更新情况**。

## 铁律（接线不变量，违反必出错）

- **接线对齐**：detector/Action manifest id 与函数注册 key 一致；renderer id 与 src/features/<id>、page 对齐，renderer 不注册 Runtime handler。
- **展示与搜索独立**：detector 用 ctx.item 写附件/搜索扩展，只有要展示的附件需要同型 renderer；内部状态与纯搜索输出不要求 UI。
- **扩展点按需**：已展示并有复制按钮的值，不再创建同值复制 Action；Action 适合无卡片的文本变换或独立结果。
- **命名空间与声明**：attachment type 必须以 plugin.id + "." 开头；所有实际写入列入 writes。新增类型/搜索 scope 后同步 manifest、契约、preview 和测试。
- **输入仅两种 kind**：text / image，字段与 kind 同级；图片只有元数据，像素通过 ctx.input.imagePath() 读取。
- **当前契约**：SDK ^2.0.0、schemaVersion 5、renderers[].page、detectors/actions 的 inputKinds。Action 只有函数处理器；宿主已移除 Draft 能力，不生成表单或兼容层。
- **Action 当前值**：input.item 是 Flow 起点；处理逻辑看 input.content。图片读取当前级联 ctx.input.imagePath()，输出写插件 cache 后用 result.image 返回。
- **文本解码验证**：Base64 等文本输出先验证 UTF-8 无损往返与可显示字符比例，业务测试覆盖无效 UTF-8、控制字符和合法非 ASCII 文本。
- **能力签名以 API.md 为准**；不改 `node_modules/@clipbus/plugin-sdk/` 内 SDK 源码。
- UI 禁裸 hex，一律 `var(--clipbus-*, 回退)`。
- **UI 贴合宿主**：卡片根容器透明、padding:0；顶层 section 水平内距也清零，只有独立子盒使用内部 padding。详见 authoring-guide §11。
- **文案语言（面向用户文字一律英文）**：后续生产的插件 / 新 feature，所有**面向用户**的文案——`manifest.json` 的 `title` / `description`、UI（`app.vue` 等）里可见的字符串与按钮标题、插件自身 `README.md`——**必须用英文**。根索引按 `README.md`（英文）+ `README_zh.md`（中文）双写。代码注释、本仓库内部说明、commit message 不受此限。
- **文案风格统一（命名一致性）**：`plugin.title` 用简洁的**类别名或功能名**（如 `Formatter` / `Extractor` / `Cron Explainer`），不要用裸目录名；**README 的 H1 必须是人类标题**，禁止 `# clipbus-xxx-plugin` 裸 slug；detector 的 `title` 统一 `<X> Detector`（不要 `Detection`）；renderer 的 `title` 用**内容名词**（`Color Swatch` / `CSV Table` / `URL Details`），避免过去分词（如 `URL Parsed`）。同插件其余条目也对齐这套风格，跨插件保持一致。
- **`.ts` 扩展名**：运行时 `.ts` 文件间相对 import 带 `.ts`（冒烟测试用 Node 直接 require，不会自动补扩展名）；`.vue` 文件内可不带。
- **`payload.ts` 必须 UI 安全**：它被 `app.vue` 与 runtime 两侧 import，**严禁出现 `import … from "node:*"`**（`node:crypto`/`fs` 等）——否则 `build:ui` 时 Rollup 报 `MISSING_EXPORT`。需 Node API 算 payload（哈希等）就拆出 runtime-only 的 `builder.ts` 承载，`payload.ts` 只留类型 + `decode*Payload`。详见 authoring-guide 第 2 节。
- **preview 必须 wire**：每个 renderer 有真实 V2 scenario，包含 plugin/item/attachment/renderer/height，item.attachments 只放引用。createPreviewWorkbench 的 mount 挂载实际 app.vue 并返回清理函数；组件用 useCard 初始化/订阅，不缓存模块级快照。纯 Runtime Action 显示无卡片说明。详见 authoring-guide §10。
- **非固定高度**：从 /dom 调 autoFit({ target: 内容元素 }) 并在卸载时停止；不能量整个预览 document.body。高度范围与 manifest 一致，长内容提供内部滚动。详见 authoring-guide §8。

## 两种模式速记

| | 默认模式 | 全自主模式 |
|---|---|---|
| 选题 | 提案 → 用户选 | 自动挑未占用选题 |
| 停顿 | 选题处等确认 | 全程不停 |
| 适用 | 想参与决策 | "再来一个"批量产出 |

两种模式的**实现/验证/索引**阶段完全一致，只在阶段 2 是否停顿不同。

## 参考文件

- `references/architecture.md` — 两侧架构、四扩展点、接线不变量、通用约定速查（动手前先读）。
- `references/authoring-guide.md` — 怎么写真实 detector/renderer/action、payload 范式、视觉规范、冒烟测试范式（阶段 4 跟着做）。
- `references/topic-ideas.md` — 选题**灵感库**（启发式，**非归类约束**；归属一律看 survey，见阶段 2）。
