# Tauri 2 打印技术分析

**范围**：若将 File Preview 从 Electron 迁到 Tauri 2，打印如何实现。  
**对照基线**：本仓库当前 Electron 打印（`electron/printing/*` + `src/modules/pdf/print/*`）。  
**结论摘要**：**没有**与 `webContents.print` / `printToPDF` 对等的内置能力；可行路径是「生成 PDF → 交给系统打印」或「WebView2/系统打印对话框 + 弱化静默能力」。**在打印门禁未通过前不建议迁主栈。**

---

## 1. Electron 现状（迁移必须守住的能力）

| 能力 | 现状 |
|------|------|
| 枚举打印机 | `getPrintersAsync()` |
| 静默打印 | `webContents.print({ silent, deviceName, copies, pageSize, landscape, color, duplexMode })` |
| 打印到 PDF（测试/布局校验） | `printToPDF` |
| 布局 | 隐藏窗口渲染 `.print-sheet` + `@page{size:…mm}` |
| 批量队列 | 应用层顺序 `print:submit` |
| 页范围/页序/缩放 | 渲染前用 PDF.js + 纸张尺寸计算 |

产品承诺：独立打印窗、逐文件参数、批量提交、「已提交队列 ≠ 出纸」。

---

## 2. Tauri 2 能力盘点

| 能力 | Tauri 2 | 说明 |
|------|---------|------|
| 静默打印任意 HTML/PDF | **无内置** | 无 `print()` / `printToPDF` API |
| 打开系统打印对话框 | 间接 | 可靠打开「打印机设置」；**文档打印对话框**需 WebView2/系统能力，Tauri 不封装 |
| 生成 PDF | 部分 | 前端 Canvas→图片；Rust 侧 pdf 库；或 **WebView2 print-to-PDF**（需实验） |
| 提交到指定打印机、份数、双面 | 无稳定 API | 需 Win32 `PrintDocument` / GDI / `winspool` 绑定 |
| 枚举打印机 | 可自研 | Rust `winspool` / Windows API |

**核心缺口**：应用内「纸张 + 份数 + 双面 + 指定打印机 + 静默出纸」没有官方 Tauri 路径。

---

## 3. 可选技术路线

### 路线 A — 前端渲染 → PDF 文件 → 系统打印（**推荐 PoC 首选**）

```
打印窗（Vue）
  → PDF.js / Canvas / HTML 按纸张排版
  → 生成 PDF 字节（Rust 或前端）
  → 打开系统打印对话框，或写入临时文件后 shell 打开
```

| 步骤 | 做法 | 风险 |
|------|------|------|
| 1. 排版 | 沿用现有 `.print-sheet` + `@page` 逻辑 | 低（逻辑可复用） |
| 2. 出 PDF | 优先：隐藏 webview + WebView2 `PrintToPdf`（若 Tauri 可控）；否则前端 `jsPDF`/`pdf-lib` 或 Rust `printpdf`/`lopdf` 拼装 | 中：Canvas 精度、字体嵌入、页码 |
| 3. 交系统 | `shell.open` 临时 PDF → 用户在阅读器里打印；或 Win32 `ShellExecute` 打印动词 | 低–中：多一步、非静默 |
| 4. 指定打印机 | 第三方阅读器/系统对话框；**应用内难静默** | 高 |

**优点**：与「导出 PDF 再打」一致；测试可断言 PDF 文件页数/尺寸（与现 `printToPDF` 相近）。  
**缺点**：失去应用内静默批量、驱动级份数/双面直控；体验从「一键出纸」变为「生成后系统打印」。

**验收建议**：A4/A5 尺寸正确、页范围正确、批量=依次生成多个 PDF 或合并 PDF；**不承诺**静默出纸。

---

### 路线 B — WebView2 打印 / 系统打印对话框

Tauri Windows 用 **WebView2**（Edge）。可实验：

- 通过 WebView2 COM 接口触发打印（需 Rust/`windows` crate 深度绑定）  
- 或前端 `window.print()`（WebView2 会弹系统对话框；**非静默**，纸张由对话框/驱动决定）

| 项 | 结论 |
|----|------|
| 静默 `silent:true` | 通常 **不可用** 或极不稳定 |
| `pageSize` / duplex / deviceName | 依赖对话框与驱动，**无法等价 Electron** |
| 批量 | 多次弹窗或需扩展程序 |

**优点**：用户可见系统打印 UI，符合 Windows 习惯。  
**缺点**：破坏现有「一键打印所选文件」；自动化难做；多文件批量差。

---

### 路线 C — Rust 绑定 Windows 打印 API（**唯一可能接近现状的硬路径**）

在 Rust 中：

1. **枚举打印机**：`EnumPrinters` / `Get-Printer`  
2. **打开打印机句柄**：`OpenPrinter`  
3. **启动文档**：`StartDocPrinter` / `StartPagePrinter`  
4. **写入数据**：
   - **RAW**：向打印机写 PCL/PDF（多数现代驱动支持 PDF/PCL，**不保证**）  
   - **GDI**：`StartDoc` + `StartPage` + 设备上下文画图（复杂）  
5. **控制份数、双面、纸张**：`SetJob` / `DocumentProperties` / DEVMODE  

| 优点 | 缺点 |
|------|------|
| 可指定打印机、份数、双面 | 工作量大；驱动差异极大 |
| 可静默 | 字体/矢量/Office 排版需自己画或先转 PDF |
| 测试可 mock 假打印机 | Windows API 安全与权限、64 位绑定成本高 |

**可行子集**：先把「PDF 字节 → 某打印机」用 **RAW PDF** 或 **调用系统打印处理器** 做通；GDI 逐页绘制作为后备。  
**不推荐**第一期做完整 GDI 排版。

---

### 路线 D — 外部打印链（降级）

- 生成 PDF 后调用 `SumatraPDF -print-to "打印机" file.pdf` 等外部工具  
- 或 PowerShell `Start-Process file.pdf -Verb Print`  

| 优点 | 缺点 |
|------|------|
| 实现快 | 依赖第三方/阅读器默认打印机；无法精细控制双面/纸盒 |
| | 隐私与体积；用户未装阅读器则失败 |

适合**应急降级**，不适合作为产品主路径。

---

## 4. 与现有功能对照

| 现有能力 | 路线 A | 路线 B | 路线 C |
|----------|--------|--------|--------|
| 独立打印设置窗 | 保留 | 保留 | 保留 |
| 逐文件纸张/方向/页码 | 应用内排版保留 | 部分交给系统对话框 | 应用内 + DEVMODE |
| 适合纸张/实际大小/仅缩小 | 渲染时计算（可复用） | 弱 | 强（需驱动配合） |
| 页序奇偶/逆序 | 渲染顺序（可复用） | 弱 | 中 |
| 批量提交 | 生成多个 PDF 或合并 | 多次弹窗 | 队列 + StartDoc 多次 |
| 静默出纸 | **否**（或仅生成文件） | **基本否** | **是**（目标） |
| 自动化测试 | 断言 PDF 字节 | 难 | mock 打印机 / 内存 job |
| 「已提交 ≠ 出纸」文案 | 仍成立 | 仍成立 | 仍成立 |

---

## 5. 推荐架构（若立项 Tauri）

```
┌─────────────────────┐
│ 打印设置窗 (Vue)     │  参数、队列 UI（可复用 PrintPanel）
└─────────┬───────────┘
          │ invoke print_queue_submit
┌─────────▼───────────┐
│ Rust 打印服务        │  队列、超时、状态
├─────────────────────┤
│ 1. 排版              │  前端隐藏窗或 Rust 拼版 → PDF
│ 2. 选择通道          │  A: 写 PDF + 系统打开
│                      │  C: RAW/GDI 提交到打印机
│ 3. 状态              │  已生成 / 已提交系统 / 失败原因
└─────────────────────┘
```

**分阶段**：

1. **MVP（A）**：只做「应用内生成 PDF + 系统打印」；验收 A4/A5、页范围、批量生成。  
2. **增强（C1）**：RAW PDF → 指定 `deviceName`；份数；尽量 duplex。  
3. **增强（C2）**：DEVMODE 纸张探测与错误映射（对应现有「可能不支持 A5」文案）。

---

## 6. PoC 门禁（必须全过才考虑迁）

| ID | 门禁 | 方法 |
|----|------|------|
| D1 | A4/A5 物理尺寸正确 | 对比 PDF MediaBox（现 Electron 测试思路） |
| D2 | 页范围/页序/缩放语义一致 | 生成 PDF 后核页数与顺序 |
| D3 | 批量 2 文件顺序提交 | 两个 PDF 或两个 job 记录 |
| D4 | 指定打印机（或书面接受「仅系统对话框」） | 真机或虚拟打印机 |
| D5 | 失败文案可映射（纸张不支持等） | 驱动错误 → 中文提示 |
| D6 | 不向实体机误打 | 测试用 Microsoft Print to PDF / 截获 |

**任一 D 失败 → 继续 Electron。**

---

## 7. 成本与风险估计

| 项 | 估计 |
|----|------|
| 路线 A MVP | 数天–1 周（复用排版 + PDF 导出） |
| 路线 C 可靠静默打印 | 数周–更长；驱动兼容持续成本 |
| 测试栈迁移 | printing 套件几乎重写；页尺寸断言可保留思路 |
| 回归面 | 所有格式预览 + 多窗口 + 安装 Open With |

**体积/性能收益**通常不足以覆盖打印重写成本；若打印是产品核心（当前是），**不建议现在迁**。

---

## 8. 结论与建议

1. **Tauri 2 打印没有「Electron print」等价物**；必须接受 **降级体验** 或 **自研 Windows 打印绑定**。  
2. **推荐路径**：先做 **路线 A（生成 PDF + 系统打印）** 的 PoC；仅当 D1–D3 通过且业务接受非静默，再谈是否迁。  
3. **若必须静默批量 + 指定打印机**：走 **路线 C**，按 RAW PDF → DEVMODE 分两期，不要一期做完 GDI。  
4. **当前决策**：**留在 Electron**，直到 D 门禁在真机（或你指定的虚拟打印机）上全部通过。  

PoC 环境与阶段说明见 [TAURI2-MIGRATION-VALIDATION.md](TAURI2-MIGRATION-VALIDATION.md)。
