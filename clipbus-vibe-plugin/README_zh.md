# Vibe（情绪兜底动画）

**Clipbus 情绪兜底动画 renderer** — 当某条复制的文本没有任何更专业的插件能够展示时，Vibe 用 Three.js 粒子动画将其演绎成「混沌→秩序」的沉浸式视觉体验。

## 工作原理

### 兜底机制

Vibe 的 detector 检查 `input.item.attachments` 中的 V2 附件引用。若已有其他插件的附件（`own: false`），本次不写入，让位给对应插件；否则为非空文本写入动画附件。本插件自己的引用（`own: true`）不会阻止重复复制时完整重写，因此 recopy 会保留动画。

检查依据是 detector 的条目快照。其他 detector 在此后新增的附件会在下次检测时参与判断；协议 V2 已移除 Runtime renderer 的可见性回调。

### 三个可切换动画

Vibe 内置三个动画。Clipbus 在卡片下方渲染原生按钮栏，按**配置列表**的顺序为每个动画显示一个按钮。点击任意按钮即切换到对应动画；点击当前动画按钮则重播。**列表中的第一个**动画在加载时显示。显示哪些动画及其顺序可通过设置项配置（见下文），未配置时显示全部三个（默认顺序）。

#### Particle Core（5 阶段，4.8s）

| 阶段 | 时间 | 描述 |
|---|---|---|
| 起手淡入 | 0 – 0.18s | 粒子在文字字形位置浮现 |
| Burst（爆发） | 0.18 – 0.35s | 粒子从字形向外炸开 |
| Chaos（混沌） | 0.35 – 1.6s | Simplex 噪声流场，有机涌动 |
| Attraction（吸引） | 1.6 – 3.1s | 弹簧力收束至 Fibonacci 球 |
| Reassembly（重组） | 3.1 – 4.1s | 精确收敛到球面，bloom 脉冲 |
| Settle（静息） | 4.1s+ | 球体缓慢自转 + 透明呼吸 |

配色：cyan `#5CE1FF`、purple `#9A6BFF`、soft white `#EAF6FF`。

#### Text Reveal（6 阶段，4.6s）

| 阶段 | 时间 | 描述 |
|---|---|---|
| Text In（文字入场） | 0 – 0.6s | 粒子收敛至字形，**可读 ≥ 0.6s** |
| Scan（光扫描） | 0.6 – 1.2s | 光带从左到右扫过字形，能量聚集 |
| Deconstruct（裂解） | 1.2 – 1.8s | 边缘粒子错峰漂移，轮廓保持可辨 |
| Burst（爆发） | 1.8 – 2.4s | 错峰释放——粒子从字形向外炸开 |
| Recall（回收） | 2.4 – 3.5s | 弹簧力将粒子拉向多面体光核 |
| Form / Settle（成形 / 静息） | 3.5s+ | 粒子锁定到二十面体顶点，缓慢自转 |

配色：cyan `#7EE7FF`、purple `#A78BFA`、soft white `#FFFFEF`。重组目标为 IcosahedronGeometry（detail 4），呈现有棱角的"数据晶体"形态，区别于第一版的光滑球。

后处理链均为：RenderPass → AfterimagePass（拖尾）→ UnrealBloomPass（泛光）→ OutputPass。

#### Text Loop（`text-loop`）— 10s 无缝循环

| 阶段 | 时间 | 描述 |
|---|---|---|
| P1 文字呈现 | 0 – 1.0s | 字形稳定显示，透明度淡入后缓慢呼吸 |
| P2 粒子化 | 1.0 – 2.0s | 错峰噪声抖动打散字形边缘，轮廓保持可辨 |
| P3 爆发 | 2.0 – 3.0s | 粒子从字形向云端位置散射 |
| P4 漂移云 | 3.0 – 5.0s | 噪声驱动能量云；两端漂移幅度归零（无缝衔接） |
| P5 召回 | 5.0 – 6.5s | 漩涡将粒子引向 Fibonacci 球；抵达后漩涡淡出 |
| P6 稳定球 | 6.5 – 8.0s | 球体轻柔脉动；无累积旋转（循环安全） |
| P7 解构 | 8.0 – 9.0s | 球体溶解回云端位置 |
| P8 重组 | 9.0 – 10.0s | 粒子沿原爆发路径逆向流动，精确还原字形 — 循环重启 |

配色：cyan `#7EE7FF`、purple `#A78BFA`、white `#FFFFFF`。

### 切换动画

切换通过 `ctx.renderer.update({ buttons })` 和 `ctx.renderer.onButton(event => ...)` 完成，使用 `event.id` 选择动画。加载时从设置解析列表，为每个动画发布一个**启用**的宿主原生按钮，第一个动画默认显示。点击任意动画即切换；点击当前动画则重播。卡片卸载时取消订阅并释放动画资源。

### 设置

Vibe 读取一个只读设置项 **`plugin.vibe.animations`**——按顺序显示的动画 id 列表。**第一个**条目在加载时显示；每个列出的动画对应一个按钮。

| 值 | 效果 |
|---|---|
| id 的 JSON 数组，如 `["text-loop","particle-core"]` | 按该顺序仅显示这些动画；第一个在加载时显示 |
| 未设置 / 为空 / 无有效 id | 按默认顺序显示全部动画（`particle-core`、`text-reveal`、`text-loop`）；第一个在加载时显示 |

有效 id：`particle-core`、`text-reveal`、`text-loop`。未知 id 会被忽略，重复项会被合并。也接受逗号/空格分隔的字符串（如 `"text-loop, particle-core"`）。

插件通过 `ctx.settings.get<{ animations?: unknown }>()` **只读**设置。返回值是 `{ values }`，键已去掉插件前缀：宿主文件里的 `plugin.vibe.animations` 对应 `values.animations`。配置方法：编辑宿主的 external-settings 文件，然后重载插件：

```
~/Library/Application Support/Clipbus/ExternalSettings/settings.json   （debug 构建为 …/ClipbusDebug/…）
```

```json
{ "plugin.vibe.animations": ["text-loop", "particle-core"] }
```

然后在 Clipbus 里重载 Vibe（Settings → Plugins → Developer Plugins → Reload）或重启 Clipbus。卡片内的切换仅当次会话有效，不会写回设置。

## 注意事项

- 四个预览场景保留普通文本和短单词示例，并演示动画排序与单动画设置。Runtime 测试覆盖外部附件引用和仅含自身附件时的 recopy；真实宿主中的检测顺序仍需实测。
- 卡片背景为深色太空渐变，是动画的视觉本质，并非 theme 错误。
- schema 5 下，附件类型声明在 `writes.attachmentTypes`，由宿主保存为本机派生数据。
