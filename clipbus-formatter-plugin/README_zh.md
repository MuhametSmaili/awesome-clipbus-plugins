# Formatter — 格式化工具

Clipbus 插件，自动检测剪贴板中的 JSON、XML、CSV 文本并格式化展示，支持一键复制。

## 功能

### JSON（`json-*`）

- **JSON 检测器**（`json-detector`）：用 `JSON.parse` 解析剪贴板文本；识别到对象或数组时挂载 `plugin.formatter.json` 附件。
- **JSON 格式化渲染器**（`json-renderer`）：卡片展示顶层类型（object/array）、键/条目数，以及 2 空格缩进格式化 JSON，支持 Pretty、Min、YAML 视图，可复制当前格式。

### XML（`xml-*`）

- **XML 检测器**（`xml-detector`）：识别有效 XML 标签结构（元素对、文档声明、注释），挂载 `plugin.formatter.xml`。
- **XML 格式化渲染器**（`xml-renderer`）：卡片展示元素数、属性数、嵌套深度，以及缩进后的 XML，附"Copy Formatted"按钮。

### CSV 表格（`csv-*`）

- **CSV 检测器**（`csv-detector`）：识别列数一致的逗号分隔值，挂载 `plugin.formatter.csv`。
- **CSV 表格渲染器**（`csv-table`）：将数据渲染为带表头高亮的表格，支持 Table、JSON 视图以及 Markdown、JSON 复制，高度自适应内容。

本插件使用 SDK 2.x、插件协议 V2（manifest schema 5）。CSV 搜索表头按 4 KiB 上限截取并保留完整 Unicode 字符；CSV 或缩进展开后的 XML 附件超过 SDK 的 2 MiB 上限时不写入。\n\n## 本地开发

```sh
npm install
npm run dev       # Vite 预览工作台
npm run verify    # typecheck + lint + build + 测试（提交前全量门禁）
```
