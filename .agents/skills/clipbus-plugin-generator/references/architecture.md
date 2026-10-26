# Clipbus 插件架构（SDK 2.x / 协议 V2）

确切接口以安装版本 SDK 的 API.md 与 docs/README.md 为准，工程使用 manifest schema 5。

## 两侧与贡献

Runtime（Node）提供 detector、Action、message 函数；卡片页（WebView）显示附件。两侧都通过 ctx 与宿主交互。
Runtime 从 /runtime 导入 definePlugin/result，页面从 /view 导入 ctx，跨端契约从 SDK 根导入 defineAttachment/defineMessage。

| 贡献 | Runtime | 页面/manifest |
|---|---|---|
| detector | 函数读取 { item, content, trigger }，await ctx.item 写入，返回 void | detectors[].inputKinds |
| renderer | 无 Runtime 注册 | renderers[].page，height，title/tint/buttons |
| Action | 函数读取当前 content，返回 result.text/image/none | actions[].inputKinds，无 UI |
| message | contract.handle(fn) 注册到 messages 数组 | contract.call(data) |

仅实现选题需要的贡献。展示检测结果时配同 attachmentType 的 renderer；只写搜索扩展或内部状态不需要 renderer。
renderer 已展示并提供复制时，不额外添加同值复制 Action。输入仅 text/image。

## 目录与构建

每个有 UI 的 renderer 放在 src/features/<renderer-id>/，包含 payload.ts、app.vue、main.ts、index.html；
detector/Action 的代码按职责放在同一 feature 或独立 Runtime 目录。
Runtime 相对 .ts 导入带扩展名。共享 payload.ts 是纯契约与数据处理，不能引入 Node/DOM API。

通用 build-ui.mjs 根据 manifest.renderers 将 src/features/<id>/ 打到 page 指定的位置；
ui-pages.mjs 去重共享页面、拒绝会覆盖彼此的输出目录。通用资产在 assets/scaffold/scripts/。
verify-build.mjs 加载实际 Runtime 对照 detector/Action 注册，并检查页面相对资源；不靠 bundle 字符串判断接线。

## manifest 与写入

schemaVersion: 5；runtime.nodeEntry 只有 Runtime 贡献时必需。卡片 page 相对插件根目录。
writes.attachmentTypes 声明全部写入类型，writes.searchScopes 声明全部搜索 scope。
附件类型必须以本插件 id + "." 开头；不能沿用被合并 feature 原来的插件命名空间。

附件 entry 是 { key, payload, card? }，payload 是对象。defineAttachment<T> 负责类型绑定，不替代运行时输入校验。
外观来自 renderer 默认值叠加 attachment.card；动态外观用 ctx.renderer.update。
卡片启动只读取一次 context，随后订阅 item/env/button，组件卸载时取消订阅。

Runtime 写入成功返回后提交，调用结束后 ctx 失效。detector 成功运行整体替换自己的旧输出；
recopy 也要重写完整结果。页面/消息状态应与 detector 输出分类型；内容编辑会清空全部附件。
单 payload、搜索文本与跨 detector 的总条数都按 API.md 的 PluginWriteLimits 预算。

## preview 与测试

createPreviewWorkbench 只负责工作台，实际卡片组件必须由 mount 挂载。
每个 renderer 都有 V2 scenario：plugin 身份、item 快照、attachment 对象、manifest renderer 默认值、height；
item.attachments 是引用列表，不能带 payload。消息替身放 scenario.messages。示例详情见 authoring-guide.md。
纯 Action 插件没有卡片页，保留静态预览说明即可。

验证：npm install → 读 SDK 文档 → npm run verify。保留算法测试，增加构建产物的真实调用测试；
preview scenario 用 SDK computeBootstrap 验证，并实际打开工作台检查场景、主题与按钮。
dist 是宿主加载的真实产物，必须在实际目录重建。
