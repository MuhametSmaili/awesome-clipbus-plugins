# Vibe 插件开发指南

*[English](./GUIDE.md) · 中文*

本目录是 Vibe 插件，目标版本为 `@clipbus/plugin-sdk ^2.0.0`、插件协议 V2、manifest schema 5。先读 [AGENTS.md](./AGENTS.md)，再读已安装 SDK 的 `docs/README.md` 与 `API.md`。仓库示例与 SDK 文档冲突时，以已安装版本的 API 为准。不要查看或修改 SDK 实现源码。

## 安装与预览

使用已安装 SDK 要求的 Node 版本，在 `clipbus-vibe-plugin/` 中运行：

```sh
npm install
npm run dev
```

SDK 预览工作台会挂载真实的 Vibe Vue 组件和 Three.js 动画。四个 scenario 保留原有的普通文本与短单词示例，并演示动画列表排序与单动画设置。工作台提供主题、宽度、宿主卡片外框和按钮、启动快照及宿主调用日志。

scenario 中的设置使用去除插件前缀后的结构：

```ts
settings: { animations: ["text-loop", "particle-core"] }
```

宿主文件中对应的键仍为 `plugin.vibe.animations`。`ctx.settings.get<{ animations?: unknown }>()` 返回 `{ values }`，读取 `values.animations`。宿主文件位置与动画行为见 [README_zh.md](./README_zh.md)。

## Runtime 与卡片接线

detector 从 `input.item.attachments` 读取 `{ type, key, updatedAt, own }` 引用。存在其他插件的引用时，本次不写入；只有自身引用时，recopy 仍完整重写。成功且不写入会清空此 detector 上次的产出。判断依据为本次快照；其他 detector 此后写入的附件会在下次检测时参与判断。

`payload.ts` 定义类型化附件契约与纯 payload 函数。detector 必须 await `vibeAttachment.set(ctx, [{ key, payload }])`。附件类型声明在 `writes.attachmentTypes`；Vibe 不写搜索扩展。

manifest 声明 renderer 的页面、标题、颜色、按钮与固定高度 `{ min: 220, max: 220 }`。卡片无需注册 Runtime handler。页面从 `@clipbus/plugin-sdk/view` 导入 `ctx`，通过 `useCard(vibeAttachment)` 获取启动数据并订阅条目与环境事件。按钮使用 `ctx.renderer.update` 发布，点击事件通过 `ctx.renderer.onButton` 的 `event.id` 识别。卸载时取消订阅并释放当前动画资源。

## 构建与校验

```sh
npm run verify
```

依次执行 manifest 校验、类型检查、lint、Runtime/UI 构建、构建接线检查、产物 manifest 校验与 Node 测试。测试保留 payload 和动画切换业务向量，通过 `tests/support/plugin.cjs` 运行构建后的 detector，并使用 SDK 的 `computeBootstrap` 校验真实 V2 scenario。

`npm run build` 会在当前目录重建 Clipbus 实际加载的 `dist/`。`npm test` 需要先生成 Runtime 产物。共享 UI 构建和验证脚本由 manifest 驱动；公共基础设施的改动应交给仓库的维护源处理。

## 在 Clipbus 中调试

1. 打开 Settings → Plugins → Developer Plugins → Add Path，选择本目录。
2. Reload 重读 manifest；Run Install 重跑安装钩子。
3. 源码修改后，在本目录重建 `dist/` 并重新加载。跨插件检测顺序需在真实宿主确认。

## 文件结构

- `manifest.json`：插件身份、写入声明、detector 与卡片默认值。
- `src/plugin.ts`：Runtime detector 注册。
- `src/features/vibe-fallback/`：附件契约、detector、卡片、切换逻辑和三种动画实现。
- `src/shared/composables/useCard.ts`：共享 V2 卡片订阅。
- `src/preview/`：真实预览场景与组件挂载。
- `tests/runtime/`、`tests/integration/`、`tests/support/`：业务校验、预览验证与 Runtime harness。
