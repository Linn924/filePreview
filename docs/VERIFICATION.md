# 3.0.0 验证记录

日期：2026-09-11；环境：Windows 11 x64，Electron 44.3.0。

- `npm test -- --suite all`：通过类型检查、生产构建、基础逻辑、安装注册检查和全部格式/窗口套件。
- `npm test -- --suite word --skip-build`：补充两页 DOCX 外侧滚轮前进、返回及页码同步检查通过；之后已纳入完整套件。
- `npm run build:win`：构建流程通过；调整 Open With 注册后，使用 `npx electron-builder --win nsis zip --x64` 对最终完整测试的构建输出重新打包。
- `npm run test:package`：真实 EXE 通过命令行 PDF 打开、第二实例 PPTX 交付已有进程检查。测试使用独立设置目录。
- 完整解压最终 ZIP 后，对解压目录中的 EXE 再次运行相同打包测试，通过。
- NSIS 命令引号修正后，基础注册检查及 `npm run typecheck` 通过；`npx electron-builder --win nsis --x64 --prepackaged outputs/release/win-unpacked` 成功生成最终安装包。
- 全部已有测试样例预览前后 SHA256 一致，表格拖宽等操作没有修改源文件。
- 已查看 PPTX 与深色设置截图，确认内容比例、文字和提供的 logo 正常。

自动化中的系统选择框使用模拟返回值，安装向导点击流程、资源管理器实际右击列表及真实托盘菜单仍需按 TESTING.md 手工验收。本次未在用户系统安装或卸载软件。复杂 Office 文稿的兼容性仅限已有样例验证，不代表像素级还原全部文档。

详细命令、可选套件、预期行为和手工验收步骤见 [TESTING.md](TESTING.md)。测试输出、截图与安装产物保留在本地 `outputs/`，不进入代码仓库。
