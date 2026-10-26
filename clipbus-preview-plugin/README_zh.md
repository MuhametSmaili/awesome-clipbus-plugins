# Preview — 预览工具

使用 SDK 2.x、插件协议 V2 和 manifest schema v5。

Clipbus 插件，检测剪贴板中的颜色值和 Markdown 文本，分别渲染带 WCAG 对比度分析的色块卡片或经过安全过滤的 HTML 预览卡片。

## 功能

### 颜色色块（`color-*`）

检测剪贴板文本中的单个 CSS 颜色值，渲染丰富的预览卡片。

- **检测器**（`color-detector`）：附件类型 `plugin.preview.color`。支持：
  - **十六进制**：`#rgb`、`#rgba`、`#rrggbb`、`#rrggbbaa`（短格式自动展开，保留 alpha 通道）
  - **RGB / RGBA**：`rgb(r, g, b)` 与 `rgba(r, g, b, a)`，通道值自动钳制
  - **HSL / HSLA**：`hsl(h, s%, l%)` 与 `hsla(h, s%, l%, a)`，转换为 RGB
  - **28 个 CSS 命名色**：`red`、`blue`、`orange`、`coral`、`tomato`、`salmon` 等（不区分大小写）
- **渲染器**（`color-swatch`）：固定高度 260px。展示：
  - 120px 色块，hex 标签自动选白或黑以达到更高 WCAG 对比度
  - HEX、RGB、HSL 等值（等宽字体）
  - 对白色和黑色的对比度比值，附 WCAG 等级徽章（AA ≥ 4.5:1，AAA ≥ 7:1）
  - "Copy All Formats"宿主按钮，一次复制三种格式字符串

### Markdown 预览（`markdown-*`）

检测剪贴板中的 Markdown 文本，渲染为经过安全过滤的 HTML 卡片。

- **检测器**（`markdown-detector`）：附件类型 `plugin.preview.markdown`。识别常见 Markdown 模式（标题、列表、代码块、加粗/斜体、链接）。
- **渲染器**（`markdown-renderer`）：将 Markdown 解析为安全 HTML（白名单过滤）。高度在 120px 到 480px 之间自适应内容。

## 本地开发

```sh
npm install
npm run dev       # Vite 预览工作台
npm run verify    # typecheck + lint + build + 测试
```

加载：Settings → Plugins → Developer Plugins → Add Path，选择此目录。
