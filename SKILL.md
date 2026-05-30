---
name: zan-html-to-ppt
description: 把 guizang-ppt-skill 生成的 HTML 横向翻页 deck 转成 deck.pdf 和 deck.pptx，供线下演讲、加速器/评委上传、印刷等场子使用。**只要用户提到 HTML deck 转 PPT、deck 导出 PowerPoint、网页 PPT 转 pptx、HTML 转 PowerPoint、把幻灯片/演讲材料/演示文件做成离线版、需要 .pptx 上传，就用这个 skill**，即使用户没说 "guizang" 字样。产出是图片型 PPTX（每页一张 PNG 满版，视觉 100% 还原但内文不可编辑）。
---

# zan-html-to-ppt

> 把 guizang-ppt-skill 出来的横向翻页 HTML deck 转成线下能用的 PDF + PPTX。
> 原理：Playwright 控 Chromium 逐页截图，封装成多页 PDF（pdf-lib）和图片型 PPTX（pptxgenjs）。

## 这个 Skill 做什么

输入一个 guizang-ppt-skill 风格的 HTML deck（横向翻页、单文件、`<section class="slide">` 结构），产出三份**离线演示资产**：

- **`<out>/deck.pdf`** —— 多页 PDF，每页 16:9 满版。投影 / Preview / Acrobat 直接全屏播。
- **`<out>/deck.pptx`** —— 每页一张 PNG 满版背景的 PPTX（图片型）。可上传任何 PPT 平台。
- **`<out>/frames/slide-NN.png`** —— 每页原始 PNG，默认 5760×3240（`--scale 3`）。

## 工作流

### Step 1 · 问清必要信息（**动手前必做**）

向用户问清：

1. **deck 位置**（三种之一，必填）：
   - 已经在跑的 http URL，例 `http://localhost:8810/deck/`
   - 本地 HTML 文件路径，例 `/path/to/deck/index.html`（skill 自动起 server）
   - 本地目录（默认找 `index.html`）
2. **输出目录**（可选，默认 `./out`，建议建一个新目录避免覆盖旧产物）
3. **清晰度 / 比例**（可选，默认 `--scale 3` 出 5760×3240 超清；文件嫌大可降到 `--scale 2`）

### Step 2 · 装依赖

```bash
bash <SKILL_ROOT>/scripts/setup.sh
```

幂等。首次跑会装 npm 依赖 + Chromium（~150MB，1–2 分钟，**告诉用户在装别静默等**）；之后秒过。

### Step 3 · 跑主脚本

```bash
node <SKILL_ROOT>/scripts/build.mjs <input> --out <output-dir>
```

参数:

| 参数 | 默认 | 说明 |
|---|---|---|
| `<input>` | 必填 | URL / 本地 HTML 文件 / 本地目录 |
| `--out <dir>` | `./out` | 输出目录 |
| `--width <px>` | `1920` | CSS 视口宽（影响布局基准） |
| `--height <px>` | `1080` | CSS 视口高 |
| `--scale <n>` | `3` | deviceScaleFactor。`3` 出片 5760×3240（超清）；糊就保持 3，文件嫌大降到 2 |
| `--wait <ms>` | `2500` | 每页翻到后等动画跑完的毫秒数 |
| `--format pdf,pptx` | 都出 | 输出格式（逗号分隔） |

成功输出长这样：

```
🌐  http server :60199  root=/path/to/web
📍  Open: http://localhost:60199/deck/
📐  Viewport 1920×1080 · scale=3× (出片 5760×3240) · wait=2500ms · out=/path/to/out
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
- 总页数（脚本输出里有 `🎞  N slides`）
- 调试可看 `<out>/frames/slide-NN.png`

## 调用范例

**用户**：
> 把我这个 deck 转成 PPT —— `/Users/X/web/deck/index.html`，输出到 `~/Downloads/2026q4-pitch/`

**你（Agent）**：

```bash
# 1. 首次装依赖（之后秒过）
bash <SKILL_ROOT>/scripts/setup.sh

# 2. 跑
node <SKILL_ROOT>/scripts/build.mjs /Users/X/web/deck/index.html --out ~/Downloads/2026q4-pitch/
```

看到脚本输出 `🎞  8 slides` … `✅ Done`，然后回报用户：

> 转好了 ✅ —— 8 页全部捕获。
> - PDF：`~/Downloads/2026q4-pitch/deck.pdf`（投影 / Preview 直接全屏播）
> - PPTX：`~/Downloads/2026q4-pitch/deck.pptx`（上传任何 PPT 平台）
> - 调试单页 PNG 在 `~/Downloads/2026q4-pitch/frames/`

**用户嫌文件大**（PPTX > 10M）→ 加 `--scale 2` 重跑，文件降一半。
**用户说某页内容空**（文字 / 卡片没出来）→ 加 `--wait 4000`，让入场动画跑完再截。

## 关键技术细节（理解脚本行为）

1. **本地路径如何变 URL**：`build.mjs` 检测 HTML 里的 `<base href="/X/">`，从 fileDir 向上走 X 一级当服务根（例 `<base href="/deck/">` → 服务 deck 父级，URL = `/deck/`）。这样图片路径才解析得对。
2. **静态模式**：打开 deck 后按 `B`（guizang 内建快捷键）关动效，WebGL 背景仍保留一帧。
3. **逐页跳转**：`document.querySelectorAll('#nav .dot')[i].click()` —— 用 deck 自身的导航点，**不模拟键盘**（键盘事件容易被 SPA 吃掉）。
4. **截图前等待**：翻页后等 `--wait`（默认 2.5s）让入场动画 stagger 跑完，否则后段文字会缺。
5. **fonts.ready**：打开页面后等 `document.fonts.ready` + `networkidle` + 1.5s 给 WebGL 暖机，字体才渲染对。
6. **deviceScaleFactor**：默认 3（Retina 级），是治糊的关键。1× 在 Retina/投影/PowerPoint 渲染都会显得软。

## 故障排查

| 现象 | 原因 | 改 |
|---|---|---|
| 帧内容缺 / 一片空白 | stagger 没跑完 | `--wait 4000` 或更大 |
| 字体没渲染对 | Google Fonts 没下完 | `--wait 4000` + 确认有网 |
| 某页排版漂 | 视口和 deck 设计基准不一致 | `--width 1920 --height 1080`（guizang 设计基准） |
| 本地 HTML 图片 404 | `<base href>` 路径错 | 给 skill **整个目录**，不要单文件 |
| Chromium 启不来 | 没装 | 重跑 `bash scripts/setup.sh` |
| 帧还是糊 | scale 太小 | `--scale 4`（文件会更大） |
| 文件太大 | scale 过大 | `--scale 2`（出片 3840×2160，体积降一半） |

## 资源文件导览

```
zan-html-to-ppt/
├── SKILL.md           ← 你正在读
├── README.md          ← GitHub 主页给人看的（含核心设计原则 / Roadmap）
├── LICENSE            ← MIT
├── .gitignore
└── scripts/
    ├── package.json   ← 依赖：playwright + pdf-lib + pptxgenjs
    ├── package-lock.json
    ├── setup.sh       ← 一键装依赖（幂等）
    └── build.mjs      ← 主脚本（单文件搞定截图 + PDF + PPTX）
```

## 上游依赖

输入端依赖 [guizang-ppt-skill](https://github.com/op7418/guizang-ppt-skill) 生成的 HTML 结构。具体依赖的 API：

- `<section class="slide">` 是页面容器
- `#nav .dot[i]` 是页码导航点（用于跳转）
- 键盘 `B` 切静态模式
- `document.fonts.ready` Web Fonts API

只要 deck 满足上面这套结构，就能转。完整的设计哲学 + v0.2 / v0.3 计划见 [README.md](./README.md#核心设计原则)。
