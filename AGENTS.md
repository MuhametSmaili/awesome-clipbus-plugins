# AGENTS.md

## 仓库与权威文档

这是 Clipbus 插件合集：一个顶层 `clipbus-*-plugin/` 对应一个独立插件。
`template-plugin/` 是复制起点与完整示例，不是被依赖的库。根目录没有 package.json 或 workspace；安装、构建、测试都在插件目录中执行。

当前使用 `@clipbus/plugin-sdk ^2.0.0`、插件协议 V2、manifest schema 5。
动手前先在目标目录 `npm install`，再读：

- `node_modules/@clipbus/plugin-sdk/docs/README.md`：文档地图。
- `node_modules/@clipbus/plugin-sdk/API.md`：生成的签名、类型和限额真相源。
- `docs/migration-v1-v2.md`：旧插件迁移；文档中的 1.x 示例仍需按实际 2.x API 校准。
- `SPECIFICATION.md`：扩展协议的方法。

仓库示例与注释可能滞后，冲突以安装版本的 API.md 为准。不要查看或修改 SDK 实现源码。

## 技能目录

`.agents/skills/`、`.codex/skills/`、`.claude/skills/` 各保存一份内容完全一致的技能，随仓库提交。
新 clone 后即可直接使用，无需初始化、目录链接或启动 Hook。修改任一技能时同步更新三处；
`node .agents/scripts/check-skills.mjs` 和跨平台 CI 检查目录与文件内容一致。

## Shell 与常用命令

用户使用 zsh。依赖用户安装工具的命令通过 `/bin/zsh -ic '<command>'` 运行，保留交互式 zsh 的全部 PATH。

在目标插件目录：

```sh
npm install
npm run dev
npm run verify
npm run build
npm test
npm run typecheck
npm run lint
```

`verify` 依次执行 manifest 校验、类型检查、lint、Runtime/UI 构建、构建接线检查、产物 manifest 校验和 Node 测试。
`dist/` 被 gitignore，但宿主实际加载它；源码变更后必须在用户实际加载的目录重建。

## Runtime 与卡片页

- Runtime：`src/plugin.ts` 从 `@clipbus/plugin-sdk/runtime` 导入 `definePlugin`，构建成 CommonJS。导出 default 或裸对象都受宿主支持。
- Registry：`detectors`、`actions` 是 id → 函数；`messages` 是 `contract.handle(fn)` 数组。需要初始化才使用 `setup(context)`。
- detector：`async (input, ctx) => void`，通过 `ctx.item.setAttachments` / `setSearchExtension` 写入；不能返回旧 artifact。
- Action：`async ({ item, content }, ctx) => result.text/image/none(...)`。实际处理依据当前级联 `content`；`item` 与 `ctx.item` 始终指向 Flow 起点。
- 卡片：manifest `renderers[].page` 指向相对插件根目录的 HTML。卡片不注册 Runtime handler；外观来自 manifest 默认值与附件 `card`。
- 页面从 `@clipbus/plugin-sdk/view` 导入 `ctx`；用 `ctx.renderer.context(contract)` 读启动快照，随后订阅 item/env/button 事件。
- 共享契约从 SDK 根入口导入 `defineAttachment<T>` 与 `defineMessage<Req, Resp>`；页面消息用 `contract.call(data)`。
- 宿主已移除 Draft Action；Action 没有 lifecycle、表单页或 resolveSession。

## 接线不变量

1. detector / Action 的 manifest id 与 Runtime registry key 一一对应。
2. renderer 的 id 对应 `src/features/<id>/`，包含 main.ts、app.vue、index.html。通用构建脚本自动读取 manifest；renderer 不出现在 Runtime registry。
3. `page` 通常为 `dist/ui/renderers/<id>/index.html`；引用页内相对资源。每个输出页使用独立目录，避免构建清空互相覆盖。
4. 附件类型必须以 `plugin.id + "."` 开头，全部写入类型列在 `writes.attachmentTypes`；搜索 scope 列在 `writes.searchScopes`。
5. `scripts/build-ui.mjs` 与 `verify-build.mjs` 的通用版本来自 generator 的 `assets/scaffold/scripts/`。模板的 UI 构建版本含演示专用源映射，不能直接覆盖派生插件。
6. package.json 按字段合并 SDK/scripts/共享开发依赖，保留插件名称、说明与业务依赖。

## 数据、事件与限额

输入只有 `text` / `image`。payload 是结构化 JSON 对象；共享 payload.ts 不能导入 Node/DOM API，Node 运算放独立 Runtime 文件。
每条附件是 `{ type, key, updatedAt, own, payload, card? }`；item.attachments 仅包含引用 `{ type, key, updatedAt, own }`。
不要继续使用 payloadJson、owner、historyID、旧 topic 全局或权限字段。

Runtime 写入必须 await，处理函数成功后提交；ctx 在调用结束后失效。
detector 每次成功执行整体替换自己的附件和搜索结果，包含 recopy。本次不写意味着清空，不应通过直接 return 跳过重复复制。
页面/消息的交互状态使用独立类型，避免与 detector 输出产生重复卡片；编辑内容会清空所有附件。

按 SDK 2.0 限额预算：单 payload 2 MiB、每插件每条目合计 64 个附件/10 条搜索扩展、单条搜索文本 4 KiB。按 UTF-8 字节检查，不按 JS 字符数。最终数字以 API.md 为准。

## UI、preview 与验证

- CSS 使用 `var(--clipbus-*, 回退色)`；宿主绘制卡片外框/标题/按钮，页面根容器透明、水平 padding 为 0。
- 非固定高度卡片用 DOM `autoFit({ target })` 观察内容尺寸元素，卸载时停止；不要观察整个预览工作台的 document.body。高度是 `{ min?, max? }`，固定高度两者相等。
- 页面 DOM 辅助为 `forwardConsole`、`reportInputState`、`autoFit`。
- 每个 renderer 都要有真实 V2 PreviewScenario，并在 preview-host/main.ts 挂载实际组件。scenario 包含真实 plugin 身份、item 快照、结构化 attachment、manifest renderer 默认值与 height。保留各插件自己的示例。
- 纯 Runtime Action 插件显示无卡片预览说明。fake Host 不能代替真实宿主的文件、提交、写入声明及总量限额验证。
- 测试使用 Node .cjs；保留解析算法的业务向量，用构建后的 dist 运行 detector/Action/message 行为测试。公共 harness 为 tests/support/plugin.cjs；旧 tests/setup.cjs 已移除。

Clipbus 调试：Settings → Plugins → Developer Plugins → Add Path，选择有 manifest.json 的目录；Reload 重读配置，Run Install 重跑安装钩子。
