---
name: zan-html-to-ppt
description: 把 guizang-ppt-skill 生成的 HTML 横向翻页 deck 逐页截图，封装成 deck.pdf + deck.pptx（图片型），用于线下演讲。1920×1080 全帧捕获，WebGL 背景静帧保留，视觉 100% 还原；PPTX 是图片型（内文不可编辑，可直接投影演示）。当用户需要把 HTML deck 转 PDF/PPTX、guizang skill 出来的 deck 导出离线演示文件、deck 转 PowerPoint、HTML 转 PPT、把网页 PPT 做成线下可交付的 pptx 时使用。
---

# zan-html-to-ppt

> 把 guizang-ppt-skill 出来的横向翻页 HTML deck 转成线下能用的 PDF + PPTX。
> 原理：Playwright 控 Chromium 1920×1080 逐页截图，封装成多页 PDF（pdf-lib）和图片型 PPTX（pptxgenjs）。

## 这个 Skill 做什么

输入一个 guizang-ppt-skill 风格的 HTML deck（横向翻页、单文件、`<section class="slide">` 结构），产出三份**离线演示资产**：

- **`<out>/deck.pdf`** —— 多页 PDF，每页 16:9 满版。投影 / Preview / Acrobat 直接全屏播。
- **`<out>/deck.pptx`** —— 每页一张 PNG 满版背景的 PPTX（图片型）。可上传任何 PPT 平台。
- **`<out>/frames/slide-NN.png`** —— 每页原始 PNG，1920×1080。

## 何时使用

- guizang-ppt-skill 出来的 HTML deck 需要做成 **.pptx / .pdf** 带去**线下演讲**
- 评审 / 加速器 / 企业内训等场子**必须提交 PowerPoint 文件格式**
- 不需要可编辑文字，要的是**视觉 100% 还原**（含 WebGL 背景静帧）
- 关键词：`deck 转 PPT` / `HTML 转 pptx` / `导出 deck` / `离线 deck` / `html-to-ppt` / `网页 PPT 转 PowerPoint`

## 工作流

### Step 1 · 询问必要信息（**动手前必做**）

向用户问清：

1. **deck 位置**（三种之一，必填）：
   - 已经在跑的 http URL，例 `http://localhost:8810/deck/`
   - 本地 HTML 文件路径，例 `/path/to/deck/index.html`（skill 自动起 server）
   - 本地目录（默认找 `index.html`）
2. **输出目录**（可选，默认 `./out`，建议建一个新目录避免覆盖旧产物）
3. **比例**（可选，默认 `1920×1080`；2K 屏出片用 `--width 2560 --height 1440`）
4. **格式**（可选，默认两个都出；只要 PDF 用 `--format pdf`，只要 PPTX 用 `--format pptx`）

### Step 2 · 检查依赖

```bash
cd <SKILL_ROOT>/scripts
[ -d node_modules ] || npm install
[ -d "$HOME/Library/Caches/ms-playwright" ] || npx playwright install chromium
```

**首次运行**：要装 `playwright + pdf-lib + pptxgenjs`（npm ~50MB）+ Chromium（~150MB）。慢一点，告诉用户在装。
**之后**：跳过，直接 Step 3。

### Step 3 · 跑主脚本

```bash
node build.mjs <url-or-path> --out <output-dir>
```

参数:

| 参数 | 默认 | 说明 |
|---|---|---|
| `<input>` | 必填 | URL / 本地 HTML 文件 / 本地目录 |
| `--out <dir>` | `./out` | 输出目录 |
| `--width <px>` | `1920` | 截图宽 |
| `--height <px>` | `1080` | 截图高 |
| `--wait <ms>` | `2500` | 每页翻到后等动画跑完的毫秒数 |
| `--format pdf,pptx` | 都出 | 输出格式（逗号分隔） |

成功输出长这样：

```
🌐  http server :60199  root=/path/to/web
📍  Open: http://localhost:60199/deck/
📐  Viewport 1920×1080  · wait=2500ms · out=/path/to/out
🎞  8 slides
  ✓ 1/8
  ✓ 2/8
  ...
📄  deck.pdf
📊  deck.pptx
✅ Done → /path/to/out/
```

### Step 4 · 报告产物

告诉用户：
- `<out>/deck.pdf` 路径
- `<out>/deck.pptx` 路径
- 总页数
- 调试可看 `<out>/frames/slide-NN.png`

## 关键技术细节（LLM 理解脚本行为）

1. **本地路径如何变 URL**：`build.mjs` 检测 HTML 里的 `<base href="/X/">`，从 fileDir 向上走 X 一级当服务根（例 `<base href="/deck/">` → 服务 deck 父级，URL = `/deck/`）。这样图片路径才解析得对。
2. **静态模式**：打开 deck 后按 `B`（guizang 内建快捷键）关动效，WebGL 背景仍保留一帧。
3. **逐页跳转**：`document.querySelectorAll('#nav .dot')[i].click()` —— 用 deck 自身的导航点，**不模拟键盘**（键盘事件容易被 SPA 吃掉）。
4. **截图前等待**：翻页后等 `--wait`（默认 2.5s）让入场动画 stagger 跑完，否则后段文字会缺。
5. **fonts.ready**：打开页面后等 `document.fonts.ready` + `networkidle` + 1.5s 给 WebGL 暖机，字体才渲染对。

## 故障排查

| 现象 | 原因 | 改 |
|---|---|---|
| 帧里内容缺 / 一片空白 | stagger 没跑完 | `--wait 4000` 或更大 |
| 字体没渲染对 | Google Fonts 没下完 | `--wait 4000` + 确认有网 |
| 某页排版漂 | 视口和 deck 设计基准不一致 | `--width 1920 --height 1080`（guizang 设计基准） |
| 本地 HTML 图片 404 | `<base href>` 路径错 | 给 skill **整个目录**，不要单文件 |
| Chromium 启不来 | 没装 | `npx playwright install chromium` |
| WebGL 背景一片黑 | headless 渲染问题 | 脚本默认已加 `--enable-webgl --use-gl=swiftshader`，仍黑就改 `--width` 试 |
| 帧颜色偏 / 模糊 | deviceScaleFactor 不对 | 脚本默认 1，2K 出片用 `--width 2560 --height 1440` |

## 资源文件导览

```
zan-html-to-ppt/
├── SKILL.md           ← 你正在读
├── README.md          ← GitHub 主页给人看的
├── LICENSE            ← MIT
├── .gitignore
└── scripts/
    ├── package.json   ← 依赖：playwright + pdf-lib + pptxgenjs
    ├── package-lock.json
    └── build.mjs      ← 主脚本（单文件搞定截图 + PDF + PPTX）
```

## 核心设计原则

1. **不重发明轮子，用 deck 自身的 API**：`B` 键、`#nav .dot[i].click()` 都是 guizang 内建，直接用，不靠模拟键盘或私有 hook。
2. **本地路径优先，自动起 server**：用户不用自己 host http server，skill 自己起，处理 `<base href>` 解析。
3. **视觉还原优先于"可编辑性"**：v1 是图片型，接受 trade-off 换 100% 视觉还原；可编辑混合版做 v2。
4. **单文件主脚本**：`build.mjs` 一个文件搞定截图 + PDF + PPTX，不拆 helper（~200 行）。

## v2 计划（待迭代）

**混合型 PPTX：背景截图（无字） + 顶层可编辑文本框 + `<img>` 独立嵌入**

实现思路:
1. 临时把所有文字 CSS `color: transparent` 后截图 → 当背景（layout 保留，文字不在像素里）
2. 从 DOM 量每段文字：`getBoundingClientRect()` 取位置，`getComputedStyle()` 取字号 / 颜色 / 字重 / 字体
3. PPTX 每页：背景 = 无字截图，顶层 = `slide.addText(...)` 可编辑文本框，位置 + 样式按 DOM 量
4. `<img>` 元素 → 独立的 `slide.addImage(...)`，在 PPTX 里可拖动可换图

接受的 trade-off：
- WebGL 背景渐变 / 光斑 → 跟着背景图走（不可编辑）
- 字体可能换（Google Fonts 在对方电脑可能没装）
- 长段中文换行可能漂 ~1 字（WebKit 和 PowerPoint 断行算法不同）

触发方式：`node build.mjs <input> --mode editable`（v0.2 加）

## 上游依赖

输入端依赖 [guizang-ppt-skill](https://github.com/op7418/guizang-ppt-skill) 生成的 HTML 结构。具体依赖的 API：

- `<section class="slide">` 是页面容器
- `#nav .dot[i]` 是页码导航点（用于跳转）
- 键盘 `B` 切静态模式
- `document.fonts.ready` Web Fonts API

只要 deck 满足上面这套结构，就能转。
