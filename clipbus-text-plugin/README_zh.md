# Text Tools — 文本工具

九个 auto-run 文本变换 action，适用于 [Clipbus](https://clipbus.app)。

## Action 列表

| ID | 标题 | 功能 |
|---|---|---|
| `text-sort` | Sort Lines | 按字母和数字顺序排序所有行（不区分大小写，自然排序）。 |
| `text-dedup` | Remove Duplicate Lines | 删除后续重复行，保留首次出现和原始顺序。 |
| `text-trim` | Tidy Whitespace | 修剪每行首尾空格、去除首尾空行、将连续 2 行以上空行折叠为单行。 |
| `text-strip-ansi` | Strip ANSI Codes | 移除终端文本中的 ANSI 转义序列，保留纯文本。 |
| `text-reverse-lines` | Reverse Lines | 反转所有行的顺序。 |
| `text-reverse-characters` | Reverse Characters | 反转所有用户可见字符，不拆开 emoji 或组合音标。 |
| `text-sort-characters` | Sort Characters | 按不区分大小写的自然顺序排列所有用户可见字符。 |
| `text-pretty-json` | Pretty JSON | 解析有效 JSON，并以两个空格缩进格式化。 |
| `text-minify-json` | Minify JSON | 解析有效 JSON，并移除无关空白。 |

九个 action 均为 `auto-run`（无 UI），仅作用于 `text` 类型的剪贴板内容，直接返回变换后的文本。纯空白内容输入时返回"无内容"结果，无效 JSON 返回 `Invalid JSON`。

## 本地开发

```sh
npm install
npm run verify   # typecheck → lint → build → 测试
```
