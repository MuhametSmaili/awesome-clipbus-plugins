# 插件开发指南（脚手架工作流）

*[English](./GUIDE.md) · 中文*

本工程（`clipbus-text-plugin/`）提供九个 Clipbus 文本变换 Action，基于 SDK 2.0.0 与协议 V2（manifest schema 5）。本文件只讲**脚手架工作流**（起步、本地开发、在 Clipbus 中调试、构建、测试）与**工程结构**。

**插件开发的权威知识**（架构、manifest、SDK 入口、detector/renderer/action、入参形状、消息、坑点）**随 SDK 包发布**，`npm install` 后在 `node_modules/@clipbus/plugin-sdk/docs/`——它始终对应你当前安装的 SDK 版本。

- **AI / 工具**：请先读本工程根目录的 [`AGENTS.md`](./AGENTS.md)，它指向 SDK 文档的稳定入口。
- **文档地图**：`node_modules/@clipbus/plugin-sdk/docs/README.md`
- **capability 真相源**：`node_modules/@clipbus/plugin-sdk/API.md`（generated，有冲突以它为准）
- 通过 `npm update @clipbus/plugin-sdk` 刷新文档与能力，**无需替换本工程任何文件**。

> 本工程内的代码与说明是**示例**，可能滞后于已安装的 SDK；与 SDK 文档冲突时**以 SDK 文档为准**。

---

## 0. 快速开始

### 前置条件

- Node.js >= 18

### 初始化

```sh
npm install
```

依赖 `@clipbus/plugin-sdk` 是独立发布的 npm 包（三方工程通过 `npm install @clipbus/plugin-sdk` 安装）。`npm install` 会拉取并编译 SDK，完成后即可直接使用。

> 所有插件作者可用的符号由 codegen 产出，列在 SDK 包的 `API.md` 与 `README.md`（见 [`@clipbus/plugin-sdk`](https://www.npmjs.com/package/@clipbus/plugin-sdk)）。**插件作者不需要查看或修改 SDK 内部源码。**

### 本地开发

```sh
npm run dev
```

启动 Text Tools 预览页。九个 Action 均无 WebView，该页面列出它们的标题，并说明如何在 Clipbus 中运行。此插件没有 renderer 或 Action UI 场景。

### 在 Clipbus 中调试

Clipbus → Settings → Plugins → Developer Plugins 区段提供开发插件生命周期管理：

1. **Add Path** — 选择含 `manifest.json` 的目录（即 `sourceRootPath`）。
2. 若 `manifest.json` 声明了 `install` 字段，Clipbus **自动执行安装脚本**，工作目录为 `sourceRootPath`。`node_modules/` 等产物落到工程目录（等价于你手动 `npm install`）。
3. 安装日志写入 `<AppData>/development-plugins/<pluginID>/install-logs/`，不会污染你的 git status。

| 按钮 | 行为 |
|---|---|
| **重新加载** | 重读 `manifest.json`，刷新插件元数据与加载状态。**不**重跑 install。 |
| **执行安装** | 就地重跑 install hook，更新 `lastInstallExecution`。**不**重读 manifest。 |
| **查看日志** | `installFailed` 状态下显示，打开最近一次安装日志（支持实时 tail）。 |

状态：`installing` → 安装中；`installFailed` → 退出码非 0 或 runtime 不可达；`ready` → 可用。

### 生产构建

```sh
npm run build
```

依次：typecheck → lint → clean → build:runtime → build:ui → verify:build，输出到 `dist/`。此插件没有需要打包的卡片页。

### 校验插件

```sh
npm run verify
```

依次执行：**manifest 校验 → 构建 → runtime manifest 校验 → 测试**。

manifest 校验步骤（`npm run verify:manifest`）会在构建前检查 `manifest.json` 的结构
问题——命名空间违规、不支持的 schemaVersion、legacy 字段、非 canonical 类型等。
这些错误与宿主安装时的校验规则一致，开发期即可拦截。

也可以单独运行 manifest 校验：

```sh
npm run verify:manifest
# 或直接调用 SDK 命令行：
npx clipbus-validate-manifest .
npx clipbus-validate-manifest . --runtime  # 额外检查构建产物是否存在
```

### 测试

```sh
npm test         # tests/runtime/ 与 tests/integration/；先执行 npm run build
```

---

## 1. 工程结构

文本变换代码的结构：

```text
clipbus-text-plugin/
├── manifest.json                       ← 九个文本 Action，无 renderer 或 detector
├── package.json                        ← @clipbus/plugin-sdk ^2.0.0
├── scripts/                            ← runtime 构建与 manifest 驱动的 UI 校验
├── src/
│   ├── features/line-tools/
│   │   ├── transforms.ts               ← 纯文本变换，包括 Unicode 字素处理
│   │   ├── sort.ts / dedup.ts / trim.ts ← ActionHandler 工厂函数
│   │   ├── strip-ansi.ts
│   │   ├── reverse-lines.ts / reverse-characters.ts / sort-characters.ts
│   │   └── json.ts                     ← Pretty JSON 与 Minify JSON
│   ├── shared/                         ← 共享主题样式与卡片辅助函数
│   ├── preview/preview-host/           ← 插件使用说明页
│   └── plugin.ts                       ← definePlugin({ actions })
└── tests/                              ← 纯函数、构建后 runtime 与预览检查
```

Action 接收 `{ item, content }`，其中 `content` 是当前 Flow 级联值；通过 `result.text(output, message)` 或 `result.none(message)` 返回结果。此插件不写附件、搜索条目、标签或置顶状态，因此 `writes` 列表为空。

> SDK 是独立包 `@clipbus/plugin-sdk`，由 codegen 同步、**不要手动改**。扩展 capability 见包内 `SPECIFICATION.md`（[`@clipbus/plugin-sdk`](https://www.npmjs.com/package/@clipbus/plugin-sdk)）Ch 3。

---

## 接下来

脚手架工作流就这些。**插件实现的全部知识在 SDK 文档**——见根目录 [`AGENTS.md`](./AGENTS.md)，或直接打开 `node_modules/@clipbus/plugin-sdk/docs/README.md`（文档地图）与 `node_modules/@clipbus/plugin-sdk/API.md`（capability 真相源）。


