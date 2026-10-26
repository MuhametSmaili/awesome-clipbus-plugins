# Cron Explainer 开发指南

*[English](./GUIDE.md) · 中文*

本插件使用 SDK 2.0.0、插件协议 V2 和 manifest schema 5。检测器识别五字段 Cron 表达式，写入结构化调度附件和可搜索摘要；卡片展示表达式、字段说明、摘要及按本地时间计算的后五次执行时间。

已安装的 SDK 文档是权威来源：先读 `node_modules/@clipbus/plugin-sdk/docs/README.md`，签名和上限以 `API.md` 为准。修改实现前请读 [AGENTS.md](./AGENTS.md)。

## 开发与验证

在 `clipbus-cron-plugin/` 目录内执行：

```sh
npm install
npm run dev
npm run verify
```

Vite 预览使用“Weekdays at 9:30”真实场景挂载 Cron 卡片，启动快照与宿主采用相同的 V2 协议。场景的 `view: "cron-renderer"` 路由到卡片组件；`?scenario=cron-weekdays-morning` 选择该示例。

`npm run verify` 依次完成 manifest 校验、类型检查、lint、重建 `dist/`、产物路径校验以及业务、运行时和预览测试。测试使用 Node 原生 TypeScript 支持，请使用当前版本的 Node。单独运行测试时先构建：

```sh
npm run build
npm test
```

## 在 Clipbus 中调试

1. 打开 Settings → Plugins → Developer Plugins → **Add Path**。
2. 选择包含 `manifest.json` 的本目录。
3. 声明的安装钩子会在本目录运行 `npm install`。
4. 修改 manifest 或重建后使用 **Reload**；**Run Install** 重新安装依赖，**View Logs** 查看安装失败日志。

## 结构与契约

- `src/plugin.ts` 注册与 manifest 对齐的 `cron-detector`。
- `src/features/cron-renderer/payload.ts` 是共享附件契约、payload 构造与解码、表达式校验、字段展开和后续执行时间计算的单一来源。
- `detector.ts` 通过调用上下文写入 `plugin.cron.schedule` 附件及 `cron` 搜索 scope，输出均在 `writes` 声明。包括重复复制在内的每次检测均完整写入匹配结果。
- `app.vue` 通过 `useCard` 读取启动附件并跟随条目变化，每 30 秒刷新后续执行时间，按内容自动调整高度；卸载时清理订阅、尺寸观察和定时器。
- 卡片标题、颜色和高度默认值位于 `manifest.renderers`；页面路径为 `dist/ui/renderers/cron-renderer/index.html`。
- `src/preview/scenarios/attachmentScenarios.ts` 保留真实样例，从 manifest 派生渲染默认值，并将条目附件引用与 payload 分开。

解析器支持通配符、列表、范围、步长、月份名和星期名。为避免误判，至少一个字段须含 Cron 特殊字符。后续执行时间沿用日与星期同时受限时的 OR 规则，示例见 [README_zh.md](./README_zh.md)。
