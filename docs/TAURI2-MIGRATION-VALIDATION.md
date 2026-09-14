# Tauri 2 技术路线校验方案

目标：判断是否值得把 **Electron 44** 迁到 **Tauri 2**，以及迁移后能否守住本项目的核心承诺。

本仓库当前承诺（迁移不得倒退）：

1. 仅本机运行，文件不上传、不落盘预览副本。
2. 支持 Word / Excel / PPT / PDF / 文本 / 图片预览（与现有模块能力对齐）。
3. 多文件标签、跨窗口拖拽合并、沉浸全屏。
4. PDF 独立打印窗口、逐文件打印参数、批量提交（当前依赖 Electron 打印 API）。
5. Windows 安装包（NSIS）+ Open With；默认只打安装包。
6. 设置可持久化且不含文件路径历史。
7. 现有自动化套件（core / 各格式 / printing）能在新栈上等价运行。

结论应在 PoC 结束后写入本文档「评估结论」节，再决定是否立项。

---

## 1. 为什么不能“直接换壳”

| 能力 | Electron 现状 | Tauri 2 对应物 | 风险 |
| --- | --- | --- | --- |
| 渲染内核 | Chromium（自带） | Windows WebView2（系统 Edge） | 版本/策略因机器而异；PDF.js、Canvas、字体渲染需对齐 |
| 多窗口 | `BrowserWindow` | `WebviewWindow` / 多 webview | 生命周期、拖拽、全屏 API 不同 |
| 打印 | `webContents.print` / `printToPDF` | **无对等内置能力** | **最高风险**；见 §4 |
| 自定义协议 | `preview://` + memory session | 自定义协议 / asset protocol | CSP、流式读取、缓存策略不同 |
| 读文件进渲染进程 | Node `fs` 读满 `Uint8Array` | Rust 命令 + IPC 分块 | 大文件（≤100MB）IPC 开销、内存峰值 |
| 托盘 / 单实例 | Electron 原生 | `tauri-plugin-*` | 行为细节、菜单、图标 DPI |
| Open With / NSIS | electron-builder + 自定义 NSH | Tauri bundler NSIS | 安装注册、卸载清理需重做并回归 |
| 安全 | sandbox + 自定义 CSP + 非持久 partition | CSP、capability、插件权限 | 必须重新做威胁模型 |
| 测试 | 真实 Electron 窗口 + `executeJavaScript` | Webdriver / Tauri driver / 重写 harness | **测试栈几乎全量重写** |

---

## 2. 校验原则

1. **PoC 优先于迁移**：先证明硬门槛，再谈改业务代码。
2. **硬门槛失败即停**：任一 P0 门禁未过，默认留在 Electron。
3. **功能对照表驱动**：每条现有用户可见能力必须有等价实现或书面降级说明。
4. **不双轨长期维护**：避免 Electron/Tauri 两套主进程并行超过一个评估周期。
5. **测量再承诺**：性能对比必须同机、同文件、可重复脚本，不写无数据的“更轻量”。

---

## 3. PoC 阶段与门禁

### 阶段 A — 环境与骨架（P0，约 1–2 天量级）

- Windows 10/11 x64 + WebView2 Runtime（安装包需处理 Runtime 缺失）。
- `tauri 2` + 现有 **Vue 3 + Vite** 前端可挂载（`src/` 尽量不动）。
- 自定义协议或 `tauri.conf` 资源策略能加载本地静态资源。
- 产出：`apps/tauri-poc` 或独立分支可 `cargo tauri dev` 打开空白窗。

**门禁 A**：dev 启动成功；生产 `tauri build` 产出 exe。

### 阶段 B — 文件读取与预览（P0）

- Rust 读文件 → 前端收到与 `PreviewFile` 兼容的数据（含 `bytes`）。
- 100MB PDF / 5MB 文本上限逻辑保留；错误信息中文与现网一致。
- 至少跑通：PDF.js 渲染、xlsx 解析、docx-preview、pptx 渲染、图片、文本。
- 大文件：50–100MB PDF 首屏时间、峰值内存 vs Electron 基线（见 §5 指标）。

**门禁 B**：

1. 六类格式各至少 1 个现有 fixture 可预览。
2. 100MB 上限、格式白名单行为一致。
3. 50MB PDF 首屏 P95 不劣于 Electron 基线 **+20%** 以上（若更差需书面接受）。

### 阶段 C — 多窗口与标签（P0）

- 首页窗口 + 多预览窗口；同窗多 Tab；关闭预览不退出首页。
- 跨窗口拖拽合并标签（`DataTransfer` / Tauri drag-drop 插件路径）。
- 沉浸全屏（盖任务栏、隐藏系统标题栏）进出与状态恢复。
- 打印设置独立窗口（可无模态移动/缩放；并排摆放）。

**门禁 C**：现有 `core` 套件中与窗口/标签相关的 8 项行为在 Tauri 上有等价自动化或手工清单全过。

### 阶段 D — 打印（P0，决定性）

Tauri 2 **没有**与 `webContents.print` / `printToPDF` 同级的一等公民 API。必须先做 Spike，按顺序评估：

| 方案 | 做法 | 预判 |
| --- | --- | --- |
| D1 WebView2 打印 | 调 WebView2 的 print | 可用性/静默打印/纸张份数 duplex 可能不全 |
| D2 系统打印对话框 | 打开 OS 对话框再由 webview 打印 | 交互变重；批量打印难 |
| D3 生成 PDF 再交给系统/驱动 | 用 pdfium 或 Rust 生成 PDF，再 OS 打印 | 可控，但工作量大；与现“渲染画布→print”路径不同 |
| D4 保留 Electron 仅打印侧车 | 双运行时 | 违背迁移目标，体积/复杂度双高 |
| D5 降级：只做“导出 PDF” | 不做静默批量打印 | **功能倒退**，需用户书面确认 |

**门禁 D（必须全部满足才可迁）**：

1. 选定纸张（A3/A4/A5/A6/Letter/Legal）、方向、份数、页码范围、颜色、单双面 **能力矩阵** 与现网一致，或差项有明确替代。
2. 批量：多文件队列顺序提交、失败继续、停止后续。
3. 与预览窗口并排的独立打印设置窗口可工作。
4. 自动化：仍能拦截“出纸”，做内存级 PDF/任务计数（对应现 `src/modules/pdf/tests/printing.ts` 语义）。
5. 至少一台真实打印机完成一次 A4 + 一次 A5 手工出纸。

**若 D 门禁失败：默认不迁移主栈。**

### 阶段 E — 系统集成（P1）

- 托盘（显示/隐藏/退出）；关闭首页策略（询问 / 退出 / 托盘）。
- 单实例锁 + 第二进程把文件路径交给已有实例。
- Open With：安装后资源管理器出现 “File Preview”；卸载只清本软件键。
- 设置读写（theme / closeAction / multiFileMode / defaultZoom / maximizePreview / printEntry），不含路径。

**门禁 E**：安装包安装 → 打开文件 → 卸载干净；设置重启后保留。

### 阶段 F — 安全与隐私（P0）

- 无网络（或默认 deny all + 明确例外）；测试仍能断言外网被拦。
- 文件字节仅内存传递；应用目录无预览副本；设置 JSON 无路径。
- capability 最小权限；禁用不必要的 FS/Shell 插件范围。
- 自定义协议不可被任意 http 页面调用。

**门禁 F**：对照 `docs/` 隐私表述与 `core` 安全用例全过。

### 阶段 G — 打包与体积（P1）

- Tauri NSIS 安装包：图标、版本、Open With、卸载。
- 产物体积与安装包体积 vs 现 109MB Electron NSIS（记录数字，不预设结论）。
- `verify:release` 等价脚本（MZ/NSIS 标识/blockmap 或 Tauri 等价物、SHA256）。

**门禁 G**：安装包结构检查脚本通过；干净机安装启动成功。

### 阶段 H — 测试迁移（P0）

- 评估：保留 TypeScript 断言语义，把 `tests/electron.entry.ts` 换成 Tauri 窗口驱动。
- 至少移植：`unit`、`core`、`pdf`、`printing`、`excel` 五个套件的主路径。
- `npm test` 门禁与现在相同：未知 suite 失败、fixture SHA256 不变。

**门禁 H**：上述套件在 Tauri 上全绿；失败可定位到具体能力。

---

## 4. 打印专项 Spike 清单（先做）

在写任何业务迁移前，单独开分支回答：

1. WebView2 是否支持静默 `print`？纸张、份数、duplex、颜色选项映射表？
2. `printToPDF` 等价物？页范围、背景色、边距？
3. 打印窗口关闭时取消/阻止策略是否可复刻？
4. 隐藏窗口渲染 → 打印的性能与内存（对比现 150DPI 画布路径）？
5. 无打印机环境的 CI 拦截方式？

把答案填入下表（PoC 时更新）：

| 能力 | Electron | Tauri/WebView2 | 结论 |
| --- | --- | --- | --- |
| 枚举打印机 | 有 | ？ | |
| 静默打印 | 有 | ？ | |
| 纸张/方向/份数/双面/彩色 | 有 | ？ | |
| 打印到 PDF | 有 | ？ | |
| 页范围 | 有 | ？ | |
| 批量队列语义 | 有（应用层） | 可重做 | |

---

## 5. 性能与体积基线（迁移前先测 Electron）

在 **当前 Electron 构建**上记录，作为唯一对照：

| 指标 | 方法 | 记录 |
| --- | --- | --- |
| 冷启动到首页 | 安装版/解压版计时 | ms |
| 打开 50 页 PDF 首屏 | fixture 计时 | ms |
| 打开 50 页 PDF 峰值私有内存 | 任务管理器/ETW | MB |
| 打开万行 XLSX 首屏 | 生成样例计时 | ms |
| 安装包大小 | outputs/release | MB |
| 安装后磁盘占用 | 安装目录 | MB |

脚本建议：`scripts/bench-*.ts`，输出 JSON 到 `outputs/bench/`（不提交产物）。Tauri PoC 同脚本同文件跑三轮取中位数。

**迁移收益判断（经验阈值，PoC 后可调）**：

- 安装包体积下降 **< 30%** 且打印需降级 → 收益不足，建议留在 Electron。
- 内存下降明显但打印 D 门禁失败 → 不迁主栈。
- 仅“更喜欢 Rust”不足以立项。

---

## 6. 功能对照表（迁移验收用）

| 编号 | 能力 | 现网 | Tauri PoC | 状态 |
| --- | --- | --- | --- | --- |
| F1 | 六类格式预览 | 有 | | |
| F2 | 多文件 Tabs / 独立窗口 | 有 | | |
| F3 | 跨窗口拖拽合并 | 有 | | |
| F4 | 连续滚动 + 页码定位 | 有 | | |
| F5 | 缩放 25–400% / 适配 | 有 | | |
| F6 | 沉浸全屏 | 有 | | |
| F7 | 黑夜主题 | 有 | | |
| F8 | 设置持久化 | 有 | | |
| F9 | 关闭首页策略 / 托盘 | 有 | | |
| F10 | PDF 打印面板 + 逐文件参数 | 有 | | |
| F11 | 打印入口 all/current/none | 有 | | |
| F12 | 批量打印队列 | 有 | | |
| F13 | Open With | 有 | | |
| F14 | 单实例交付文件 | 有 | | |
| F15 | 无网络 / 不落盘 | 有 | | |
| F16 | 默认仅 NSIS 安装包 | 有 | | |
| F17 | 自动化回归 suite | 有 | | |

---

## 7. 回退与决策

```text
开始 PoC
  → A/B/C 失败：留在 Electron，记录差距
  → D（打印）失败：留在 Electron；打印是本产品 P0
  → D 成功但 F/H 缺口大：延长 PoC，不迁业务
  → 全部门禁通过 + 体积/内存收益达标：立项迁移
       建议策略：新分支重写 electron/* → src-tauri/*，
       src/modules 前端尽量复用，shared/contracts 保持稳定
  → 迁移完成后删除 Electron 主进程与 electron-builder 配置
```

**立项建议（在门禁全过前不要执行）**：

1. 先锁 `shared/contracts.ts` 与模块边界（已较干净）。
2. 新建 `src-tauri/`，实现 files/settings/windows/print Spike。
3. 测试 harness 第二优先级，禁止“迁完再补测试”。
4. 安装包与 Open With 同步重做，避免只有 dev 能跑。
5. 版本策略：迁移期可标 `4.0.0-beta`，不与 3.3.x 功能混发。

---

## 8. 建议执行顺序（若启动 PoC）

1. 写 Electron 基线脚本并跑出 §5 数字。  
2. 打印 Spike（§4）——**先于**大面积 UI 迁移。  
3. 阶段 A–C 最小多窗口 + PDF 预览。  
4. 阶段 D 若可过，再补 E–H。  
5. 填满 §6 对照表，写「评估结论」：迁 / 不迁 / 有条件迁。

---

## 评估结论

（PoC 结束后填写）

- 日期：
- 执行人：
- 门禁结果（A–H）：
- 体积/内存对比：
- 打印结论：
- 最终建议：**留在 Electron** / **有条件迁移** / **迁移**
- 条件或后续任务：
