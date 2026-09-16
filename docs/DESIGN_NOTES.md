# DESIGN NOTES — File Preview

## Mode
Existing-codebase + convention (Windows compact desktop tool). **方案 B**.

## Tokens (Plan B)
- Light: bg #F3F5F8 · panel #FFF · stage #DCE2EA · accent #0F6CBD · muted #5F6B7A
- Dark: bg #1B1F27 · panel #252A32 · stage #12161C · accent #60A5FA
- Control h 28px · radius 6px · tab bar 36 · filebar 36 · page-nav 28
- Type: Segoe UI / Microsoft YaHei 11–13px

## Home
- First-run intro (localStorage `fp-home-intro-v1`): soft fireworks +「小乖专属软件」
- Credit **By 仔仔**
- Primary「打开文件」+ drop hint + quiet format chips
- `prefers-reduced-motion`: no intro animation

## Avoid
Emoji icons (use inline SVG), tall empty headers, neon, mixed hex tokens.

## User preference
简洁 / 紧凑 / 模块化；**不破坏现有功能与测试类名**。
