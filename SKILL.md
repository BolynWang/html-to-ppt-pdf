---
name: zan-html-to-ppt
description: 把 guizang-ppt-skill 生成的 HTML 横向翻页 deck 转成 deck.pdf + deck.pptx(图片型),供线下演讲使用。逐页 1920×1080 截图,封装成 PDF 和 PPTX。注意:PPTX 是"图片型"(每页一张 PNG 满版背景),内文不可编辑;视觉 100% 还原(含 WebGL 背景静帧)。需要文字可编辑见 SKILL.md 末尾的 v2 计划。
---

# zan-html-to-ppt

## 何时使用
- guizang-ppt-skill 出的 HTML 横向翻页 deck,需要带去**线下演讲**(必须是 .pptx 或 .pdf)
- 不需要可编辑文字,要的是**视觉 100% 还原**(含 WebGL 背景静帧)
- 关键词触发:"deck 转 PPT" / "HTML 转 pptx" / "导出 deck" / "离线 deck"

## 调用方法(给 LLM 看的步骤)

1. 询问 / 确认 deck 的位置(三种之一):
   - HTTP URL,例 `http://localhost:8810/deck/`
   - **本地 HTML 文件**,例 `/path/to/deck/index.html`(skill 自动起 http server,处理 `<base href>`)
   - 本地目录(默认找 `index.html`)
2. 确认输出目录(默认 `./out`)。
3. `cd <SKILL_ROOT>/scripts`,如果没有 `node_modules`,先跑:
   ```bash
   npm install
   npx playwright install chromium
   ```
4. 跑主脚本:
   ```bash
   node build.mjs <url-or-path> --out <output-dir>
   ```
5. 等结束,产物在 `<output-dir>/deck.pdf` + `<output-dir>/deck.pptx` + `<output-dir>/frames/`。

## 命令行参考

```bash
node build.mjs <url-or-path> [--out ./out] [--width 1920] [--height 1080] [--wait 2500] [--format pdf,pptx]
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `<url-or-path>` | 必填 | URL 或本地路径(文件 / 目录) |
| `--out` | `./out` | 输出目录 |
| `--width` | `1920` | 截图宽,16:9 基准 |
| `--height` | `1080` | 截图高 |
| `--wait` | `2500` | 每页翻到后等待入场动画的毫秒数;动画长就调大 |
| `--format` | `pdf,pptx` | 输出格式,逗号分隔 |

## 产物

```
<out>/
├── deck.pdf            ← 多页 PDF,每页 16:9 满版
├── deck.pptx           ← 每页一张 PNG 满版背景(图片型 · 不可编辑)
└── frames/             ← 每张原始 PNG
    ├── slide-01.png
    ├── slide-02.png
    └── ...
```

## 工作原理

1. 本地路径? → 起一个临时 http server,**根据 `<base href="/X/">` 决定服务根**(例 `<base href="/deck/">` → 服务 deck 父级,URL 跳到 `/deck/`)
2. Playwright Chromium **1920×1080** 打开
3. 等 `document.fonts.ready` + `networkidle` + 1.5s(给 WebGL 暖机 + 字体加载)
4. **按 `B` 进静态模式**(guizang 内建快捷键 —— 关动效、保留 WebGL 背景静帧)
5. 数 `document.querySelectorAll('section.slide').length`
6. 逐页:`document.querySelectorAll('#nav .dot')[i].click()` 跳 → 等 `--wait` 毫秒让入场动画跑完 → 截图
7. `pdf-lib` 拼 PDF,`pptxgenjs` 拼 PPTX(每页用 `addImage` 满版背景)

## 已知 trade-off(必须接受)

- **WebGL 背景动效 → 冻成静帧**(截图是某一瞬间)
- **PPTX 的文字/图都不可编辑**(每页是一张 PNG 满版背景)
- **PDF 是栅格(不是矢量字),放大会糊** —— 用 `--width 2560 --height 1440` 出 2K 缓解
- 需要**"文字可编辑 + 图可编辑"** → 见 v2 计划

## 故障排查

| 现象 | 原因 | 处理 |
|---|---|---|
| 内容空白 / 缺文字 | 入场动画 stagger 没跑完 | `--wait 4000` 或更大 |
| 字体没正确渲染 | Google Fonts 没下完 | `--wait 4000` + 确认网络 |
| 某页排版漂 | 视口和 deck 设计基准不一致 | 用 `--width 1920 --height 1080`(guizang 设计基准) |
| 本地 HTML 图片 404 | `<base href>` 路径解析错 | 把 deck **整个目录**给 skill;或 host 在 http server 上传 URL 进来 |
| Chromium 启不来 | 没装 | `npx playwright install chromium` |
| WebGL 背景一片黑 | headless 渲染问题 | 加 `--enable-webgl`(脚本默认已加) |

## v2 计划(还没实现 · 待迭代)

混合型 PPTX:**背景截图(把文字 CSS 临时透明再截图) + 顶层可编辑文本框(从 DOM `getBoundingClientRect()` 取位置 + `getComputedStyle()` 取字号/颜色)**。
- 文字可编辑 ✅
- `<img>` 元素 → PPTX 嵌入图(独立可改) ✅
- WebGL 背景 → 跟着背景图走(不可编辑)
- 字体可能换;长段中文换行可能漂 ~1 字。
