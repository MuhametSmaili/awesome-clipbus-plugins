# 设计文档：clipbus-plugin-generator skill

> 日期：2026-06-26 · 状态：已与用户敲定，待实现
> 通过 superpowers:brainstorming 流程产出。本文记录工作流决策；接口以已安装 SDK API.md 为准。
>
> **修订 2026-06-27**：归属判断由"按 `topic-ideas.md` 类别词表"改为 **survey 驱动**（看现有插件真实职责）；`topic-ideas.md` 降级为纯**灵感库**、不再作归类约束；全自主模式新增"新建硬门控"（列候选宿主 + 落选理由）；新增「文案风格统一」规范与收尾措辞自检。详见阶段 2。

## 目标

一个**项目内**的工作流 skill。触发后，参考本合集里的 `template-plugin` 与已有插件，**避开已有插件**，生成一个**真实可用、`npm run verify` 全绿**的新剪贴板（Clipbus）插件；同类功能合并进已有插件，新类别另起新插件。插件目录名遵循 `clipbus-{topic}-plugin`。

选题优先级：**功能实用 > 视觉呈现 > 整活/情绪价值**。强调实用，不是演示。

## 已敲定的决策（来自头脑风暴）

| # | 决策点 | 结论 |
|---|---|---|
| 1 | 自主度 | **双模式带开关**：默认"先提选题再生成"（含归属决策，等用户确认）；一句话切"全自主一条龙"。用户给了选题则直接用。 |
| 2 | 完成度 | **完整实现 + 必须构建通过**。产出真实逻辑，修到验证全绿才算完成。 |
| 3 | 避重/归属 | **survey 驱动**（按现有插件真实职责判合并/新建；`topic-ideas.md` 仅作灵感、**非约束**）。每个插件 README 记录自身功能；根目录 `README.md`（英文）+ `README_zh.md`（中文）做索引。skill 开跑先读、收尾**中英双写**更新。 |
| 4 | 能力组合 | **按需覆盖**，不强行铺满。**要展示的附件必配 renderer**（detector 只写搜索扩展、不展示卡片时无需 renderer）；**auto-run action 仅当能提供 renderer 给不了的东西时才加**（renderer 已展示+一键复制某值时，禁止再加返回同值的冗余 copy-action）。 |
| 5 | 验证门槛 | **`npm run verify` 全绿**（typecheck+lint+build+verify-build + 精简冒烟测试）。模板里写死 id 的机关与测试改写成匹配新插件。 |
| 6 | skill 结构 | **工作流 + 精简脚本 + 通用脚手架**（方案 A）。 |
| 7 | 落地位置 | 项目内 `.agents/skills/clipbus-plugin-generator/`，随仓库版本化；客户端目录仅作链接。 |
| 8 | 预览工作台 | **保留**（支持 `npm run dev` 看 UI，服务视觉优先级），每个 feature 自带一个 preview scenario。 |

## Skill 文件结构

```
.agents/skills/clipbus-plugin-generator/
├── SKILL.md                  ← 主工作流（精简，<300 行），描述触发条件 + 七阶段流水线
├── DESIGN.md                 ← 本文
├── scripts/
│   ├── survey.mjs            ← 扫描合集现状，输出 JSON：已有插件 / 类别 / 已占用 plugin.id 与 attachmentType / 各插件功能点
│   └── scaffold.mjs          ← 从 template-plugin 派生「干净通用基线」到 clipbus-{topic}-plugin/
└── references/
    ├── architecture.md       ← 两侧架构 + 四扩展点 + 接线不变量速查（浓缩自根 CLAUDE.md，含「dir 名===能力 id」通用约定）
    ├── authoring-guide.md    ← 写真实 detector/renderer/action 的模式、payload 范式、视觉规范、冒烟测试范式
    └── topic-ideas.md        ← 按类别的实用选题点子库，兼作归类词表
```

## 七阶段流水线（SKILL.md 主体）

### 阶段 0 · 前置
- 确认在合集仓库根（存在 `template-plugin/`）。
- 解析调用意图：用户是否给了选题？是否要求全自主（关键词如"自动选题/直接生成/全自主"）。

### 阶段 1 · 勘察（survey.mjs）
- 运行 `node scripts/survey.mjs <repo-root>`，得到：已有 `clipbus-*-plugin` 列表、各自类别与功能点（读 manifest + README + 根 `README.md`）、**已占用的 plugin.id / attachmentType / 目录名**（避免命名碰撞）。

### 阶段 2 · 选题与归属
**先自由选题，再 survey 驱动归属**（`topic-ideas.md` 仅灵感、非约束；归属看现有插件真实职责）。
- **默认模式**：提 2-4 个候选，每个给：一句卖点、定位（实用/视觉/整活）、**归属决策**（survey 里并入哪个现有插件 / 或新建 `clipbus-{topic}-plugin`）、要实现的扩展点。等用户选定。
- **全自主模式**：自动挑一个现有插件未覆盖的 feature，**新建前过硬门控**（逐一列候选宿主 + 各自不契合的理由，写不出就并入最接近者），直接继续。
- **给定选题**：直接做 survey 驱动归属。
- 归属经验法则：被动检测+展示（detector/renderer）的 feature 并入 detector 域插件，用户主动调用（action）的 feature 并入 action 域插件；同一职责域只一个插件。

### 阶段 3 · 落地基线
- **新建**：`node scripts/scaffold.mjs <topic>` 从 template 派生干净通用基线（见下）。
- **扩展已有**：进入目标插件目录，准备新增 feature（不跑 scaffold）。

### 阶段 4 · 实现能力（实用优先）
- 按选题需要选扩展点；**要展示的附件必配 renderer**（只做搜索投影的 detector 除外）。
- 每个 feature：`payload.ts`（类型/契约/create/decode/version）→ Runtime detector/Action 函数 → renderer 的 `app.vue` + `main.ts` + `index.html`→ 一个 preview scenario。
- **目录名 === manifest 能力 id**（见通用约定）；同步 `manifest.json` 与 `src/plugin.ts` 注册。
- 视觉：只用 `var(--clipbus-*, 回退)` 主题 token，适配明暗，版式干净。
- 写**精简冒烟测试**（见 authoring-guide）。

### 阶段 5 · 验证闭环
- 新插件目录 `npm install`（拉 SDK）→ **先读 `node_modules/@clipbus/plugin-sdk/API.md` 校准能力签名**（API.md 为准，本仓库示例可能滞后）→ `npm run verify`。
- 修到 typecheck/lint/build/verify-build/冒烟测试**全绿**。扩展场景是整插件重验。

### 阶段 6 · 更新目录
- 更新目标插件 `README.md` 功能清单（英文）；**同步更新根 `README.md`（英文）与 `README_zh.md`（中文）两个索引**条目（简述 + 链接）。不存在则创建。

### 阶段 7 · 汇报
- 列出：插件目录、新增/变更能力、验证结果（命令 + 结论）、索引更新。

## 通用脚手架与契约

scaffold.mjs 从模板整体复制，排除依赖、构建产物、内部 git 和缓存；删除全部演示 feature、演示测试以及只用于演示的 shared/PNG 工具。
保留配置、base.css、useCard、通用测试 harness、Runtime 构建与安装脚本，并替换为 generator 的通用 UI 构建和校验资产。
生成 schema 5 空能力清单、函数式 definePlugin、V2 卡片 scenario 入口与构建产物接线测试。renderer page 从 manifest 推导。
业务实现与实际预览由后续阶段补齐，不能用占位组件交付。

当前架构见 references/architecture.md，实现范式见 references/authoring-guide.md。
Runtime 的 detector/Action id 与 manifest 一致；卡片不注册 Node handler。
附件类型和搜索 scope 必须声明 writes；输入只有 text/image。只为搜索或交互状态存数据时不必添加 renderer。
按需要组合贡献，避免与卡片复制按钮冗余的 Action；Action 没有表单 UI。

测试保留业务向量并加载构建产物验证 ctx 写入、结果和消息。
preview 使用各 feature 的真实 payload 与组件，并通过 SDK computeBootstrap 验证 V2 快照。

## 模型分工（遵循用户偏好）

- 设计（本文）：opus。
- `survey.mjs` / `scaffold.mjs`（确定性代码）：sonnet(max effort) 实现，opus 审核。
- `SKILL.md` / `references/*`（指令性内容）：opus 直接撰写。
- skill 跑通后由 skill-creator 的 eval 流程验证触发与产出质量。

## 非目标 / YAGNI

- 不做重 codegen 模板引擎；真实逻辑由模型写。
- 不强行四扩展点全覆盖。
- 不修改 `template-plugin` 本身（除非用户另外要求）；通用化只发生在派生出的新插件里。
- 不在本产品仓库引入 `docs/superpowers/` 等外部脚手架目录，skill 相关产物都收在 `.agents/skills/` 下。
