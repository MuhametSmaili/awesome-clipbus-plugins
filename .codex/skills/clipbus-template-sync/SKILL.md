---
name: clipbus-template-sync
description: >-
  在本剪贴板插件合集仓库里，把上游 clipbus-template-plugin 的最新改动拉进
  template-plugin/，判断哪些改动会影响其他插件，并把共享基建 / SDK 升级等有影响的部分
  同步到全部 clipbus-*-plugin（逐个 npm run verify 修到绿）。只要用户提到"更新/升级模板工程"
  "同步模板改动到插件""拉一下最新 template""把 plugin-sdk / SDK 版本升到所有插件"
  "template 升级了同步一下""把模板的改动 apply 到各插件"——哪怕没点名本 skill——就用它。
  注意：这是"维护既有插件与模板的一致性"，与"从零新建一个插件"(clipbus-plugin-generator)
  是不同任务；纯新建插件别用本 skill。
---

# Clipbus 模板同步器

在这个**剪贴板插件合集**仓库里，把上游模板工程 `clipbus-template-plugin` 的更新拉进本地
`template-plugin/`，用**判断驱动**分析增量，再把**有影响的共享基建改动**同步到全部
`clipbus-*-plugin`，并逐个 `npm run verify` 修到全绿。

完整设计与决策见同目录 `DESIGN.md`；逐文件的判断框架见 `references/propagation-analysis.md`。本文件是执行手册。

上游地址（默认）：`https://github.com/scubers/clipbus-template-plugin`

## 两条贯穿始终的方针（用户已拍板）

- **判断驱动**：不维护静态"同步清单"。每次都读真实的 template diff，逐文件推理该不该传播、怎么传播。`references/propagation-analysis.md` 的类别表是**加速判断的参考知识**，不是替代读 diff 的机械规则。
- **全自动 + 一道 review 关卡**：除阶段 2 末尾**停下来把"修改方案"交用户 review**外，全程自动跑完不再停。用户确认修改方案后，试点→并行→收尾自检→汇报一气呵成。

## 自我迭代（遇到同步问题就回写本 skill）

这个 skill 是**活文档**：只要在同步中**踩到或解决了一个此前没记录的问题**——某类模板改动的传播姿势、隐蔽坑、构建/测试陷阱、跨插件不一致——就在**同一次会话里**把根因 + 可执行规则沉淀回本 skill（接线/传播规则进「铁律」或 `references/propagation-analysis.md`，工作流类进对应阶段）。让 skill 随每次实战复利增厚。skill 本身在 git 里，改完按需提交。

## 何时用 / 何时不用

- **用**：用户想把上游模板的更新同步进来、并扩散到各插件；或说"模板升级了，其他插件也更新一下""把 SDK 升到所有插件"。
- **不用**：用户想**从零新建/扩展**一个插件（那是 `clipbus-plugin-generator`）；或只想读懂/调试某个插件的业务代码（普通编码任务）；或当前不在这个合集仓库里。

## 当前标准

SDK ^2.0.0、协议 V2、manifest schema 5。旧版本的迁移案例仅作历史证据，不是当前接口范式。
宿主已经移除 Draft Action；同步时删除相关实现/表单/预览/测试与教程，纯此类能力的插件经用户确认后整体移除。
当前 preview 是 V2 的 plugin/item/attachment/renderer/height；item.attachments 仅放引用。每个 renderer 必须保留实际组件和业务样例。

## 前置：确认环境

1. 确认在合集仓库根：存在 `template-plugin/` 目录。不在则停下并说明。
2. 本 skill 脚本路径（相对本 skill 目录）：`scripts/pull-template.mjs`、`scripts/sdk-api-diff.mjs`、`scripts/check-consistency.mjs`。判断资料在 `references/propagation-analysis.md`。
3. **隔离方式（用户已选）**：在**当前分支直接干**，不开新分支、不开 worktree。好处是 verify 天然把 `dist/` 重建在用户 Clipbus 实际加载的路径。代价是无 git 级隔离——所以**动手前确认工作树是干净的**（`git status`），脏的话先请用户处理或 stash，否则 template diff 会和用户既有改动混在一起、读不清。若既有未跟踪文件逐字节等于本次上游新增文件，可先只读分析并把保留/纳入方案明确交 review；已获授权后按该方案处理，不重复索取确认。

## 工作流（六阶段）

把下面每个阶段建成一个 todo，按序推进。

### 0 · 勘察现状

- 枚举派生插件：所有 `clipbus-*-plugin/` 目录（排除 `template-plugin`）。**只算"真插件"**：必须 git-tracked（`git ls-files <dir>` 非空）且含 `manifest.json` + `package.json`。**未追踪/残缺的半成品目录要排除**（真实踩过：`clipbus-vibe-plugin` 是某次会话生成到一半的未入库草稿——0 个 tracked 文件、无 `package.json`/`manifest.json`、`scripts/` 空，根本无法 `npm install`/`verify`；误纳入会让传播在它身上空转报错）。一句话体检：`for d in clipbus-*-plugin; do echo "$d tracked=$(git ls-files "$d"|wc -l) $([ -f "$d/package.json" ]&&echo pkg) $([ -f "$d/manifest.json" ]&&echo mf)"; done`。
- `git status` 确认工作树干净（见前置）。
- **变体：用户「copy 进来一个旧插件」要你把它追平**——这不是 upstream-pull→扩散，而是「单插件追平当前标准」：`template-plugin` 已是标准、其余插件已收敛，唯一落后的是新拷进来的那个。六阶段照走，但**阶段 1 不拉上游**（template 已是标准），**增量 =「该插件存量共享基建 ↔ 当前标准」的差异**（直接 diff 它 vs `template-plugin` 的逐字共享集、vs 某收敛 sibling 的 forked 脚本、vs template 的 package.json scripts/SDK）。SDK bump 仍**必跑 `sdk-api-diff`**——旧插件常差好几个 minor（真实踩过 0.7.0→0.8.7：零破坏、唯一 additive 是 `locale`，但 docs 新增 `preview.md` ⇒ preview 架构必须从手写 `PreviewShellApp.vue` 迁到 `createPreviewWorkbench`，见铁律「架构迁移要传播」）。试点=全量（只有这一个插件，无并行扩散）。
- **坑：拷进来的插件常自带嵌套 `.git`**（连原仓库一起 copy）。于是 `git status` 把它显示成单个 `?? <dir>/`、`git ls-files <dir>` 返回 0、`git add -n` 警告「正在添加嵌入式 git 仓库」、`check-consistency` 也**枚举不到它**（它按 `git ls-files -- */manifest.json` 列插件）。**这种目录不是阶段 0 该排除的半成品草稿（那种是 0 文件无 pkg/mf），而是结构完整、要 ADOPT 的真插件**——别误排除。但在 `rm -rf <dir>/.git` 去掉嵌套仓库前，它无法被外层仓库 track、也进不了 consistency 枚举。去 `.git` 会丢弃被拷插件的独立历史 ⇒ **是用户决策，别擅自删**：先做完迁移 + verify，再把「去嵌套 .git 以正式纳入合集」作为收尾决策交用户。它的收敛证据可**手工补**：diff 逐字共享 vs template、forked 脚本 vs sibling、package.json scripts/SDK vs template（即 `check-consistency` 三项检查的手工版）。

### 1 · 拉取并替换 template

- 先预览：`node <skill>/scripts/pull-template.mjs <repoRoot> --dry-run`。它浅克隆上游、算出 `added/modified/removed` 三张清单但不落盘。
- **若无 delta** → 模板已是最新，汇报"无需同步"并结束。
- 有 delta 且值得做 → 去掉 `--dry-run` 正式跑：`node <skill>/scripts/pull-template.mjs <repoRoot>`。它把 `template-plugin/` 的 tracked 文件替换成上游 tracked 文件，**自动保留**本地 gitignored 内容（`node_modules/`、`dist/`、`.omc`）。**不会 git add/commit。**
- 替换后，模板增量 = `git diff template-plugin/`（modified/removed 的逐行 hunk）+ 脚本清单里的 **added**（新增文件是 untracked，`git diff` 看不到，务必从清单取并直接读文件）。

### 2 · 判断影响 + 列出修改方案 【⏸ 等用户 review】

- 读 `references/propagation-analysis.md`，对增量里**每个**文件/hunk 归类（逐字共享 / package.json 字段级 / ⚠️分叉脚本 / 契约约定变化 / template 自有·不传播 / 新未分类）。
- **三张清单都要过**，别漏 added。
- **⚠️ 若增量触及 `package.json` 的 `@clipbus/plugin-sdk` 版本（SDK bump）→ 必跑 `node <skill>/scripts/sdk-api-diff.mjs <repoRoot>`**。SDK 升级的真实影响**藏在依赖包内部、不在仓库文件里**，且**新增的可选 API 不会让 verify 失败**——只靠"文件 diff + 试点 verify 绿"会**漏掉它**（本 skill 真实踩过：把 0.8.1→0.8.4 误判成"只 bump 版本号"，实则新增了 `locale` 能力）。脚本列出 ADDED/REMOVED 能力，并输出 `API.md`、SDK 根 Markdown（如 `README.md` / `SPECIFICATION.md`）与 `docs/` 教程的实际 unified diff；这些变更正文必须读完。把结果分两类纳入方案：**REMOVED / 改签名 = 破坏性**（必须改代码，verify 会红）；**ADDED = 可选新能力**（verify 绿，但要在方案里显式列出、问用户是否采用，绝不静默忽略）。
- 产出**修改方案**，至少说清：① 这次模板到底改了什么（一句话归纳）；② 每条改动归到哪一类、为什么；③ 要动哪些插件、各自要改什么文件/字段；④ SDK bump 的 `sdk-api-diff` 结论（破坏性项 / 可选新能力项分别怎么处理）；⑤ 是否触及分叉脚本（需同步 generator 资产）；⑥ 有无"新未分类"项需用户拍板。
- **停在这里**，把修改方案交给用户 review。**用户确认后才进入阶段 3。** 这是全程唯一的人工关卡。

### 3 · 试点一个插件（验证 recipe）

- 选一个**有代表性**的插件作试点（功能较全、含 UI 的更能暴露问题）。
- 按修改方案改这一个插件。`cd` 进去：依赖变了就 `npm install`，然后 `npm run verify`，**修到全绿**。
- **关键产出：校准 recipe。** 尤其当方案含"疑似契约变化"时——试点的 verify 会告诉你这次到底是"只改版本号/只拷文件"还是"还要改 manifest/代码"。失败别绕过：先读 `node_modules/@clipbus/plugin-sdk/API.md`（capability 真相源）和 `docs/README.md`（迁移说明）定位根因，把必要的代码改动并入 recipe，再继续。
- 试点跑绿、recipe 定型后，才扩散。**不要把没验证过的 recipe 直接并行。**

### 4 · 并行迁移其余插件

- 按 `clipbus-plugin-batch-orchestration` 经验：**每个剩余插件派一个全新 Agent**（`subagent_type` 用 executor/general-purpose，**不要复用 idle executor**），并行下发（一条消息里多个 Agent 调用）。
- 每个 Agent 的任务：对指定插件套用**已验证的 recipe**（明确列出要改的文件/字段）→ 依赖变了 `npm install` → `npm run verify` 修到绿 → 回报结果。
- **orchestrator（你）独占共享物**：根索引（`README.md`/`README_zh.md`，本同步一般不动）、generator 脚手架资产等不要让子 Agent 各自碰，避免并发写冲突。
- 子 Agent 全部回来后，**自己复跑抽样 verify** 复核它们的结论（别只信回报）。

### 5 · 收尾一致性校验 + 重建 dist

- `node <skill>/scripts/check-consistency.mjs <repoRoot>`：校验所有插件的共享基建已**收敛一致**（逐字共享逐字节匹配、package.json 的 SDK 版本+scripts 段匹配、分叉脚本各插件互相一致）。exit≠0 就按报告逐项修，直到 exit 0。这是判断驱动下补偿"可能不一致"的兜底。
- **重建 dist**：对所有受影响插件，在**当前分支（真实加载路径）** `npm run build`（或 verify 已重建则跳过），确保 Clipbus 重载看到新产物。dist 是 gitignore 产物，不重建用户就看不到改动。

### 6 · 汇报

给出：① 模板增量摘要（上游 HEAD + added/modified/removed）；② 修改方案落实情况（每类做了什么）；③ 各插件 `npm run verify` 结果；④ `check-consistency` 结论；⑤ dist 重建状态；⑥ 若改了分叉脚本，generator 资产的同步情况。

## 铁律（违反必出错）

- **绝不直接把 template 的 `build-ui.mjs`/`verify-build.mjs` 拷给插件**：template 是 demo 专用版，插件用的是 generator 脚手架的通用 manifest 驱动版。直接拷会让全部派生插件构建失败。这俩有真实行为变化时，先 port 进 `clipbus-plugin-generator/assets/scaffold/scripts/` 再分发，并同步更新 generator 资产。
- **package.json 字段级合并，禁止整文件覆盖**：只同步 SDK 版本 / scripts 段 / 共享 devDeps；保留各插件的 `name`/`description`/自有依赖。
- **SDK 版本 bump ≠ 只改版本号，且 verify 绿 ≠ 没影响**：升级的真实影响**藏在依赖包内部**。**必跑 `scripts/sdk-api-diff.mjs` diff 新旧 SDK 的 API、根 Markdown 与 docs 教程正文**。删除/改签名是**破坏性**的（verify 会红，报错先读 `API.md`/`docs/README.md` 再改）；**新增的可选 API（如 0.8.4 的 `locale`）verify 绿也照样是真实影响，必须在方案里列出并问是否采用**——只靠文件 diff + 试点 verify 会漏掉它（真实踩过）。**任何 added/modified 文档都必须读实际 diff**：0.8.5 的 capability 数没变，却新增 `docs/preview.md` + `@clipbus/plugin-sdk/preview`；0.8.7→0.9.5 的关键 Action 级联语义又同时藏在根 `README.md` / `SPECIFICATION.md`，只看 `docs/` 文件名仍会漏判。
- **schema major bump 迁移完整契约**：对照 SDK API.md 与迁移文档。当前 v4→v5 需要 renderers/page/inputKinds/writes、函数 handler、结构化 payload、/view ctx、typed messages，以及 V2 preview。删除已移除入口；同步测试、设计文档和 generator 资产。Action 仅处理当前 content，item 保持 Flow 起点身份。
- **added 文件不在 `git diff` 里**：上游新增文件是 untracked，必须从 `pull-template.mjs` 清单取，否则会漏传播。
- **dist 在真实路径重建**：dist 是 gitignore 产物、宿主实际加载它；在当前分支重建（别跑去 worktree）。
- **全新 Agent 并行**：不复用 idle executor；orchestrator 独占根索引等共享物；自己复跑 verify 复核。
- **历史 verify 例外不能永久沿用**：环境性失败必须按本次真实上游内容重新确认，不能把过去的红灯硬编码成永久豁免。0.8.7→0.9.5 的上游已删除依赖 sibling `protocol/plugin` 的 `wire-roundtrip.test.cjs`，因此 template 自身重新要求 `npm run verify` 全绿；未来若再遇环境性失败，须给出当前证据后再决定是否保留上游原样。
- **保留业务内容，迁移 SDK 架构**：模板的 features、scenarios、manifest、README/GUIDE 与演示测试不直接覆盖派生插件。当前 V2 preview 必须逐插件改为 plugin 身份、item 快照、结构化 attachment、manifest renderer 默认值与 height；mount 挂载实际组件并清理订阅。scenario.messages 替代 Runtime。纯 Runtime Action 保留无卡片说明。旧 useTopicRef/tests/setup.cjs 已删除；共享 useCard 和 tests/support/plugin.cjs 要复制，模板专用 digest/PNG decoder 不传播。
- **新增/删除尚未暂存也要校验**：一致性检查读取 cached + others --exclude-standard 并过滤实际已删除路径；不能只看 git ls-files 的旧索引。已删除插件不再参与枚举；缺失分叉脚本必须报错，并与 generator 资产比较，不能只按插件之间互相一致。
- **API 抽取不能静默空集**：V2 不再提供 V1 capabilityClients 生成文件。sdk-api-diff 解析公共 API.md 的 Methods/Events，并检查抽取数量符合 Overview；未知格式必须报错。跨协议新增方法名可能是旧能力改名，不能一律判断为可选加法。
- **preview 验证到实际页面**：保留各业务样例，通过 SDK computeBootstrap 校验每个 renderer 的 scenario，并实际打开工作台检查组件、场景、主题与按钮；fake Host 不验证 writes 总量或真实文件。
- **判断驱动不等于无依据**：每次都读真实 diff，但用 `references/propagation-analysis.md` 的类别表加速；遇到表里没有的"新未分类"改动，保守处理并在阶段 2 显式交用户拍板，绝不静默丢弃。

## 参考文件

- `references/propagation-analysis.md` — 两个真相源、怎么读增量、类别表（识别+处置）、已知逐字共享集、坑、跨 skill 依赖（动手分析前先读）。
- `DESIGN.md` — 设计原理与两个关键决策（判断驱动 / 全自动+一关卡）的来由，及为何独立于 `clipbus-plugin-generator`。

脚本回归：在仓库根运行 `python3 .agents/skills/clipbus-template-sync/scripts/test-consistency.py`，覆盖未暂存新增 helper、退役插件、删除共享文件与缺失通用脚本。
