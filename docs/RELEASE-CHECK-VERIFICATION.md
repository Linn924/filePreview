# 发布检查优化验收（2026-09-13）

- `npm run verify:release`：完整现有产物通过，生成 SHA256SUMS.txt。
- 在独立临时目录将安装包截断为 497600 字节：检查返回非零并提示禁止交付。
- `npm test -- --suite core`：类型检查与生产构建通过；首次窗口测试遇到 UnknownVizError。
- `npm test -- --suite core --skip-build`：重试全部通过，含标签转移、偏好、退出和源文件 SHA256。
- `npm run test:package -- "D:\Programs\FilePreview\File Preview.exe"`：PDF、A5 打印面板、全屏、第二进程 PPTX 交付通过。
- D 盘实际安装已在前一轮执行成功，本轮使用同一安装产物验证；未变更应用运行代码，无需重新安装。真实打印机出纸未测试。

边界：结构、ZIP CRC、一致性与完成标记检查能拒绝本次出现的半成品，但不是安装器全部内容验证，不代替真实安装。首次 UnknownVizError 未确定根因，后续复现时独立排查。
