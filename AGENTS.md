# 项目开发规则

## 用户的优化与额度偏好

- 每轮先说明优化范围、预计工作量和必要测试；可查询时检查 Codex 实时额度。不能把时间或 token 估计换算成保证的额度百分比。
- 优先小批次优化已确认问题，新功能按 docs/BACKLOG.md 排期；完成一批并验证后再扩大范围。
- 合并独立读取，避免重复构建和无依据的全量回归；必要测试不得为了省额度省略。未经用户要求不使用多代理，不自动兑换额度重置。
- 账户实时额度只在会话内报告，不写入仓库；不可查询时明确说明。

1. 先维护架构，再实现功能。每种文件类型放在 `src/modules/<type>/`，通过 `index.ts` 注册，`index.vue` 为入口；解析、样式、专属组件与测试属于模块内部。
2. 跨类型组件放在 `src/components/`，交互逻辑放在 `src/composables/`；不要在 App.vue 写格式解析分支。
3. 可使用 TypeScript 的源码、主进程、构建工具和测试均使用 TypeScript。编译生成的 JS 不提交。
4. 每次新增或修改功能必须运行相关测试。先查看 `docs/TESTING.md`，按影响矩阵选择套件；修改共享层时运行所有受影响模块。测试步骤、样例、断言和限制必须更新。
5. README 面向使用者，完整列出已实现功能。架构、测试和后续计划分别记录在 docs/ 中。
6. 不保存预览文件、历史路径或转换产物。只允许保存用户明确选择的应用设置。
7. 不提交安装包、依赖、截图、临时样例或敏感信息。用户已要求本次代码更新提交到指定 GitHub 仓库。
8. **每次完成新需求并通过相关测试后**：在本机卸载旧版并重新安装最新安装包。安装目录固定为 `D:\file-preview\File Preview`。步骤：`npm run build:win` → 静默卸载（`D:\file-preview\File Preview\Uninstall File Preview.exe /S`）→ 静默安装（`outputs/release/FilePreview-Setup-<version>-x64.exe /S /D=D:\file-preview\File Preview`）→ 确认 `File Preview.exe` 存在且版本/构建时间更新。不要跳过卸载直接覆盖安装。
