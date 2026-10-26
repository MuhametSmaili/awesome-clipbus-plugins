# Decoder — 解码工具

Clipbus 插件，检测并解码剪贴板中的编码字符串，并提供可级联的编码与转义 action。

## 功能

### Base64（`base64-*`）

| 扩展点 | ID | 说明 |
|---|---|---|
| 检测器 | `base64-detector` | 识别标准 `+/=` 和 URL 安全 `-_` Base64，仅在解码结果是有效、可读的 UTF-8 文本时成功；二进制或乱码结果会被忽略 |
| 渲染器 | `base64-renderer` | 卡片展示：编码类型标记、字符数对比（原始 → 解码）、解码文本、"Copy Decoded Result"按钮 |

### JWT（`jwt-*`，仅本地解码，不验签）

| 扩展点 | ID | 说明 |
|---|---|---|
| 检测器 | `jwt-detector` | 识别三段式 `header.payload.signature` JWT 字符串 |
| 渲染器 | `jwt-renderer` | 卡片展示：算法标记、格式化 header/payload JSON、标准 claim 摘要、过期状态 |

### 编码与转义 Actions

10 个独立 action，提供 URL、HTML、Base64、Unicode、JSON 的 encode/decode 双向转换。每一步读取宿主当前级联文本，并把结果继续交给后续 action。

## 本地开发

```bash
npm install
npm run dev       # 启动预览工作台
npm run verify    # typecheck + lint + build + 测试（完整门禁）
```
