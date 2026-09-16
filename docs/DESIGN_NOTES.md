# DESIGN NOTES — File Preview

## Mode
Existing-codebase + convention (Windows compact desktop tool). **方案 B**。

## Tokens (Plan B · prototype.html)
- Light: bg #F3F5F8 · panel #FFF · stage #DCE2EA · accent #0F6CBD · muted #5F6B7A · line #C9D1DB · well #F0F3F7
- Dark: bg #1B1F27 · panel #252A32 · stage #12161C · accent #60A5FA · muted #9BA6B5 · line #3A4452 · well #2C3340
- Control 28px · radius 6px · tab bar 36 · fixed tab 168px · idbar 28 · actbar 36 · page-nav 28
- Icons: inline SVG only (printer / gear / upload)

## App icon
**方案 1 文档眼** — 蓝底 `#0F6CBD`、白页、行线、右下预览镜。已生成 `assets/logo.png` + `assets/icon.ico`。

## Home- Intro once (`fp-home-intro-v1`): fireworks in upper band + 「小乖专属软件」above dropzone
- Credit **By 仔仔**
- Dropzone semi-transparent so fireworks show around it

## Print
- Toolbar: **icon-only printer** (tooltip 打印)
- Card: one-line summary; page-size list only when 「设置」expanded

## Tabs
- Fixed 168px · hover well · no white name chip · title tooltip = full name

## Avoid
Emoji, stacked CSS layers, `display !important` on `v-show` hosts.

## User preference
简洁 / 紧凑 / 模块化；**每轮迭代更新 README**；不破坏功能与测试类名。
