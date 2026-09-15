# DESIGN NOTES — File Preview

## Mode
Existing-codebase + convention (desktop utility). Familiarity over flair.

## Direction
Modular chrome: header / tabs / filebar / **document stage** / page-nav.
Content is the hero; chrome stays quiet.

## Palette (2026-09-15 refine — 注意配色)
| Token | Light | Role |
|-------|-------|------|
| --bg | #EEF1F6 | 桌面底，冷灰 |
| --panel | #FFFFFF | 工具条/面板 |
| --stage | #E5EAF2 | 文档舞台（略深于 bg，衬白纸） |
| --well | #F5F7FA | 悬停/弱底 |
| --text | #1C2434 | 主文字（对比 ≥ 4.5 on panel） |
| --muted | #5C6B7F | 次要文字 |
| --line | #D9E0EA | 分隔线 |
| --accent | #1F5F9E | 信任蓝，仅主操作/强调 |
| --accent-soft | #E8F0F8 | 徽章/图标弱底 |
| --danger | #B42318 | 错误 |

Dark: bg #11171F · panel #1A222C · stage #0D1218 · accent #8BB8E8（深底上文字用 #0C1218）

## Type
Segoe UI / Microsoft YaHei / system-ui。11–16px。无网络字体。

## Avoid
霓虹蓝、大渐变、硬编码 hex 与 var 混用、无焦点环。

## User preference
简洁、可接受、模块化；类名勿改（测试依赖）。