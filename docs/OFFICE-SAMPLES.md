# Office 复杂排版样例库

用于兼容性回归的**最小复现**样例。生成命令：`npm run test:fixtures`。不提交隐私业务文件。

| 文件 | 生成方式 | 覆盖点 |
| --- | --- | --- |
| `work/fixtures/complex-table.docx` | 本地 JSZip 生成 | 三列表格、宽备注列、中文单元格；用于列宽拖动与跨窗口迁移 |
| `work/fixtures/styled.xlsx` | fixtures 脚本 | 合并单元格、主题色、百分比、多 Sheet、宽表 |
| `work/fixtures/pages.docx` | word 测试自动生成 | 分页符与连续滚动 |
| `work/fixtures/long-mixed.pdf` | pdf 测试 / bench 生成 | 80 页横竖混合 |
| `work/fixtures/presentation.pptx` | 外网下载（MIT） | PPT 静态布局 showcase |
| `work/fixtures/legacy.ppt` | 外网下载（MIT） | 旧 PPT |
| `work/fixtures/legacy.doc` | 外网下载（Apache-2.0） | 旧 DOC 降级提示 |

## 收集原则

1. 无个人隐私、无公司敏感数据。  
2. 能单独复现一类问题（表格、字体、合并、动画缺失等）。  
3. 修复时在对应模块 `tests/` 增加断言，并在本表登记。  
4. 外网样例变更需更新许可说明（见 fixtures 脚本输出）。

## 已知边界

本库**不承诺**像素级还原全部 Word/PPT；每次修复只声明已验证范围。旧格式排版弱于新格式。
