# File Preview

Windows 本地文件预览：拖入即可查看 Office / PDF / 图片 / 代码，无需安装 Office 或联网。

支持 **Windows 10 / 11（x64）**，以安装包为主；亦提供免安装 ZIP。

仓库：[Linn924/filePreview](https://github.com/Linn924/filePreview)

## 功能

- 打开 Word、Excel、PPT、PDF、图片、文本/代码；本机内存预览，不上传、不写预览副本
- 多标签：固定宽度标签、悬停全名、拖动排序、跨窗口拖拽合并；标签栏滚轮或滚到文顶/底可切换文件
- 顶部「+ 打开」/ `Ctrl+O` 在当前窗口继续添加文件
- 连续滚动阅读 + 页码跟随；适合宽度 / 整页适配 / 自定义缩放 25%–400%
- 沉浸全屏（F11 / Esc），边角唤出工具条与页码
- PDF：搜索与命中跳转、文字层复制、目录/缩略图、密码解锁、临时旋转
- Excel：虚拟滚动、定位单元格（如 B12）、冻结首行/首列及额外 N 行/列
- 文本/代码：行号、搜索、JSON/XML/JS/CSS/INI/YAML 等着色
- 打印（PDF / 图片 / DOCX）：独立非模态打印窗、逐文件纸张/方向/份数/缩放/页序、批量提交到系统队列
- 白天 / 黑夜 / 跟随系统；紧凑 Windows 工具条风格
- 首次启动首页有「小乖专属软件」烟花（仅一次）；开发者 **By 仔仔**

## 支持的文件

| 类型 | 格式 | 能力摘要 |
|------|------|----------|
| Word | `.docx` `.doc` | 连续阅读、表格列宽临时调整；DOCX 可打印 |
| Excel | `.xlsx` `.xls` `.csv` `.tsv` | 合并单元格、虚拟滚动、定位、冻结、宽表 |
| PowerPoint | `.pptx` `.ppt` | 文字、图片与静态布局 |
| PDF | `.pdf` | 预览、搜索、目录/缩略图、密码、旋转、打印 |
| 文本 / 代码 | `.txt` `.json` `.md` `.xml` `.log` `.js` `.ts` `.css` `.ini` `.yaml` 等 | 行号、搜索、着色 |
| 图片 | `.png` `.jpg` `.jpeg` `.webp` `.gif` `.bmp` `.svg` | 适配、原始像素、旋转、EXIF 方向、可打印 |

复杂 Office 排版、SmartArt、动画等可能与 Office 不完全一致；旧 DOC/PPT/XLS 弱于新格式。

## 下载与安装

| 产物 | 说明 |
|------|------|
| `FilePreview-Setup-x.x.x-x64.exe` | **默认** NSIS 安装包 |
| `FilePreview-x.x.x-Windows-x64.zip` | 免安装，完整解压后运行 `File Preview.exe`（可选 `npm run build:win:zip`） |

安装包**尚未商业签名**，SmartScreen 可能提示；请从本仓库获取。安装后可在资源管理器「打开方式」中选择 File Preview（需主动选「始终使用」才会改默认关联）。

## 打印（摘要）

- 入口：预览操作条上的打印机图标  
- 独立窗口可与 PDF **并排**；逐文件折叠设置 + 一行摘要  
- 纸张 A3–A6 / Letter / Legal；缩放：适合纸张 / 实际大小 / 仅缩小；页序：顺序 / 逆序 / 奇偶  
- 提交成功表示**进入系统队列**，是否出纸以打印机/队列为准；可打开「系统打印机」查看  
- 设置 → 点击「打印」时列表：全部可打印文件 / 仅当前 / 不自动加入  

详见仓库内 `docs/PRINTING.md` 与 README 历史章节讨论；以当前界面文案为准。

## 技术栈

| 层 | 选型 |
|----|------|
| 桌面壳 | Electron |
| 前端 | Vue 3 + TypeScript + Vite |
| 解析/渲染 | PDF.js、SheetJS/ExcelJS、docx-preview、pptx 渲染器、Marked 等 |
| 打包 | electron-builder（NSIS） |

## 项目结构（摘要）

```text
filePreview/
├── assets/                 # 图标源与 logo
├── docs/                   # 架构、测试、打印、设计说明
├── electron/               # 主进程、预加载、打印、托盘
├── src/
│   ├── components/         # 跨格式：标签、缩放、设置、打印按钮…
│   ├── composables/        # 连续页、缩放、RO 等
│   ├── modules/<type>/     # 各格式预览与模块内测试
│   └── style.css           # Plan B 全局 chrome
├── shared/                 # 契约与打印类型
├── scripts/                # icon / fixtures / bench / verify
└── tests/                  # Electron 套件入口
```

## 文档

| 文档 | 内容 |
|------|------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 架构与模块职责 |
| [docs/TESTING.md](docs/TESTING.md) | 测试影响矩阵与命令 |
| [docs/PRINTING.md](docs/PRINTING.md) | 打印需求与实现边界 |
| [docs/BACKLOG.md](docs/BACKLOG.md) | 未完成项与后续方向 |
| [docs/DESIGN_NOTES.md](docs/DESIGN_NOTES.md) | 视觉 token 与方案 B |
| [AGENTS.md](AGENTS.md) | 开发规范 |

## 开发

### 环境

- Node.js 22+（Windows）
- npm

### 常用命令

```bash
npm ci
npm run dev              # 构建后 Electron 运行
npm run typecheck
npm test -- --suite all  # 全量回归
npm test -- --suite pdf,printing,core
npm run bench            # 库级性能
npm run bench:ui         # 打开→ready 中位数
npm run build:win        # 仅 NSIS 安装包 + verify
npm run build:win:zip    # 仅免安装 ZIP
npm run verify:install   # 检查本机安装目录（可 --expect-absent）
```

打印自动化**拦截** `webContents.print`，不会向实体打印机出纸。

### 打包产物

`npm run build:win` → `outputs/release/FilePreview-Setup-*.exe` 与 `SHA256SUMS.txt`。

### 发布前

1. 更新 `package.json` 的 `version`  
2. 每完成需求：卸载 → 安装到 `D:\file-preview\File Preview`（见 AGENTS.md）  
3. 可选：Windows 代码签名  

## 平台说明

| 事项 | 做法 |
|------|------|
| 文件读取 | 主进程只读入内存，渲染侧不写盘 |
| 多窗口 | 标签可拖到另一预览窗合并 |
| 打印 | Electron `print` / 文档 `@page` 纸张；驱动可覆盖应用纸张 |
| 图标 | 内联 SVG + `assets/icon.ico`（文档眼） |

## License

[MIT](LICENSE) · 第三方声明见应用内 `THIRD-PARTY-NOTICES.txt`
