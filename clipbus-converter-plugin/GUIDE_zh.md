# Converter 开发指南

当前使用 SDK 2.x、协议 V2、manifest schema 5。在本目录 npm install，先读安装 SDK 的 docs/README.md 与 API.md，再修改接口。

npm run dev 打开六个真实卡片场景；manifest 提供标题、按钮与高度，preview 挂载实际 Vue 页面。
命名风格转换为 Runtime Action，没有卡片预览。

npm run verify 完成 manifest、类型、lint、构建、产物与行为测试。detector 通过 ctx 写入附件和搜索扩展，
Action 返回 result，卡片使用 /view ctx 与共享 useCard。payload 契约保持跨端安全。

通用 UI 构建/校验脚本来自仓库 generator 资产，ui-pages.mjs 规划独立输出目录。
Clipbus 实际加载 dist；在当前真实目录运行 verify 重建后再 Reload。浏览器预览不能代替真实宿主的文件、系统与提交校验。
