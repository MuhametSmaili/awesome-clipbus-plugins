# clipbus-template-sync · 设计

## 要解决的问题

合集里 `template-plugin/` 是上游 `clipbus-template-plugin` 的 vendored 副本，所有已跟踪且结构完整的
`clipbus-*-plugin` 都从它派生。上游模板更新（升 SDK、改共享工具、调构建脚本、引入新约定）后，需要：把更新拉进
`template-plugin/`，判断哪些改动**影响派生插件**，再把有影响的部分**同步到全部插件并验证到绿**。
本 skill 把这套流程固化下来，避免每次手工同步遗漏或弄坏插件。

## 为什么独立于 clipbus-plugin-generator

两个 skill 职责正交、与仓库"一职责一插件"哲学一致：

- `clipbus-plugin-generator`：**无中生有**造新插件。
- `clipbus-template-sync`（本）：**维护既有插件与模板的一致性**。

唯一耦合点：`build-ui.mjs`/`verify-build.mjs` 通用版的真相源在 generator 的脚手架资产里。本 skill
若要改这两个脚本的行为，须同步更新 generator 资产（见 `references/propagation-analysis.md`）。

## 核心洞察：共享基建有两个真相源

调研发现共享基建并非都以 template 为源（实测 template vs 各插件逐字节比对得出）：

1. **template 即真相**（逐字一致）：`build-runtime.mjs`、`install.mjs`、各 config、`env.d.ts`、
   `AGENTS.md`、`src/shared/*`、`tests/setup.cjs`、`package.json` 的 scripts 段 + SDK 版本。
2. **generator 脚手架即真相**：`build-ui.mjs`/`verify-build.mjs` —— 插件用通用 manifest 驱动版，
   template 自带 demo 专用版，**故意分叉**。直接把 template 版拷给插件会弄坏全部插件。
3. **各插件自定义**（永不同步）：`manifest.json`、`src/plugin.ts`、`src/features/*`、`src/preview/*`、
   `README*`、`GUIDE*`、`tests/**/*.test.cjs`、`package.json` 的 name/description。

这条洞察决定了：本 skill 不能是无脑文件拷贝器，必须按类别区分处置。

## 两个关键决策（用户拍板）

### 决策一：纯判断驱动（不维护静态同步清单）

每次同步都读真实 template diff、逐文件推理。代价是慢、可能产生跨插件不一致；用
**试点→并行→收尾 `check-consistency` 兜底**来补偿。`references/propagation-analysis.md` 的类别表是
**判断的参考知识**而非机械规则——这样模板引入"表里没有的新东西"时不会被静态清单静默漏掉。

> 备选（未采纳）：分类表 + 判断兜底的混合；纯机械清单。用户要最稳、能接住新东西，选了纯判断。

### 决策二：全自动 + 一道 review 关卡

阶段 2 算出"修改方案"后**停下来交用户 review**，确认后试点→并行→收尾→汇报一气呵成，不再停。
关卡设在"动手改插件之前"——blast radius 最大处之前。

> 演进：用户最初说"全自动"，随即修正为"评估改动、列出修改方案后让我 review 再开始"。即唯一关卡
> 在分析之后、修改之前。

### 决策三：当前分支直接干（隔离方式）

不开新分支、不开 worktree。理由：`npm run verify` 会把 `dist/` 重建在用户 Clipbus 实际加载的路径
（dist 是 gitignore 产物，worktree 里建的 dist 不在加载路径）。代价是无 git 级隔离 → 前置要求工作树干净。

## 组成

```
clipbus-template-sync/
├── SKILL.md                       # 执行手册（六阶段 + 铁律 + 自我迭代）
├── DESIGN.md                      # 本文件
├── scripts/
│   ├── pull-template.mjs          # 浅克隆上游 → 替换 template-plugin tracked 文件 → 输出 added/modified/removed
│   │                              #   （保留 gitignored；不 git add；支持 --dry-run/--ref/--upstream/--json）
│   ├── sdk-api-diff.mjs           # SDK bump：diff API、根 Markdown、docs 正文，列 ADDED/REMOVED 能力
│   │                              #   （影响藏在依赖内部、文件 diff 与 verify 绿都照不到，必须单独 diff）
│   └── check-consistency.mjs      # 收尾：动态导出共享集，校验各插件收敛一致（exit≠0 即有分歧）
└── references/
    └── propagation-analysis.md    # 判断框架：两真相源 / 读增量 / 类别表 / 已知共享集 / 坑 / 跨 skill 依赖
```

两个脚本都是确定性核心，把"拉取替换"和"一致性校验"从判断里剥离，省 token 且可复跑。
`check-consistency.mjs` 用 "template 实际 tracked 文件 − 各插件自定义 denylist" **动态导出**共享集，
不硬编码清单，模板新增共享文件时自动纳入。

## 已验证的真实样本

调研期实测：当前上游 HEAD（`440d72f`）相对本地 template 的唯一文件增量是
`package.json` 里 `@clipbus/plugin-sdk` `^0.8.1 → ^0.8.4`。`pull-template.mjs` 的 dry-run / apply /
还原、`check-consistency.mjs` 的一致性判定均已在该样本上跑通。

## Self-iteration log：SDK bump 的方法缺陷（dogfood 中被用户揪出）

首版用 0.8.4 实跑时，仅凭 `pull-template` 的文件 diff（只有 package.json 一行版本号）+ "试点 verify
绿" 就把它判成"只 bump 版本号、低影响"。**用户指出漏了 0.8.4 新增的 `locale` 能力。** 复盘发现是
**结构性盲点**：

1. SDK 升级的真实改动**在依赖包内部**，仓库文件 diff 只能看到一个版本号；
2. **新增的可选 API（如 `locale`）不会让 `npm run verify` 失败**——插件不用它也照编译过，所以
   "试点 verify 绿"反而给了"没影响"的错觉。

修复：新增 `scripts/sdk-api-diff.mjs`（npm-pack 新旧两版、diff `API.md`/`docs`、列 ADDED/REMOVED
能力），并在 SKILL.md 阶段 2 + 铁律、`propagation-analysis.md` 里把"SDK bump 必跑 sdk-api-diff、
ADDED 也要显式列出问采用"定为硬规则。实测 `sdk-api-diff` 正确报出 `ADDED: locale.get` 及
`docs/manifest.md` 变化。这正是 skill「活文档·自我迭代」原则的一次落地。

## 验证方式的选择

本 skill 的"运行"会真实改动仓库（克隆上游、改全部派生插件、逐插件 npm install/verify），不适合 skill-creator
的自动 eval 跑分（重、有副作用、非纯函数）。最有意义的验证是拿真实的 0.8.4 更新**实跑一次**——这
既是测试也是用户的真实任务。两个确定性脚本已用非破坏方式（dry-run、apply+revert、只读校验）测过。

## Self-iteration log：0.9.5 根文档盲点与历史 verify 例外

0.8.7→0.9.5 实跑发现旧 `sdk-api-diff` 只列 `docs/` 变化并输出 `API.md`，但关键的
Action 级联语义还写在 SDK 根 `README.md` / `SPECIFICATION.md`：`sourceItem` 与当前 `content`
分离、Draft 结果终止级联、Action 当前图片与安全文件输出。修复为动态 diff SDK 根 Markdown，
并输出所有变更教程的 unified diff，避免只看文件名。

同次上游删除了历史上依赖 sibling `protocol/plugin` 的 `wire-roundtrip.test.cjs`。因此过去的
template verify 环境性豁免已经失效：每次同步都必须依据当前上游重新验证，不能永久沿用旧红灯规则。
