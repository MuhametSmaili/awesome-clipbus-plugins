# 能力撰写指南（阶段 4 跟着做）

实现真实、实用的 detector/renderer/action。下面给**可改写的骨架**——按选题替换逻辑，别照抄演示。**确切签名以 `node_modules/@clipbus/plugin-sdk/API.md` 为准**（装好 SDK 后先读它），本指南给的是经过样板验证的形状。

## 目录

1. [Feature 结构与命名](#1-feature-结构与命名)
2. [payload.ts：单一真相源](#2-payloadts单一真相源)
3. [detector](#3-detector)
4. [renderer（运行时）](#4-renderer运行时)
5. [renderer UI（app.vue）](#5-renderer-uiappvue)
6. [auto-run action](#6-auto-run-action)
7. [draft action](#7-draft-action)
8. [高度形态与 autoFit](#8-高度形态与-autofit)
9. [plugin.ts 注册](#9-plugints-注册)
10. [预览 scenario](#10-预览-scenario)
11. [视觉规范](#11-视觉规范)
12. [冒烟测试](#12-冒烟测试)
13. [验证闭环](#13-验证闭环)

---

## 1. Feature 结构与命名

**UI 承载能力（renderer / draft action）：目录名 === manifest 能力 id**，放 `src/features/<id>/`：

```
src/features/<renderer-id>/
├── payload.ts        # 数据形状 + create/decode/buildArtifact（detector 与 renderer 共用）
├── detector.ts       # 运行时（无 UI）
├── renderer.ts       # 运行时（无 UI）
├── app.vue           # UI
├── main.ts           # Vite 入口
└── index.html        # 生产外壳
```

detector / auto-run action 无 UI，运行时代码可与最相关的 renderer 同目录，或单放一个无 `main.ts/index.html` 的目录——`build-ui.mjs` 只对含 UI 的目录打包。**推荐与对应 renderer 同目录、共享 `payload.ts`**（detector.ts / action.ts 和 renderer 放一处），最省心。

> **相对 import 必须带 `.ts` 扩展名（否则冒烟测试挂）**：`.ts` 运行时文件之间（payload/detector/renderer/action）的相对 import **一律写 `.ts`**——冒烟测试用 Node 直接 `require()` 这些 `.ts`，Node 解析器不会自动补扩展名（`tsconfig` 已开 `allowImportingTsExtensions`，Vite/esbuild 也都接受）。例：`import { buildXArtifact } from "./payload.ts"`。`.vue` 文件内的 import 可不带（由 Vite 处理），引用组件用 `./app.vue`。

`main.ts` 与 `index.html` 固定写法：

```ts
// main.ts
import { patchConsole, patchTextInputState } from "@clipbus/plugin-sdk/dom";
patchConsole();
patchTextInputState();
import { createApp } from "vue";
import App from "./app.vue";
import "../../shared/base.css";
createApp(App).mount("#app");
```

```html
<!-- index.html：生产外壳，引用页内 ./index.css 与 ./index.js（verify-build 会检查） -->
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title><Topic> Renderer</title>
    <link rel="stylesheet" href="./index.css" />
  </head>
  <body>
    <div id="app"></div>
    <script src="./index.js"></script>
  </body>
</html>
```

## 2. payload.ts：单一真相源

附件 payload 以 JSON 存进 `payloadJson`。三函数 + `version`：

```ts
import type { PluginDetectorArtifact } from "@clipbus/plugin-sdk/runtime";

export interface XPayload {
  kind: "x_preview";        // 自定义判别串
  version: 1;               // 迁移用
  // …你的字段（解码结果、统计、转换输出等）
  display: { typeLabel: string; headline: string; subheadline: string; facts: { label: string; value: string }[] };
}

// 从 detector 输入构造 payload；不适用则返回 null（决定是否挂附件）
export function createXPayload(input: unknown): XPayload | null { /* … */ }

// 解析 + 校验；坏数据返回 null（renderer 容错用）
export function decodeXPayload(payloadJson: string | null | undefined): XPayload | null {
  try {
    const p = JSON.parse(payloadJson || "{}");
    if (p.kind !== "x_preview") return null;
    return p as XPayload;
  } catch { return null; }
}

// detector 产出的 artifact
export function buildXArtifact(input: unknown): PluginDetectorArtifact | null {
  const payload = createXPayload(input);
  if (!payload) return null;
  return {
    attachmentType: "plugin.<topic>.<feat>",   // 必须以 plugin.id 为前缀；宿主加载期强制，越界拒载（verify 查不出）
    attachmentKey: "primary",
    payloadJson: JSON.stringify(payload),
    // 可选：让内容进搜索
    searchProjection: { scope: "x", searchText: payload.display.headline, label: payload.display.typeLabel },
  };
}
```

复用 `src/shared/display.ts` 的 `mapContentKind / buildContentDisplay / buildItemDisplay / buildSearchText` 处理三种 kind 的展示，别重造。

### 2.1 payload 含 Node-only API：必须拆「UI 安全层 + runtime-only builder」

`payload.ts` 会被**两侧** import：runtime 的 `detector.ts`/`renderer.ts`，**以及浏览器 UI 的 `app.vue`**。所以 **`payload.ts` 里严禁出现 `import … from "node:*"`**（`node:crypto`、`fs`、`node:path`…）——Vite 打 UI 包时 Rollup 解析不到这些模块，`build:ui` 直接 `MISSING_EXPORT` 失败。

需要 Node API 算 payload（哈希、读文件等）时，拆成两个文件：

- **`payload.ts` —— UI 安全**：只放 payload 接口 + `decode*Payload()`（纯 JSON 解析，零 Node import）。`app.vue` 与 `renderer.ts` 都从这里 import。
- **`builder.ts` —— runtime 专用**：`create*Payload()` + `build*Artifact()`，把 `node:crypto` 等 import 隔离在此。只被 `detector.ts` / `action.ts` 与冒烟测试 import，**绝不被 `app.vue` import**。

```ts
// builder.ts（runtime-only；node:* import 只出现在这里）
import { createHash } from "node:crypto";
import type { PluginDetectorArtifact } from "@clipbus/plugin-sdk/runtime";
import type { XPayload } from "./payload.ts";          // 只借类型，UI 安全
export function createXPayload(input: unknown): XPayload | null { /* …用 createHash 算… */ }
export function buildXArtifact(input: unknown): PluginDetectorArtifact | null { /* …复用上面… */ }
```

```ts
// detector.ts / 测试 / plugin.ts 链路：从 builder.ts 取 create/build；renderer.ts / app.vue：从 payload.ts 取 decode
```

> **判别标准是「有没有 `import … from "node:*"` 语句」，不是「有没有用到 Node 全局」**。纯 `Buffer`（全局，无 import，如 `clipbus-decoder` 的 `Buffer.from(s, "base64")` 留在 `payload.ts` 内联）不触发 Rollup 解析、UI 也不调用到那条分支，所以无需拆；真正会炸 UI 构建的是 `node:*` 模块的 **import 语句**。完整实例见 `clipbus-inspector-plugin`（文本统计 + MD5/SHA-1/SHA-256，`payload.ts` UI 安全 / `builder.ts` 持有 `node:crypto`）。

## 3. detector

```ts
import type { PluginDetectorHandler, PluginDetectorInput, PluginDetectorArtifact } from "@clipbus/plugin-sdk/runtime";
import { buildXArtifact } from "./payload.ts";

export function createXDetector(): PluginDetectorHandler {
  return {
    async detect(input: PluginDetectorInput): Promise<PluginDetectorArtifact[]> {
      const a = buildXArtifact(input);          // content 在 input 上，扁平：input.content.{kind,text|width|entries…}
      return a ? [a] : [];
    },
  };
}
```

只在内容**真的匹配**时返回 artifact（如 decoder 检测到合法 base64 才挂）——不匹配返回 `[]`，别污染所有剪贴板项。

> **附件 vs 搜索投影（两面，互相独立）**：artifact 的 `attachmentType`+`payloadJson` 是**附件**——要展示成卡片就得配同 `attachmentType` 的 renderer。可选的 `searchProjection: { scope, searchText, label? }` 是**搜索投影**——把内容喂进宿主搜索索引让记录可被搜到（如 OCR 文本、解码结果），**不展示、不需要 renderer**。所以「detector 必配 renderer」不准确：detector 若**只为搜索**（不展示卡片），就只填 `searchProjection`、不建 renderer。搜索扩展写入受 `setSearchExtension` 权限门控（imperative 写法是 runtime verb `host.item.setSearchExtension`）。

## 4. renderer（运行时）

`resolveAttachment` 给宿主一点元信息（名字、色调、是否展示）；真正的渲染在 app.vue。

```ts
import type { PluginAttachmentRendererHandler, PluginResolveAttachmentInput, PluginAttachmentResolveResult } from "@clipbus/plugin-sdk/runtime";
import { decodeXPayload } from "./payload.ts";

export function createXRenderer(): PluginAttachmentRendererHandler {
  return {
    async resolveAttachment(input: PluginResolveAttachmentInput): Promise<PluginAttachmentResolveResult> {
      const payload = decodeXPayload(input?.attachment?.payloadJson);
      if (!payload) return { displayName: "<Topic>", tintHex: "#0F766E", shouldDisplay: false }; // 坏数据不展示
      return { displayName: "<Topic>", tintHex: "#0F766E" };  // shouldDisplay 省略=true
    },
  };
}
```

## 5. renderer UI（app.vue）

订阅宿主推来的附件 topic，decode，渲染；按钮经 `setButtons` + `onHostInvoke`。

```vue
<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import { clipbus } from "@clipbus/plugin-sdk/ui";
import type { PluginAttachmentPayload } from "@clipbus/plugin-sdk/ui";
import { useTopicRef } from "../../shared/composables/useTopicRef";
import { decodeXPayload } from "./payload";

const attachmentPayload = useTopicRef(clipbus.item.attachment);
const payload = computed(() =>
  decodeXPayload((attachmentPayload.value as PluginAttachmentPayload | undefined)?.attachment?.payloadJson));

let unsub: (() => void) | null = null;
onMounted(async () => {
  try {
    await clipbus.attachmentRenderer.setButtons({ buttons: [{ id: "copy", title: "复制结果" }] });
  } catch { /* 非附件上下文时 setButtons 会拒绝，忽略 */ }
  unsub = clipbus.attachmentRenderer.onHostInvoke.on(async (d) => {
    if (d?.buttonID === "copy" && payload.value) {
      await clipbus.clipboard.copyText({ text: /* 你的结果文本 */ "" });
    }
  });
});
onUnmounted(() => { unsub?.(); });
</script>

<template>
  <main class="shell">
    <section v-if="payload"> … 渲染 payload … </section>
    <div v-else class="empty"> 等待内容 </div>
  </main>
</template>

<style scoped>
/* 只用主题 token，见第 11 节 */
</style>
```

需要 JS 计算色（canvas 等）才用 `useTopicRef(clipbus.theme)` 拿 token 快照；纯 CSS 用 `var(--clipbus-*)` 即可。

## 6. auto-run action

> **先判断要不要加（按需！）**：auto-run action 要用户 **cmd+k 打开 action 面板再选中**才运行，比 renderer 的一键复制按钮多好几步。所以**当 detector+renderer 已展示某值并提供一键复制按钮时，不要再加一个 `runAutoAction` 返回同一个值的 copy-action——纯冗余**（用户永远走更快的 renderer 按钮）。auto-run action 只在能提供 renderer 给不了的东西时才合理：① 插件**无 detector/renderer**，action 是唯一入口（如 `clipbus-text-plugin` 的 sort/dedup/trim 纯文本变换）；② 产出 renderer **未覆盖**的另一种结果。展示型 feature（格式化/解码/转换/解析）通常**只配 detector + renderer，把复制做成 renderer 按钮**即可。

无 UI，处理后返回结果上下文。`resolveSession` 是 R13 后接口要求的桩。

```ts
import { actionResult } from "@clipbus/plugin-sdk/runtime";
import type { PluginAutoRunActionHandler, PluginAutoRunActionInput, PluginActionOperationResult, PluginActionResolveResult } from "@clipbus/plugin-sdk/runtime";

// auto-run 不弹表单，resolveSession 只是接口要求的桩；TS 允许实现比接口声明更少的参数，故可写 ()。
const resolveStub = async (): Promise<PluginActionResolveResult> => ({ buttons: [], initialDraft: {} });

export function createXAction(): PluginAutoRunActionHandler {
  return {
    resolveSession: resolveStub,
    async runAutoAction(input: PluginAutoRunActionInput): Promise<PluginActionOperationResult> {
      const out = /* 处理 input.content → 结果字符串 */ "";
      return actionResult.text(out, { userMessage: "已生成结果" });
      // 无结果时：return actionResult.none({ userMessage: "无可处理内容" });
    },
  };
}
```

## 7. draft action

需要用户输入/选择时用。Runtime 给初始会话，UI 管表单、提交。

Runtime：

```ts
export function createXDraftAction(): PluginAutoRunActionHandler {
  return {
    async resolveSession(_input, _ctx) {
      return {
        displayName: "<Topic>",
        buttons: [{ id: "submit", title: "提交", isEnabled: true }],
        defaultButtonID: "submit",
        initialDraft: { /* 初始表单 */ } as unknown as Record<string, unknown>,
      };
    },
    async runAutoAction() { return actionResult.none({ userMessage: "draft 由 UI 驱动" }); }, // 守卫桩
  };
}
```

UI（draft-action-ui/app.vue 要点）：

```ts
import { clipbus } from "@clipbus/plugin-sdk/ui";
import { useTopicRef } from "../../shared/composables/useTopicRef";
import { reactive, watch } from "vue";

const draftTopic = useTopicRef(clipbus.action.draft);  // 宿主推来的 draft
const draft = reactive({ /* 本地可编辑副本 */ });
watch(draftTopic, (d) => Object.assign(draft, d ?? {}), { immediate: true });

// 动态按钮：await clipbus.action.setButtons({ buttons: [...] })
// 提交：await clipbus.action.complete({ resultKind: "text", text }) // 或 image / none
// 宿主条按钮：clipbus.action.onHostInvoke.on(async (d) => { if (d.buttonID === "submit") … })
```

UI↔Node 自定义 RPC（如让 Node 干重活/生图）：Runtime 用 `defineMessage<Req,Resp>("<topic>.key").handle(fn)` 注册进 `messageHandlers`；UI `await clipbus.runtime.invoke({ key: "<topic>.key", payload })`。生成图片：`ctx.host.asset.allocateImageTempPath({ formatHint: "png" })` 拿宿主分配的会话路径 → Node 写入该路径 → `ctx.host.asset.registerImage({ path })` 得 `clipbus-asset://` URL → UI `<img :src>`（SDK ≥0.10.0：别写 `os.tmpdir()` 自造路径，Windows 只接受已分配路径）。宿主能力一律走 handler 收到的 `ctx.host`，SDK 0.10.0 起不再导出 `host` 单例。

> **视觉要贴合宿主**：draft action 的根 `<main>` 透明、无 `padding`，且**顶层 section 水平内距清零、内容贴边**（宿主 action 面板已自带 padding，否则双层内距）。详见 [§11 视觉规范](#11-视觉规范)。

## 8. 高度形态与 autoFit（非固定高度必须调 autoFit，否则内容被截断）

manifest renderer 的 `height` 三形态：
- 定值 `220`：固定高卡片。内容须自行装下或内部滚动；**不需要 autoFit**。
- `"auto"`：内容驱动（默认区间 [80,800]）。
- `{ min: 120, max: 480 }`：有界自适应。

**铁律：`"auto"` 与 `{min,max}` 两种都要求 UI 在 `onMounted` 显式调 `clipbus.window.autoFit()`，且**必须传 `target` = 自己的根元素**——SDK 不自动启动，不调就停在最小高度、内容被截断**（真实踩过：一批 renderer 声明 `"auto"` 却没调 autoFit，卡片全挤成一条、内容看不全）。推荐 `{min,max}`，调用值与 manifest 一致：

```ts
import { ref, onMounted, onUnmounted } from "vue";
import { autoFit } from "@clipbus/plugin-sdk/dom";

const rootEl = ref<HTMLElement | null>(null); // 模板根元素加 ref="rootEl"（如 <main class="shell">）
let stopAutoFit: (() => void) | null = null;
onMounted(() => {
  stopAutoFit = autoFit({ min: 120, max: 480, target: rootEl.value ?? undefined }); // 与 manifest 一致
});
onUnmounted(() => { stopAutoFit?.(); });
```

**务必传 `target`（内容尺寸的根元素，无 `height:100%`）。** autoFit 观察 `target` 的高度，clamp 到 `[min,max]` 后 `setHeight`（无宿主时 `.catch` 掉，dev 安全）。**不传 `target` 则量 `document.body`**——native 里恰好 = 插件内容（碰巧能用），但 dev 预览工作台里 `document.body` 是整个工作台页（`.cbp-wb` 为 `min-height:100%` 填满视口），autoFit 永不收敛、**每帧狂调 `setHeight` 死循环**（真实踩过，靠浏览器取证定位）。**内容超过 `max` 仍被截断**——可变长度的列表/表格要再套一个内部滚动容器：

```html
<div class="scroll-region"><!-- 长列表 / 宽表格 --></div>
<style scoped>.scroll-region { max-height: 360px; overflow-y: auto; }</style>
```

别在 `body` / 根 `<main>` 上加 `overflow`（会让 `scrollHeight` 失真、autoFit 量不准），也别用 `height:100%`（无定高父容器时塌陷）——让内容自然流动，只在需要滚动的**子区域**设 `max-height + overflow-y:auto`。

## 9. plugin.ts 注册

每个能力 id 注册到对应桶，**key === manifest id === 目录名**：

```ts
import { definePlugin } from "@clipbus/plugin-sdk/runtime";
import { createXDetector } from "./features/<rid>/detector";
import { createXRenderer } from "./features/<rid>/renderer";
import { createXAction } from "./features/<aid>/action";

export default definePlugin({
  setup() {
    return {
      detectors: { "<detector-id>": createXDetector() },
      attachmentRenderers: { "<rid>": createXRenderer() },
      actions: { "<aid>": createXAction() },
      messageHandlers: { /* …defineMessage 元组展开… */ },
    };
  },
});
```

## 10. 预览 scenario + preview-host 接线（必做，不是可选）

每个 renderer / draft action 都要在 `src/preview/scenarios/` 加一条 `PreviewScenario`，**并在 `preview-host/main.ts` 的 `COMPONENTS` 里映射到组件**——`npm run dev` 必须能看到真实组件渲染，缺这步 = 没做完（真实踩过：把这步当"可选打磨"，导致整批插件 preview 全是死占位）。SDK 0.8.5 起 `createPreviewWorkbench`（`@clipbus/plugin-sdk/preview`）接管整套工作台（scenario 选择器 / 4 主题 / native 卡片壳 / 宽度滑杆 / 按钮条 / fake host / wire 注入 / `--clipbus-*` 镜像 / 挂载-cleanup）。**不要再手写 `PreviewShellApp.vue`**（已废除）。每个 feature 只需补两处：

1. **scenario**（`scenarios/attachmentScenarios.ts` 或 `actionScenarios.ts`）加一条 `PreviewScenario`：
   - `mode: "attachmentRenderer"`（renderer）或 `"action"`（draft）；`pluginID: "<plugin.id>"`；`view: "<feature-dir>"`（路由用，= 目录名）。
   - `viewport` 取自 manifest height：`{min,max}`→`{ heightPolicy:'bounded', min, max }`、定值→`{ heightPolicy:'fixed', height }`、`"auto"`→`{ heightPolicy:'auto' }`。
   - renderer 的 `attachment` 嵌套为 `{ item, attachment: { historyID, owner:"<plugin.id>", attachmentType:"<manifest>", attachmentKey:"primary", payloadJson: JSON.stringify(createXPayload(...)) } }`（组件读 `attachmentPayload.value?.attachment?.payloadJson`）；draft 的 `draft` 是扁平初始 draft（spread 该 feature 的 `INITIAL_DRAFT`），配 `buttons` + `defaultButtonID`。
2. **preview-host/main.ts**：顶部 `import X from "../../features/<feature-dir>/app.vue"`，登记进 `COMPONENTS`，key = `<feature-dir>`（与 `scenario.view` 一致）。`mount` 适配器按 `scenario.view` 选组件。

数据怎么进组件（`createPreviewWorkbench` 已处理，知其所以然即可）：组件用 `useTopicRef(clipbus.item.attachment | clipbus.action.draft)` 读 SDK topic；harness 按 scenario 字段生成 wire payload 注入（与真实宿主同源），并把所有 `clipbus.*` native 调用记到「调用日志」、`window.setHeight` 驱动视口高度。纯 auto-run action（无 app.vue）无可预览 UI：**不调 `createPreviewWorkbench`**（它要求 ≥1 scenario），`main.ts` 渲染一句静态说明即可（见 text 插件）。权威文档：`node_modules/@clipbus/plugin-sdk/docs/preview.md`。真实视觉验收仍以宿主 Clipbus 内为准。

## 11. 视觉规范（优先级 #2）

- **只用主题 token**：`var(--clipbus-text-primary, #0f172a)`、`--clipbus-surface`、`--clipbus-surface-elevated`、`--clipbus-border`、`--clipbus-accent`、`--clipbus-text-secondary/tertiary` 等，**裸 hex 仅作 `var()` 回退**。自动适配明暗。
- 版式：留白舒展、层级清晰（eyebrow/title/facts）、长文本省略号、空态有友好提示。
- 实用为先但别将就：卡片要"能看"，与系统观感一致。
- **根容器透明 + 贴边（renderer 与 draft action 同此）**：宿主**已给 renderer 卡片和 action 面板都留了 native 内距**（实测：满宽分隔线与面板边之间留的就是这段宿主 padding）。所以 UI 根元素（`.shell` / `<main>`）**既不写 `background`**（保持透明、露出宿主底色，避免"卡中卡"色块割裂），**也不加 `padding`**（一律 `padding: 0`，否则双层内距、显得过满）。`base.css` 已对 `html/body/#app` 设 `margin:0` 且 `background:transparent`。
- **双层内距会下沉到 section 层（最易漏）**：根设成 `padding:0` 还不够——若**顶层布局 section**（根的直接子块、承载第一行内容的 controls/inputs/results/preview 等）自己又加水平 `padding`，内容照样比 native 多缩进一截（draft action 最常见的回归）。正确模型：**顶层 section 水平内距也清零、内容贴边**（垂直内距可留）；只有**有独立边框/底色的内部子盒**（结果 `<pre>`、输入框、match chip、facts / code-block / stat-tile 等）才用各自 `padding`。注意 `border-bottom` 分隔线无论 padding 都满宽，真正影响观感的是**内容**的水平 padding。工作样例见 `clipbus-decoder-plugin` 的 `base64-renderer`：`.shell{padding:0}`、`.content` 不写 padding、只有 `.decoded-block` 才 `padding:10px 12px`。

## 12. 冒烟测试

`tests/` 下 `.cjs`，Node test runner，`require()` 直接载 `.ts`（`--experimental-strip-types`），沿用 `tests/setup.cjs`。每插件至少覆盖：

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"); const path = require("node:path");
const root = path.resolve(__dirname, "..", "..");
const manifest = JSON.parse(fs.readFileSync(path.resolve(root, "manifest.json"), "utf8"));

test("manifest 能力都有 handler 注册", () => {
  // 读 manifest 各 id，require 各 feature 工厂，断言注册对象包含它们
});
test("detector 对样例输入产出预期 attachmentType 的 artifact", async () => {
  const { buildXArtifact } = require(path.resolve(root, "src/features/<rid>/payload.ts"));
  const a = buildXArtifact({ content: { kind: "text", text: "<样例>" } });
  assert.ok(a); assert.equal(a.attachmentType, "plugin.<topic>.<feat>");
});
test("renderer 对坏 payload 返回 shouldDisplay:false", () => {
  const { createXRenderer } = require(path.resolve(root, "src/features/<rid>/renderer.ts"));
  // resolveAttachment({ attachment: { payloadJson: "not-json" } }) → shouldDisplay:false
});
```

draft/auto-run：断言 `runAutoAction`/`resolveSession` 返回预期 `resultKind`/draft 形状即可。**精简但有意义**，别堆砌。

> 注意：① 冒烟测试**直接 require 各 feature 的工厂文件**（payload/detector/renderer/action），**别 require `src/plugin.ts`**——它用裸相对 specifier，Node strip-types 解析不了。② 测试向量选**真正有效**的样例（如 base64 要确认标准版与含 `-_` 的 URL-safe 版的差异），避免笔误造成假阴性。

## 13. 验证闭环

插件目录内：`npm install` → 读 `node_modules/@clipbus/plugin-sdk/API.md` 校准签名 → `npm run verify`，**修到全绿**。报错就按 systematic-debugging 找根因：常见是三处 id 没对齐、manifest height 与 autoFit 不一致、UI 裸 hex 被测试拦、payload decode 没容错、相对 `.ts` import 漏写 `.ts` 扩展名（Node require 时 `ERR_MODULE_NOT_FOUND`）、`payload.ts` 里 `import … from "node:*"` 污染 UI 构建（`build:ui` 阶段 Rollup `MISSING_EXPORT`，须按第 2.1 节拆 `builder.ts`）。
