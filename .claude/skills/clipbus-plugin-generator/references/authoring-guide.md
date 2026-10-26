# Feature 编写指南（SDK 2.x / schema 5）

先在目标插件目录 npm install，再读 SDK docs/README.md、API.md 与相关主题文档。下列是合集接线约定，签名与限额以安装包为准。

## 1. 目录与命名

有卡片页的 feature 使用 src/features/<renderer-id>/：
payload.ts（类型/契约/构造/解码）、detector.ts（可选）、app.vue、main.ts、index.html。
Runtime-only Action 可独立目录，无页面。renderer 没有 Runtime handler 文件。
Runtime 相对 import 带 .ts。main.ts 从 /dom 导入 forwardConsole/reportInputState，从 Vue 挂载实际 app.vue；
index.html 引用 ./index.js 与 ./index.css。

## 2. payload.ts 必须跨端安全

从 @clipbus/plugin-sdk 根入口导入 defineAttachment 与 defineMessage；payload 是结构化对象，建议保留 kind/version。
create*Payload 负责业务构造，不匹配返回 null；decode*Payload 接收 unknown 并验证预期形状，坏数据返回 null。
不要把泛型当运行时校验。需要 Node 的哈希/读文件等放 Runtime-only builder，页面不得 import 它。

```ts
import { defineAttachment } from "@clipbus/plugin-sdk";
export interface ParsedPayload { version: 1; value: string }
export const parsed = defineAttachment<ParsedPayload>("plugin.example.parsed");
```

只保存结构化检测结果；大段原文需要时从 ctx.item.getContent() 读取。按 UTF-8/JSON 字节预算 payload。
文本 Base64 解码须验证 UTF-8 无损往返及可显示字符比例；覆盖无效 UTF-8、控制字符与非 ASCII 正常文本。

## 3. detector

```ts
import type { DetectorHandler } from "@clipbus/plugin-sdk/runtime";
import { parsed, createParsedPayload } from "./payload.ts";

export const detect: DetectorHandler = async (input, ctx) => {
  const payload = createParsedPayload(input);
  if (payload === null) return;
  await parsed.set(ctx, [{ key: "primary", payload }]);
  await ctx.item.setSearchExtension({
    scope: "parsed", entries: [{ key: "primary", text: payload.value, label: "Parsed value" }],
  });
};
```

在 manifest 声明 writes.attachmentTypes 与 writes.searchScopes。搜索文本超过限额时按需要裁剪或预算拆分，
不要依赖宿主截断。detector 不返回数组；成功运行的全部写入整体替换旧结果，recopy 不能直接跳过。
不匹配时不写；失败/超时保留旧输出。UI/消息状态用独立类型，避免与 detector 输出出现重复卡片。
附件仅本地保存；搜索扩展参与同步。

## 4. 卡片外观

manifest.renderers[].page 通常为 dist/ui/renderers/<id>/index.html。
height 为 {min?,max?}，固定高度用相同的 min/max；title/tint/buttons 是宿主首次显示的默认外观。
动态外观写入附件 card，或在页面调 ctx.renderer.update。省略 card 保留原外观，null 清空。
不要再为 renderer 写 Node resolve 函数，也不要注册到 Runtime。

## 5. Vue 卡片

```ts
import { computed, onMounted, onUnmounted, ref } from "vue";
import { ctx } from "@clipbus/plugin-sdk/view";
import { autoFit } from "@clipbus/plugin-sdk/dom";
import { useCard, useCardButton } from "../../shared/composables/useCard";
import { parsed } from "./payload";

const card = useCard(parsed);
const value = computed(() => card.attachment.value.payload.value);
useCardButton("copy", () => ctx.system.copyText({ text: value.value }));
const rootEl = ref<HTMLElement | null>(null);
let stop: (() => void) | undefined;
onMounted(() => { stop = autoFit({ target: rootEl.value ?? undefined }); });
onUnmounted(() => stop?.());
```

useCard 从 ctx.renderer.context 初始化，再随 item.changed/env.changed 更新；不要在 module 顶层缓存快照。
Host 按钮用 ctx.renderer.onButton，事件字段 id；复制/打开链接用 ctx.system。
输入框存在时入口调 reportInputState；需要转发 console 时调 forwardConsole。

## 6. Runtime Action

```ts
import { result, type ActionHandler } from "@clipbus/plugin-sdk/runtime";
export const uppercase: ActionHandler = async ({ content }) =>
  content.kind === "text" ? result.text(content.text.toUpperCase(), "Converted") : result.none();
```

Action 输入 {item,content}：item 固定为 Flow 起点，content 是当前级联值。图片从 ctx.input.imagePath() 读当前输入，
不能用起点 item 的图片替代。图片输出写入 ctx.plugin.path("cache/…")，返回 result.image("cache/…")。
不要修改宿主提供的只读输入文件。消息与 Action 并发运行时，用唯一输出名避免覆盖。
Action 没有表单 UI；需要宿主未支持的能力时明确说明限制，不生成虚假入口。

## 7. 消息、文件与错误

共享 defineMessage<Req,Resp>(name)，Runtime messages: [contract.handle(fn)]，卡片 contract.call(data)。
消息处理时 ctx.item 是卡片条目，写入 await 后随调用成功提交。ctx 不可跨调用保存。
页面的 ctx.item 写入与 ctx.system 操作立即生效；Runtime 提交各类写入时不是跨数据库原子回滚。

Node 文件写进 data/ 或 cache/；通过插件内相对路径传给页面，显示时 ctx.asset.fileUrl(path)。
ctx.asset.itemImageUrl() 显示卡片条目图片。cache 可能被清理，持久数据使用 data/。
区分 PluginRemoteError（插件处理函数错误）与 PluginProtocolError（宿主错误）；不要解析固定错误文案。

## 8. 高度与滚动

非固定高度卡片必须启用 /dom 的 autoFit 并传实际内容尺寸元素 target，卸载时停止观察。
target 不设置固定高度或 height:100%；预览工作台的 document.body 不是卡片。
内容可能超出 max 时用外层滚动容器撑满可用高度，内层自然增长供 autoFit 观察。
避免整张卡片永久停在最小高度，也避免每帧上报同样高度的循环。

## 9. Runtime 注册

definePlugin({detectors: {"<detector-id>": detect}, actions: {"<action-id>": handler}, messages: [...]})。
key 与 manifest 一致，setup 仅在需要初始化时使用。renderer 没有 Runtime key。
writes 的命名空间与声明在宿主调用时也校验，build 通过不能代替业务写入测试。

## 10. preview 必须接实际组件

每个 renderer 至少一个 PreviewScenario，保留真实样例，renderer 默认值与 height 从 manifest 取。
scenario.view 可用于组件路由，mount 必须挂载该组件并返回 unmount；缺映射应报错，不能留下死占位。

```ts
{
  id: "sample", label: "Parsed sample", view: "parsed-renderer",
  plugin: { id: "plugin.example", version: "0.1.0" },
  item: {
    id: "item-1", kind: "text", tags: [], pinned: false, createdAt: 1, lastCopiedAt: 1,
    attachments: [{ type: parsed.type, key: "primary", updatedAt: 1, own: true }],
  },
  content: { kind: "text", text: "sample" },
  attachment: { type: parsed.type, key: "primary", updatedAt: 1, own: true, payload },
  renderer: { title: "Parsed value", buttons: [{ id: "copy", title: "Copy" }] },
  height: { min: 120, max: 400 },
}
```

item.attachments 只放引用；payload 放 scenario.attachment。消息替身使用 scenario.messages。
纯 Runtime Action 插件显示无卡片预览的说明。fake Host 不检查 writes 声明、总量预算或真实文件/系统副作用；
实际验收仍以宿主为准。测试可通过 esbuild 打包 scenarios，再调用 SDK computeBootstrap 校验接线。

## 11. 视觉与文案

所有用户可见文案与插件 README.md 用英文；根索引英文/中文同步更新。
plugin.title 是人类可读类别名，README H1 与之对应；detector 标题用 "<X> Detector"，renderer 标题为内容名词。
CSS 颜色只用 var(--clipbus-*, 回退值)，支持明暗主题。宿主负责标题/外框/按钮，内容区透明、贴边，
根与顶层 section 水平 padding 为 0；只有有独立边框/底色的子盒使用内部 padding。
保留层级、留白、文本折行与友好空态；按功能需要做 UI。

## 12. 测试

.cjs 使用 Node test runner。保留纯解析函数的业务向量；运行时测试通过 tests/support/plugin.cjs 加载 dist，
用 fakeHost 记录 ctx 调用，检查正确 payload、搜索项、声明、recopy、非匹配、Action 当前级联值与消息结果。
测试实际输出，不能删除断言、跳过测试或只匹配源码字符串来换取绿灯。
新增 UI 的 scenario 需覆盖实际组件，并在浏览器打开工作台检查主题、场景与按钮。

## 13. 完成门禁

目标插件目录 npm install → 读 SDK 文档 → npm run verify，修到全绿。
检查 lockfile 只出现所需依赖变化，保留无关平台元数据。更新插件 README 与根中英索引。
在用户实际加载目录重建 dist；只合并源码不会刷新宿主看到的产物。
