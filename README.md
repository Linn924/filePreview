# File Preview

**简洁的 Windows 本地文件预览工具。**

选择或拖入文件，在独立窗口中查看 Word、Excel、PowerPoint、PDF、文本和图片。仅提供只读预览，无需 Office、LibreOffice、后端服务或网络连接。

**Windows 10 / 11 · x64 · Electron + Vue 3 + TypeScript · MIT License**

## 目录

- [功能特性](#功能特性)
- [支持格式](#支持格式)
- [安装手册](#安装手册)
- [使用方法](#使用方法)
- [隐私与本地处理](#隐私与本地处理)
- [开发与构建](#开发与构建)
- [项目结构](#项目结构)
- [第三方组件](#第三方组件)
- [已知限制](#已知限制)
- [常见问题](#常见问题)
- [贡献与反馈](#贡献与反馈)
- [许可证](#许可证)

## 功能特性

- **独立窗口**：每个文件在新窗口中打开，方便对照查看。
- **拖拽与多选**：支持拖入文件、文件选择框和 `Ctrl + O`。
- **仅预览**：不提供编辑、保存、导出、打印或上传功能。
- **表格预览**：工作表切换、行列分页、数字格式；XLSX 支持常见样式和合并单元格。
- **文档与幻灯片**：尽量保留文字、图片、表格和布局，支持缩放及幻灯片翻页。
- **PDF 预览**：本地绘制页面、页码跳转、翻页和缩放。
- **文本与图片**：中文编码切换、JSON 格式化、Markdown 排版、图片适配。
- **无需额外运行环境**：安装版与 ZIP 版均内置运行所需组件。

## 支持格式

| 类型 | 扩展名 | 支持内容 |
| --- | --- | --- |
| Word | `.docx`、`.doc` | 文本、页面、表格及图片；旧版 DOC 的复杂排版可能有差异 |
| Excel | `.xlsx`、`.xls` | Sheet 切换、数字格式；XLSX 的字体、颜色、边框、合并区域、行高列宽、内嵌图片 |
| 分隔文本表格 | `.csv`、`.tsv` | 按行列显示数据 |
| PowerPoint | `.pptx`、`.ppt` | 静态幻灯片、文字、图片与常见形状；翻页、缩放 |
| PDF | `.pdf` | 页面绘制、翻页、页码跳转、缩放 |
| 文本 | `.txt`、`.text`、`.log`、`.xml` | 原文显示，UTF-8、GBK / GB18030、UTF-16 编码选择 |
| JSON | `.json` | 格式化有效 JSON；无效 JSON 按原文显示 |
| Markdown | `.md` | 标题、段落、列表、表格、代码块等 |
| 图片 | `.png`、`.jpg`、`.jpeg`、`.webp`、`.gif`、`.bmp`、`.svg` | 窗口适配、缩放 |

## 安装手册

### 系统要求

| 项目 | 要求 |
| --- | --- |
| 操作系统 | Windows 10 / Windows 11 |
| 架构 | x64 |
| Office / LibreOffice | 不需要 |
| Node.js | 普通用户不需要，仅开发和构建时需要 |
| 网络 | 使用时不需要；开发安装依赖时需要 |

### 方式一：安装版

1. 获取 `FilePreview-Setup-2.0.0-x64.exe`。本地构建产物位于 `outputs/release/`。
2. 双击安装包，按照向导选择安装目录并完成安装。
3. 从桌面快捷方式或开始菜单打开 **File Preview**。
4. 卸载时，在 Windows「设置 → 应用 → 已安装的应用」中找到 **File Preview** 并卸载。

安装包只安装本软件及其内置组件，不会要求另外安装 Office 或文档转换程序。

### 方式二：免安装 ZIP

1. 获取 `FilePreview-2.0.0-Windows-x64.zip`。
2. 将压缩包**完整解压**到一个目录。
3. 双击解压目录中的 `File Preview.exe`。

> 请保留 EXE 同目录中的所有文件，不要只复制 EXE，也不要直接从压缩包内部运行。

当前构建未配置商业代码签名。若 Windows 显示发布者信息提示，请核实文件来源及交付的 SHA256 校验值。无需关闭系统安全功能。

## 使用方法

1. 打开软件，点击「选择文件」，或将本机文件拖入窗口。
2. 多选文件时，每个文件分别打开一个预览窗口。
3. 在预览窗口中按需切换工作表、翻页、修改缩放比例或文本编码。
4. 点击「打开其他文件」会创建新的预览窗口，不覆盖现有预览。
5. 关闭文件对应窗口，即释放该窗口中的预览内容。

| 操作 | 方法 |
| --- | --- |
| 打开文件选择框 | 点击选择按钮，或按 `Ctrl + O` |
| 切换 Excel 工作表 | 点击顶部 Sheet 标签 |
| 查看大表格后续内容 | 使用底部行分页、列分页按钮 |
| PDF 跳转页面 | 修改底部页码并确认 |
| 调整显示大小 | 使用右上角缩放选择框 |
| 解决中文文本乱码 | 切换文本编码 |

## 隐私与本地处理

- 文件只读入内存，不写回原文件。
- 不保存文件副本、转换产物、缩略图、文件路径历史或最近预览记录。
- 数据交付给预览窗口后，主进程删除对应的临时内存条目。
- 使用非持久化浏览会话，禁止网络请求、下载、权限申请及外部网页弹窗。
- 所有解析库、PDF 字体资源和运行组件随应用打包，不调用在线预览服务。

软件安装文件、卸载信息以及 Windows / Electron 自身可能生成的基础运行配置，不属于被预览文件。应用不承诺阻止操作系统分页文件等系统级行为。

## 开发与构建

### 环境准备

安装 **Node.js 22.12 或更高版本**及 npm，然后进入项目根目录。

```powershell
# 安装 package-lock.json 锁定的依赖
npm ci

# 构建并打开桌面程序
npm run dev
```

也可以使用 `npm install` 安装依赖。SheetJS 使用官方分发地址，首次安装需要能够访问 npm、SheetJS 及 Electron 下载源。

### 生成 Windows 安装包和 ZIP

```powershell
npm run build:win
```

```text
outputs/release/
├── FilePreview-Setup-2.0.0-x64.exe
├── FilePreview-2.0.0-Windows-x64.zip
└── win-unpacked/
    └── File Preview.exe
```

`win-unpacked/` 中的程序也可以直接运行，但分发时必须包含整个目录。

### 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 类型检查、构建并启动 Electron |
| `npm run start` | 启动上次构建的桌面程序 |
| `npm run typecheck` | TypeScript 与 Vue 类型检查 |
| `npm run build` | 构建前端、复制 PDF 本地资源、汇总第三方许可 |
| `npm run build:win` | 生成 Windows x64 安装版和 ZIP |
| `npm run build:dir` | 生成未压缩的 Windows 应用目录 |
| `npm run test:smoke` | 构建并运行实际 Electron 窗口测试 |

`dev:web` 仅用于界面开发，普通浏览器不提供桌面文件桥接接口；完整功能请使用 Electron。

### 自动验证

```powershell
# 生成开发测试文件，并下载公开的 DOC / PPT / PPTX 样例
node scripts/fixtures.mjs

# 验证实际桌面窗口中的预览行为
npm run test:smoke

# 构建完成后，验证最终应用
node scripts/test-package.mjs
```

测试覆盖多窗口、多选、真实文件拖拽、表格样式和分页、Word / PPT / PDF、文本和图片、错误提示、网络拦截、非持久化会话，以及原文件 SHA256 不变。

测试样例保存到 `work/fixtures/`，报告和截图保存到 `outputs/verification/`。这些是开发测试行为；生产软件不含测试入口，不执行测试写盘逻辑。测试通过不代表所有复杂 Office 文档均可完整还原。

## 项目结构

```text
.
├── electron/
│   ├── main.cjs                  # 窗口、只读文件、内存会话、本地资源协议
│   └── preload.cjs               # 限定范围的桌面接口
├── src/
│   ├── components/               # 文档、表格、PPT、PDF、文本与图片预览
│   ├── App.vue                   # 主窗口及预览窗口入口
│   ├── main.ts
│   ├── types.ts
│   ├── style.css
│   └── preview.css
├── scripts/
│   ├── copy-assets.mjs           # PDF 本地资源及第三方许可汇总
│   ├── fixtures.mjs              # 开发测试样例
│   ├── smoke.cjs                 # Electron 功能测试
│   └── test-package.mjs          # 打包产物测试
├── outputs/                      # 发布包、使用说明及验证记录
├── package.json                  # 项目信息、依赖、构建与安装配置
├── package-lock.json
├── vite.config.ts
├── tsconfig.json
├── LICENSE
└── README.md
```

渲染进程关闭 Node.js 集成，启用上下文隔离和沙箱。应用通过本地自定义协议加载资源，不启动 HTTP 服务。各类型解析库按需加载，并由 Vite 打包到安装产物中。

## 第三方组件

下表为本项目直接使用的主要开源组件，版本取自本次安装的依赖，实际可复现版本以 `package-lock.json` 为准。它们是**软件内置组件或开发工具**，不是要求用户额外安装的应用。

| 组件 | 版本 | 用途 | 许可证 |
| --- | --- | --- | --- |
| [Electron](https://www.electronjs.org/) | 44.3.0 | Windows 桌面运行环境 | MIT |
| [Vue](https://vuejs.org/) | 3.5.42 | 用户界面 | MIT |
| [TypeScript](https://www.typescriptlang.org/) | 5.9.3 | 类型检查与开发 | Apache-2.0 |
| [Vite](https://vite.dev/) | 7.3.6 | 前端构建 | MIT |
| [electron-builder](https://www.electron.build/) | 26.15.3 | 安装包与 ZIP 打包 | MIT |
| [SheetJS CE](https://docs.sheetjs.com/) | 0.20.3 | XLS / XLSX / CSV / TSV 数据解析 | Apache-2.0 |
| [ExcelJS](https://github.com/exceljs/exceljs) | 4.4.0 | XLSX 样式、合并区域及图片 | MIT |
| [docx-preview](https://github.com/VolodymyrBaydalka/docxjs) | 0.3.7 | DOCX 预览 | Apache-2.0 |
| [@file-viewer/doc](https://github.com/flyfish-dev/file-viewer) | 3.0.3 | 旧版 DOC 解析与呈现 | MIT |
| [@aiden0z/pptx-renderer](https://github.com/aiden0z/pptx-renderer) | 1.2.4 | PPTX 幻灯片预览 | Apache-2.0 |
| [@web-ppt/core](https://github.com/unStone/web-ppt) | 0.4.5 | 旧版 PPT 解析与呈现 | MIT |
| [PDF.js](https://github.com/mozilla/pdf.js) | 6.3.289 | PDF 页面绘制 | Apache-2.0 |
| [DOMPurify](https://github.com/cure53/DOMPurify) | 3.4.15 | HTML / SVG 内容净化 | MPL-2.0 或 Apache-2.0 |
| [marked](https://github.com/markedjs/marked) | 18.0.12 | Markdown 解析 | MIT |
| [JSZip](https://github.com/Stuk/jszip) | 3.10.1 | ZIP 文档容器及测试数据 | MIT 或 GPL-3.0-or-later |

感谢上述项目及其维护者。完整直接和间接组件许可在构建时汇总为 `dist/THIRD-PARTY-NOTICES.txt`，随应用资源打包。Electron 自带的 Chromium 等组件也保留各自的许可文件。修改或再分发软件时，请保留适用的版权和许可声明。

## 已知限制

- 不等同于 Office 的完整渲染引擎，复杂分页、字体、公式、SmartArt、嵌入对象和特殊矢量图可能存在差异。
- 缺失字体使用本机替代字体，不在线下载字体。
- 旧版 DOC / PPT 和 XLS 的还原能力有限；XLSX 样式支持优于 XLS。
- Excel 不重新计算公式，依赖文件缓存值；不绘制 Excel 图表、条件格式和完整打印分页。
- PPT 仅呈现静态幻灯片，不播放动画、音频或视频。
- 不支持密码保护的文件；损坏或不兼容文件显示错误提示。
- 单个文件最大 100 MB，文本最大 5 MB，最多同时打开 12 个预览窗口。
- 大表格每页 200 行、100 列，后续行列通过分页按钮访问；跨页合并区域按当前页裁切。
- 外链图片和其他网络资源不会加载。

## 常见问题

### 为什么 ZIP 里的 EXE 单独复制出来不能运行？

Electron 应用需要同目录的资源文件与动态库。请完整解压并保留整个目录。

### 是否需要安装 Office 或连接在线预览服务？

不需要。文档由内置解析组件在本机处理。

### 为什么文档和 Office 中的显示不完全一致？

不同格式的复杂对象及排版支持存在边界，本机缺失原始字体也会影响布局。具体范围见「已知限制」。

### 中文 TXT 出现乱码怎么办？

在文本预览中切换 UTF-8、GBK / GB18030 或 UTF-16 编码。

### 构建时下载失败怎么办？

检查当前网络及代理是否能访问 npm、SheetJS 官方分发地址和 Electron 下载源，确认后重新运行 `npm ci`。不需要修改软件运行时的离线设置。

## 贡献与反馈

欢迎提交 Issue 或 Pull Request。问题描述建议包含：Windows 版本、应用版本、文件扩展名、复现步骤、预期和实际行为。涉及文档内容时，请使用不含隐私或机密信息的最小样例。

提交代码前，请运行 `npm run typecheck` 和与改动相关的测试。新增格式应明确说明真实支持范围，并保留「仅本地、只读、不保存预览文件」的行为。

## 许可证

本项目采用 [MIT License](LICENSE)。第三方组件分别遵循自身许可证。
