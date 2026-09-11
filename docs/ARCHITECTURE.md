# 架构

## 边界

- `src/modules/`：每个文件类型独立目录。入口 `index.ts` 提供扩展名与组件，`index.vue` 装配本类型 UI；专属解析/渲染处理器、组件、测试随模块存放。
- `src/modules/index.ts`：唯一渲染模块注册表。App 通过扩展名查询模块，不包含格式分支。
- `src/components/`：预览容器、缩放输入、设置等跨类型组件；App 负责文件标签的排列与选择，不解析内容。
- `src/composables/`：连续页码定位、列宽调整等共享行为。
- `shared/`：主进程、预加载、渲染进程共用的类型与设置契约。
- `electron/`：本地文件只读、窗口和托盘生命周期、设置存储、安全策略与 IPC；不包含文档格式解析。
- `tests/`：集中测试执行器，按模块选择；格式断言位于对应模块的 tests 目录。

## 文件与状态生命周期

主进程读取用户选定文件 → 一次性交付对应窗口 → 主进程释放数据 → 渲染端标签页持有内存 → 关闭标签/窗口释放。设置文件只包含有限的主题、关闭方式、多文件方式和缩放偏好，不包含文档数据或路径。

模块间不相互引用解析实现；共享行为通过类型化 props/emits 和公共组合函数连接。缩放值由窗口标签状态拥有，模块发出更新事件；页码由格式模块拥有，原生滚动更新页码，按钮和输入仅滚动定位。

## 构建与扩展

每个格式目录包含 `index.ts`、`index.vue`、`style.css`、解析组合函数或渲染器，以及 `tests/e2e.ts`。格式 CSS 应限定在本类型容器下，避免提高通用表格选择器的优先级；Word/PPT 的第三方内容放入 Shadow DOM 隔离。

`npm ci` 后运行 `npm run build:win` 生成 Windows 安装包与 ZIP。`npm run build` 依次类型检查、转换用户图标、编译 Electron 主进程/预加载、生成 Open With 安装注册、构建 Vue 和复制离线 PDF 资源与第三方许可证。源文件均为 TypeScript；生成的 `electron-dist/`、`dist/` 不提交。

`scripts/associations.ts` 从共享扩展名列表生成 NSIS 注册，仅添加本软件的 Open With 候选。卸载仅移除本软件的键，不写入扩展名默认值或 UserChoice。

修改前先按 [测试说明](TESTING.md) 选择影响范围；共享层改动运行完整套件。后续功能记录在 [BACKLOG.md](BACKLOG.md)。

## 3.1 连续阅读与跨窗口移交

`PageNavigation` 负责页码输入与按钮，`useContinuousPages` 读取滚动位置并定位 DOM 页面。Word 保持真实 DOCX 分页；PDF 保留全部页面占位、按可见范围渲染并释放离屏画布；PPT 在隔离根内连续排列静态幻灯片；Excel 滚动逐批追加行。所有模块均不拦截滚轮。

`electron/transfers.ts` 只记录文件 ID 的归属与限时移交事务，不常驻缓存文件内容。来源窗口收到 export 请求后通过内存 IPC 交付；目标插入标签后 accept，主进程才通知来源 remove。超时、窗口关闭或无效 ID 取消移交，未确认前源标签仍保留。拖动使用应用专属 DataTransfer 类型，不创建磁盘临时文件。
