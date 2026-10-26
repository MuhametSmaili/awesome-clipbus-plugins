# 插件开发指南（脚手架工作流）

*[English](./GUIDE.md) · 中文*

本工程（`clipbus-extractor-plugin/`）使用 SDK 2 / 插件协议 V2（manifest schema 5），提供六种文本检测器及其卡片页。本文件只讲**脚手架工作流**（起步、本地开发、在 Clipbus 中调试、构建、测试）与**工程结构**。

**插件开发的权威知识**（架构、manifest、SDK 入口、detector/renderer/action、入参形状、RPC、写入声明、坑点）**随 SDK 包发布**，`npm install` 后在 `node_modules/@clipbus/plugin-sdk/docs/`——它始终对应你当前安装的 SDK 版本。

- **AI / 工具**：请先读本工程根目录的 [`AGENTS.md`](./AGENTS.md)，它指向 SDK 文档的稳定入口。
- **文档地图**：`node_modules/@clipbus/plugin-sdk/docs/README.md`
- **capability 真相源**：`node_modules/@clipbus/plugin-sdk/API.md`（generated，有冲突以它为准）
- 通过 `npm update @clipbus/plugin-sdk` 刷新文档与能力，**无需替换本工程任何文件**。

> 本工程内的代码与说明是**示例**，可能滞后于已安装的 SDK；与 SDK 文档冲突时**以 SDK 文档为准**。

---

## 0. 快速开始

### 前置条件

- Node.js 26（测试依赖原生 TypeScript 类型剥离）

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

启动 SDK V2 预览工作台，九个真实场景覆盖六种提取器卡片。在 Scenario 菜单选择样例；`?scenario=<id>` 可在刷新后恢复。修改 `src/features/*/app.vue` 后浏览器热更新。

### 在 Clipbus 中调试

Clipbus → Settings → Plugins → Developer Plugins 区段提供开发插件生命周期管理：

1. **Add Path** — 选择含 `manifest.json` 的目录（即 `sourceRootPath`）。
2. 若 `manifest.json` 声明了 `install` 字段，Clipbus **自动执行安装脚本**，工作目录为 `sourceRootPath`。`node_modules/` 等产物落到工程目录（等价于你手动 `npm install`）。
3. 安装日志写入 `<AppData>/development-plugins/<pluginID>/install-logs/`，不会污染你的 git status。

| 按钮 | 行为 |
|---|---|
| **重新加载** | 重读 `manifest.json`，刷新 fingerprint / writes / loadState。**不**重跑 install。 |
| **执行安装** | 就地重跑 install hook，更新 `lastInstallExecution`。**不**重读 manifest。 |
| **查看日志** | `installFailed` 状态下显示，打开最近一次安装日志（支持实时 tail）。 |

状态：`installing` → 安装中；`installFailed` → 退出码非 0 或 runtime 不可达；`ready` → 可用。

### 生产构建

```sh
npm run build
```

依次：typecheck → lint → clean → build:runtime → build:ui → verify:build，输出到 `dist/`。

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
npm test         # tests/runtime/ 集成测试
```

---

## 1. 工程结构

新插件按 feature 切分，每个 feature 一个自洽目录。推荐布局：

```text
your-plugin/
├── manifest.json
├── package.json                        ← 依赖 @clipbus/plugin-sdk（npm 安装）
├── scripts/                            ← build:runtime / build:ui / verify:build
├── src/
│   ├── features/<feature-name>/        ← 每个能力一个文件夹
│   │   ├── payload.ts                  ← payload 类型 / 附件 contract
│   │   ├── detector.ts                 ← detector（若有）
│   │   ├── app.vue                     ← renderer 卡片页
│   │   ├── main.ts / index.html        ← Vite 入口
│   ├── shared/                         ← 跨 feature 的薄工具层
│   ├── preview/                        ← 本地预览工作台（dev-only）
│   └── plugin.ts                       ← definePlugin 入口；注册 detector 函数
└── tests/runtime/
```

六种提取能力见 [README_zh.md](./README_zh.md)。

> SDK 是独立包 `@clipbus/plugin-sdk`，由 codegen 同步、**不要手动改**。扩展 capability 见包内 `SPECIFICATION.md`（[`@clipbus/plugin-sdk`](https://www.npmjs.com/package/@clipbus/plugin-sdk)）Ch 3。

---

## 接下来

脚手架工作流就这些。**插件实现的全部知识在 SDK 文档**——见根目录 [`AGENTS.md`](./AGENTS.md)，或直接打开 `node_modules/@clipbus/plugin-sdk/docs/README.md`（文档地图）与 `node_modules/@clipbus/plugin-sdk/API.md`（capability 真相源）。


