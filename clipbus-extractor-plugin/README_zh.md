# Extractor — 提取工具

Clipbus 插件，自动提取剪贴板文本中的 URL、邮箱、IP 地址，解析单个 URL 的完整结构。

## 功能

### URL / 邮箱 / IP 提取（`entities-*`）

从剪贴板文本中自动检测 HTTP/HTTPS URL、电子邮件地址和 IPv4 地址，以分类卡片展示。

- **检测器**（`entities-detector`）：输入类型 `text`，附件类型 `plugin.extractor.entities`
- **渲染器**（`entities-renderer`）：按 URLs / Emails / IP Addresses 分组展示，每项可单独复制，附 Copy All 按钮

### URL 结构解析（`url-*`）

检测剪贴板中的 URL 或明确的裸查询字符串，并结构化展示。

- **检测器**（`url-detector`）：识别 URL，以及至少包含两个 `key=value` 对的裸查询字符串
- **渲染器**（`url-parsed`）：用同一张 URL Details 卡片展示 URL 组件或查询参数；保留重复参数，并支持复制 JSON 表示
- **跟踪参数清理**：识别 `utm_*`、`fbclid`、`gclid` 等参数，高亮展示并提供 Copy clean URL 按钮，保留业务参数。

### IP 地址详情（`ip-*`）

检测单个 IPv4、IPv6 或 CIDR 地址。`ip-details` 卡片展示地址范围、格式转换；IPv4 CIDR 还包含子网掩码、网络地址、广播地址与可用主机数量。

### 地理坐标（`geo-*`）

检测单个经纬度对，支持十进制、角度符号与方位字母。`geo-coordinates` 卡片展示十进制、度分秒、半球及可复制的 OpenStreetMap / Google Maps 链接。

### MAC 地址（`mac-*`）

检测冒号、连字符或 Cisco 点分格式的 MAC 地址。`mac-address` 卡片展示五种标准化形式、OUI / NIC、单播与组播、本地与通用管理标记，以及广播地址或空地址提示。

### UUID（`uuid-*`）

检测标准、花括号或 URN 形式的 UUID。`uuid-details` 卡片展示规范格式、URN、版本与变体；解码 v1 / v7 时间戳及 v1 节点地址，并标注 Nil / Max UUID。

## 本地开发

```sh
npm install
npm run dev       # Vite 预览工作台
npm run verify    # typecheck + lint + build + 测试
```
