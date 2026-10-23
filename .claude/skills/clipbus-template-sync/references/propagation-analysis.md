# 传播分析框架（判断驱动的"参考知识"）

本文件是**判断时的参考**，不是机械规则表。本 skill 选择的是**纯判断驱动**：每次同步都读真实的 template diff、逐文件推理它该不该传播、怎么传播。下面这套类别知识用来**加速**那次推理（让你一眼认出 90% 的常见情形），但**不能替代读 diff**——模板随时可能引入表里没有的新东西，那时必须靠判断。

## 目录
- [核心心智模型：两个真相源](#核心心智模型两个真相源)
- [怎么读 template 增量](#怎么读-template-增量)
- [类别表：识别 + 处置](#类别表识别--处置)
- [当前已知的"逐字共享集"](#当前已知的逐字共享集)
- [坑（务必避开）](#坑务必避开)
- [跨 skill 依赖](#跨-skill-依赖)

## 核心心智模型：两个真相源

合集里的"共享基建"并非都以 template 为源。分两类：

1. **template 即真相**——绝大多数共享文件（构建脚本里的 `build-runtime.mjs`/`install.mjs`、各 config、`env.d.ts`、`AGENTS.md`、`src/shared/*`、`tests/setup.cjs`、`package.json` 的 scripts 段 + SDK 版本）。template 改了，逐字同步给每个插件。

2. **generator 脚手架即真相**——`scripts/build-ui.mjs` 与 `scripts/verify-build.mjs`。各插件用的是 `clipbus-plugin-generator/assets/scaffold/scripts/` 里的**通用 manifest 驱动版**（自动按 manifest 适配能力）；template 自带的是 **demo 专用版**（硬编码了 template 自己那些演示能力的 allowlist / NESTED_OVERRIDES）。**两者故意不一致。**

> ⚠️ 由此得出本 skill 最重要的一条：**绝不能把 template 的 `build-ui.mjs`/`verify-build.mjs` 直接拷给插件**——那会把 9 个插件的通用版覆盖成 demo 专用版，9 个插件全部构建失败。

## 怎么读 template 增量

阶段 1 跑 `scripts/pull-template.mjs`（先 `--dry-run` 预览，确认要做再正式跑）。它把 `template-plugin/` 的 tracked 文件替换成上游 tracked 文件，并输出 `added / modified / removed` 三张清单（`--json` 出机器可读）。然后：

- **modified**：`git diff template-plugin/<file>` 看逐行 hunk。
- **added**（上游新增、本地还没有 → 是 untracked，**`git diff` 看不到**，务必从清单取）：直接读文件内容。
- **removed**：上游删了的文件。

判断"有没有影响其他插件"时，**三张清单都要过**，尤其别漏 added（git diff 默认不显示它）。

**⚠️ 特例：增量含 SDK 版本 bump。** 当三张清单里出现 `package.json` 且 hunk 是 `@clipbus/plugin-sdk` 版本变化时，**仓库文件 diff 到此为止只能看到一个版本号——真正的影响藏在依赖包内部，文件 diff 根本照不到**。这时**必跑 `scripts/sdk-api-diff.mjs <repoRoot>`**：它 npm-pack 新旧两版 SDK、diff 它们的 `API.md` + `docs/`，列出 ADDED/REMOVED 能力与 host event。这一步不是可选的——见下方[坑](#坑务必避开)里的 locale 实例。

## 类别表：识别 + 处置

对增量里的每个文件/hunk，归到下列之一：

| 类别 | 怎么识别 | 处置 |
|---|---|---|
| **逐字共享** | 路径属于"两个真相源"里的第①类（见下方已知集），且不是各插件自定义 | 改了就把 template 的新版**逐字拷给每个插件** |
| **package.json（字段级）** | `package.json` 的 hunk | **不要整文件覆盖**。只把 **SDK 版本**、**scripts 段**、**devDependencies 的共享项**合并进每个插件；**保留**各插件的 `name`/`description`/`private`/自有依赖 |
| **⚠️ 分叉脚本** | `scripts/build-ui.mjs` / `scripts/verify-build.mjs` | **绝不直接拷 template 版**。判断这次改动是不是真实的**行为/契约变化**（如新 SDK 要求不同的 UI 产物布局）：是 → 把该变化 **port 进通用版**（`clipbus-plugin-generator/assets/scaffold/scripts/`）后再分发给各插件，并同步更新 generator 资产（见跨 skill 依赖）；只是 demo 自身的 churn → 跳过 |
| **契约/约定变化** | SDK 版本 bump、新增/收紧的 manifest 字段、新的 verify 步骤、改了的 capability 签名、新权限要求 | **不是拷文件**。SDK bump **必先跑 `sdk-api-diff.mjs`**（影响藏在依赖内部）。破坏性项逐插件改 `manifest.json`/`src/plugin.ts`/feature 代码、靠试点 `npm run verify` 探明；可选新能力项在方案里列出问采用与否。先试点再并行正为此 |
| **template 自有** | `src/features/*`（demo）、`src/preview/*`、template 的 `manifest.json`、`README*`、`GUIDE*`、`tests/**/*.test.cjs`（demo 测试用例） | **永不传播**。各插件有自己的 feature、manifest、测试 |
| **新出现的未分类文件** | 上游 added 了一个从没见过的路径 | **判断**：长得像新的共享基建（如 `src/shared/` 下新模块、新的根 config）→ 当逐字共享传播；模糊 → 保守处理（先不动）并**在汇报里显式标出**，绝不静默丢弃 |

## 当前已知的"逐字共享集"

**这是观测快照，不是硬清单**——`check-consistency.mjs` 用"template 的实际 tracked 文件 − 各插件自定义 denylist"**动态导出**它，所以模板新增共享文件时会自动纳入（注意：上游 added 的文件在 `git add` 前是 untracked，check-consistency 看不到它，收尾校验前先 stage template）。当前为 13 个：

```
.npmrc
AGENTS.md
env.d.ts
eslint.config.mjs
tsconfig.json
vite.config.mjs
scripts/build-runtime.mjs
scripts/install.mjs
src/shared/base.css
src/shared/composables/useTopicRef.ts
src/shared/debug.ts
src/shared/display.ts
tests/setup.cjs
```

注意边界：
- `tests/setup.cjs` 共享；`tests/**/*.test.cjs` **不**共享（各插件测自己的 feature）。
- `src/shared/*` 是**可选**逐字共享：插件可删掉不用的 helper（`fdb8547` 已从 9 个插件删掉未引用的 `debug.ts`/`display.ts`），`check-consistency` 对它们的 missing 放行、present 才要求逐字一致。**别为了让校验通过把死代码加回去**；若插件留着某个 helper，template 改了它就要照样逐字同步（0.10.0 同步时发现 vibe 的 `debug.ts` 停在上一轮之前的版本——它当时还没入库，被上次同步漏掉）。
- `package.json` 不在逐字集——走**字段级合并**。
- `package-lock.json` 不在逐字集——各插件依赖树天生不同（实测 template 3953 行、各插件各 4422 行且 hash 互异）。`check-consistency.mjs` 的 `DENY_EXACT` 已显式排除它（2026-06-28 修：此前漏排，脚本把 lockfile 当逐字共享、对 9 个插件长期 false-fail；同次上游同步还删除了 template 自带的 lockfile，本仓决定各插件**保留**各自 lockfile 以保可复现安装）。
- `scripts/build-ui.mjs` / `scripts/verify-build.mjs` 不在逐字集——是**分叉脚本**。
- `scripts/export.mjs` 当前**未被 tracked**（package.json 虽有 `export` 脚本引用它，但仓库里没这个文件）。动态导出天然不会把它算进来；若上游某天真的加了它，会自动纳入。

## 坑（务必避开）

- **build-ui/verify-build 覆盖陷阱**：见上文，最致命。把它拷给插件 = 全员构建失败。
- **dist 是 gitignore 产物**：Clipbus 实际加载 `dist/`。迁移后必须在**用户实际加载的路径**对受影响插件重建 `dist/`（`npm run build` 或 verify 会重建），否则重载看到的还是旧 UI。本 skill 在当前分支直接干，verify 天然把 dist 重建在真实路径——别跑到 worktree 里重建。
- **SDK bump：真实影响藏在依赖内部，文件 diff 和 verify 绿都照不到它（本 skill 真实踩过，最重要的一条）**。版本号变了不代表"只改版本号"，而 SDK 的改动**不在仓库文件里**——`pull-template` 的 diff 只能看到 package.json 里一个版本号。必须 **`scripts/sdk-api-diff.mjs`** 去 diff 新旧 SDK 的 `API.md`/`docs`。两类影响要分清：
    - **REMOVED / 改签名 = 破坏性**：插件用到就会编译/校验失败，`npm run verify` 会红。报错先读 `node_modules/@clipbus/plugin-sdk/API.md`（capability 真相源）+ `docs/` 再改。
    - **ADDED = 可选新能力**：插件不用它也照样编译过、verify 全绿——**所以光看"试点 verify 绿"会以为没影响，这是陷阱**。新增能力是真实影响，必须在修改方案里**显式列出**并问用户是否采用，绝不静默忽略。
  - **实例（0.8.1 → 0.8.4）**：仓库里只有 `template-plugin/package.json` 一行 `^0.8.1 → ^0.8.4`。`sdk-api-diff` 揭示真实增量 = 新增 `locale` 能力（runtime `host.locale.get()`、UI `clipbus.locale.current()/.on()`、topic `locale`、global `__CLIPBUS_PLUGIN_LOCALE__`），纯新增、无权限、无既有签名改动。verify 会全绿，但"插件该不该用上 locale"是真实的待决问题。第一版分析仅凭文件 diff + 试点 verify，把它误判成"只 bump 版本号、低影响"——`sdk-api-diff` 就是为堵这个洞而加的。
- **attachmentType 命名空间**：若契约变化牵涉 detector/renderer 的 attachmentType 规则，记住宿主加载期强制 `plugin.<本插件>.*` 前缀，而 `npm run verify` 查不出——改动涉及此处时要格外小心（详见 `clipbus-plugin-generator` 的铁律）。
- **added 文件不在 `git diff` 里**：务必从 `pull-template.mjs` 的清单取 added，别只看 `git diff`。

## 跨 skill 依赖

`build-ui.mjs`/`verify-build.mjs` 通用版的真相源是 **`clipbus-plugin-generator/assets/scaffold/scripts/`**。一旦本 skill 判定要改这两个脚本的**行为**：

1. 先把变化 port 进 generator 的脚手架资产（那是新插件的源）；
2. 再分发给现有各插件；
3. 否则：之后新 `generate` 出来的插件会与现有插件不一致，留下隐患。

这是本 skill 与 `clipbus-plugin-generator` 唯一的耦合点，改分叉脚本时务必两边一起动。
