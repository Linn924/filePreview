# 测试执行说明

每次新增或修改功能都要测试。先根据下表选择套件，完成后记录命令、结果和未验证边界。公共层变更必须覆盖其依赖模块，不能只验证页面能打开。

## 首次准备

Windows x64、Node.js 22.12+：

```powershell
npm ci
npm run test:fixtures
npm test -- --suite all
```

fixtures 命令在 `work/fixtures/` 生成样例，并下载公开 DOC/PPT/PPTX 测试文件。需要网络的只有依赖安装和样例准备，应用运行和测试预览均在本机完成。不要把私人文件放入可提交的样例目录。

## 集中执行与选择

```powershell
npm test -- --suite core
npm test -- --suite ppt,pdf
npm test -- --suite word,excel
npm test -- --suite text,image
npm test -- --suite all
```

入口 `tests/run.ts` 先执行类型检查和生产构建，再运行基础逻辑测试与选择的 Electron 套件。不认识的套件名直接失败，不会静默跳过。仅在确认源码自最近构建后没有变动时，才可使用 `--skip-build`；测试文件本身每次都会重新编译。

主进程/预加载通过与产品相同的 `electron-dist/` 加载。测试使用独立的 `work/test-profiles/<pid>/` 设置目录，不修改开发者真实偏好。格式测试在真实 Electron 渲染窗口运行，结果写入 `outputs/verification/tests-<suite>.txt`，失败返回非零退出码并保存 failure.txt。

## 影响矩阵

| 修改位置/行为                        | 必跑套件                              | 原因                                    |
| ------------------------------------ | ------------------------------------- | --------------------------------------- |
| modules/text                         | text                                  | 编码、JSON、Markdown 与文本缩放         |
| modules/image                        | image                                 | 解码、适配与缩放                        |
| modules/excel                        | excel                                 | 格式化、合并区域、Sheet、行列分页、列宽 |
| modules/word                         | word                                  | DOC/DOCX、表格、分页和缩放              |
| modules/ppt                          | ppt                                   | 两种文件格式、文字、尺寸、页码与缩放    |
| modules/pdf                          | pdf                                   | 页面像素、字体、翻页、缩放              |
| useWheelPreview / ZoomControl        | word,excel,ppt,pdf,text,image         | 六种格式共用滚轮和倍率状态              |
| resizeTable                          | word；若改列宽通用行为再加 excel      | 真实鼠标列边界拖动                      |
| App / PreviewTab / 模块注册 / shared | all                                   | 多窗口、标签生命周期影响全部格式        |
| electron / preload / settings        | core + 实际受影响格式                 | IPC、窗口、设置、托盘、文件读取         |
| UI 主题/共享样式                     | core + 受影响格式截图；范围不明时 all | 深色外观不能污染文档原色                |
| 文件关联/安装配置/图标/构建流程      | core + package 检查 + 安装手工步骤    | 源码运行正常不代表安装产物正确          |

## 套件内容与成功标准

### 基础逻辑（每次都执行）

`tests/unit.ts`：缩放限制 25–400%、滚轮方向、无效设置回退、设置字段白名单、中文 Windows 文件路径识别。未知字段不得写进设置对象。

### core：设置、窗口、标签、托盘、安全

文件：`tests/suites/core.ts`。

1. 首页加载用户 logo；旧宣传文案、只读标记和底部状态条不存在。
2. 设置中选择黑夜；文档根节点主题同步，preferences.json 只包含偏好字段，不包含路径或历史。
3. 多文件首次询问选择标签页；出现两个文件标签，选择被记住。
4. 切换、拖动排序、关闭标签；关闭后对应预览组件移除，其他标签仍存在。
5. 再次多选不重复询问；设置为独立窗口后创建两个窗口，默认最大化。
6. 关闭窗口首次选择隐藏到托盘；窗口隐藏而进程存活，再次关闭使用记忆选择。
7. 外网请求被拦截，session 非持久化，主进程已交付 payload 释放。

`tests/quit.entry.ts` 另起进程验证选择“退出软件”会真正结束应用。所有套件执行前后对已有样例计算 SHA256，预览、缩放和列宽调整不得改变源文件。基础检查还验证生成的 NSIS 注册只添加 Open With 候选，不改扩展名默认值或 UserChoice。

系统模态选择框在测试中替换返回值，以便自动化；真实对话框文案、按钮位置、托盘菜单操作还应按下方手工流程检查。

### word

文件：`src/modules/word/tests/e2e.ts`；样例 `document.docx`、`legacy.doc`、`broken.docx`。

检查 DOCX/DOC 内容、DOCX 表格边界控件；通过真实鼠标事件拖动列边界，单元格必须实际变宽；内容滚轮后倍率同步。自动从样例生成含分页符的 `pages.docx`，验证内容外滚轮前进到 2 / 2、再返回 1 / 2。损坏文件必须显示明确错误。Word 分页依赖实际渲染页面，不伪造旧 DOC 页数。

### excel

文件：`src/modules/excel/tests/e2e.ts`；样例 `styled.xlsx`、`legacy.xls`、`table.csv`。

断言深蓝背景合并标题、百分比格式、列边界真实拖宽、滚轮倍率同步、内容外滚轮进入第 201 行、后续列组可访问第 105 列。不能把分页隐藏误认为数据丢失。

### ppt

文件：`src/modules/ppt/tests/e2e.ts`；样例 `presentation.pptx`、`legacy.ppt`。

两种格式分别检查 Shadow DOM 中的内容文本、页面宽高非零且适配；外侧滚轮后底部页码变为 2；内部滚轮后顶部倍率变为 110%。保存截图，检查文字未被清洗丢弃、页面比例正常、应用 CSS 不影响幻灯片。复杂文稿必须补充对应最小样例，不能据此承诺所有 PPT 保真。

### pdf

文件：`src/modules/pdf/tests/e2e.ts`；两页样例 `document.pdf`。

检查画布有非白色像素，外侧滚轮到第二页，内部滚轮改变倍率，自定义 137% 生效。修改渲染取消逻辑后，应快速连续滚轮和缩放，不能出现画布同时渲染错误。

### text / image

各模块 `tests/e2e.ts`。文本检查原文安全显示、JSON 格式化/无效 JSON 回退、Markdown 渲染；图片检查 PNG/SVG/JPEG/WebP/GIF/BMP 的实际解码。缺失的小型位图样例由图片测试自动生成。均检查滚轮后倍率同步；图片还检查显示尺寸随倍率连续变化，不在 100% 与 110% 之间跳回原始尺寸。扩展某种编码或图片格式时，应在对应套件加入真实样例和断言。

## 安装包与 ZIP 验证

```powershell
npm run build:win
npm run test:package
```

打包测试启动真实 EXE，通过文件路径参数打开文件，并检查另一个进程再次打开文件可交付现有应用；启动测试时使用独立设置目录。用于测试的调试端口仅由测试进程命令行启用，不写入应用配置。

安装手工验收（在测试机器上执行）：

1. 安装新版，确认桌面/开始菜单/窗口/托盘均显示提供的眼睛 logo。
2. 右击 PDF、DOCX、XLSX、PPTX → 打开方式 → File Preview；第一次启动和已运行时分别检查。
3. 含空格、中文的路径也能打开；不得把默认 Office 关联强制替换。
4. 完整解压 ZIP，运行 EXE；手动“选择其他应用”指向 ZIP 内 EXE 也能打开文件。
5. 点击 ×，依次验证取消、隐藏和退出；退出应关闭所有预览，托盘菜单能恢复和彻底退出。
6. 重启后主题、关闭方式、多文件方式仍保留；不能恢复上次文件或显示最近路径。
7. 内容内滚轮缩放、灰色边缘滚轮翻页，确认页码/倍率实时同步。
8. DOCX 表格拖宽后关闭重开，源文件不应发生变化。

## 新模块约定

新建 `src/modules/<type>/index.ts`、`index.vue`、处理器、样式及 `tests/e2e.ts`，在模块注册表和测试注册表分别注册。样例生成逻辑属于开发测试；产品处理器不得写文件。每个修复用例写明触发条件和预期变化，避免只断言元素存在。
