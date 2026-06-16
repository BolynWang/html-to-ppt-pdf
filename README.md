# zan-html-to-ppt · HTML deck → PDF + PPTX

![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)
![Claude Code](https://img.shields.io/badge/Claude%20Code-Skill-6B5B95?style=flat-square)
![Node](https://img.shields.io/badge/Node-%3E%3D18-339933?style=flat-square)
![Built on](https://img.shields.io/badge/Built%20on-Playwright-2EAD33?style=flat-square)

把 [guizang-ppt-skill](https://github.com/op7418/guizang-ppt-skill) 出来的**横向翻页 HTML deck** 转成 **`deck.pdf` + `deck.pptx`**，供线下演讲使用。

> Playwright 控 Chromium 1920×1080 逐页截图，WebGL 背景**静帧保留**；视觉 100% 还原。
> PPTX 是图片型（内文不可编辑，可直接投影演示）。

---

## 它解决什么问题

guizang-ppt-skill 出来的是漂亮的 HTML —— 网页投影没问题，但很多线下场子（评审、加速器、企业内训、学校课程）**只接收 .pptx 上传**。这个 skill 就是中间这一道桥。

| 你有 | 它给你 |
|---|---|
| guizang 生成的 HTML deck | `deck.pdf`（多页 16:9 满版） |
| 横向翻页、WebGL 背景、入场动画 | `deck.pptx`（每页满版 PNG，图片型） |
| 临时一晚 build 出来的演讲材料 | `frames/slide-NN.png`（1920×1080，可单独用） |

---

## 30 秒开始

```bash
# 装（只跑一次）
git clone git@github.com:BolynWang/html-to-ppt-pdf.git ~/.claude/skills/zan-html-to-ppt
cd ~/.claude/skills/zan-html-to-ppt/scripts
npm install
npx playwright install chromium

# 跑（URL 或本地路径都行）
node build.mjs http://localhost:8810/deck/
node build.mjs /path/to/deck/index.html --out ~/Downloads/my-deck
```

产物：`<out>/deck.pdf` + `<out>/deck.pptx` + `<out>/frames/slide-NN.png`。

---

## 触发方式（Claude Code 里）

如果已把仓库 clone 到 `~/.claude/skills/zan-html-to-ppt/`，Claude Code 会自动识别这个 skill。直接对 Claude 说：

> "把这个 deck 转成 PPT —— `/path/to/deck/index.html`"
> "把 `http://localhost:8810/deck/` 这个 deck 导出 .pptx"
> "我要把 guizang 出的 HTML 做成线下演讲的 PowerPoint"

Claude 会读 `SKILL.md`，按工作流走。

---

## 给 Agent 的操作指令（If you're an AI agent）

> 用户把这个仓库链接甩给你了 —— 这一段告诉你怎么"接活"。
> **真正的工作流在 [`SKILL.md`](./SKILL.md)** —— 这里只把你"接到 SKILL.md 之前要做的事"说清楚，不复述工作流（复述就两边不同步）。

如果你是 Claude / Codex / Gemini 等 AI Agent，**用户分享这个 GitHub 链接给你 = 让你用这个 skill 把他的 HTML deck 转成 PDF / PPTX**。

你只需要做三件事：

**1. 把仓库 clone 到 skill 目录**（如果还没装）

```bash
git clone git@github.com:BolynWang/html-to-ppt-pdf.git ~/.claude/skills/zan-html-to-ppt
```

**2. 首次装依赖**（装过就跳过）

```bash
cd ~/.claude/skills/zan-html-to-ppt/scripts
npm install
npx playwright install chromium    # ~150MB，告诉用户在装，别静默等
```

**3. 打开 [`SKILL.md`](./SKILL.md) 看工作流**

那才是你的操作手册：Step 1–4 + 关键技术细节 + 故障排查表 + 参数说明。装完之后所有动作都按 SKILL.md 走。

---

## 用法

```bash
node build.mjs <url-or-path> [选项]
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `<input>` | 必填 | URL / 本地 HTML 文件 / 本地目录 |
| `--out <dir>` | `./out` | 输出目录 |
| `--width <px>` | `1920` | CSS 视口宽（影响布局基准） |
| `--height <px>` | `1080` | CSS 视口高 |
| `--scale <n>` | `3` | **deviceScaleFactor**，控制清晰度。`3` 出片 5760×3240（超清，文件大）；糊就保持 3，文件嫌大降到 2 |
| `--wait <ms>` | `2500` | 每页 settle 的**上限**（不是固定睡这么久）。low-power 下动画被关，通常 ~300ms 截完；某页缺内容才调大 |
| `--format pdf,pptx` | 都出 | 输出格式（逗号分隔） |

例：

```bash
# 已有本地 http server
node build.mjs http://localhost:8810/deck/

# 本地路径（自动起 server，处理 <base href>）
node build.mjs ~/myproject/web/deck/index.html --out ~/Downloads/my-deck

# 2K 出片 + 动画长一点
node build.mjs ./deck/ --width 2560 --height 1440 --wait 4000

# 只要 PDF，不要 PPTX
node build.mjs ./deck/ --format pdf
```

---

## 工作原理

1. **本地路径? → 起临时 http server**（按 HTML 里 `<base href="/X/">` 决定服务根，保证图片路径解析正确）
2. **Playwright Chromium 1920×1080 打开**，等 `document.fonts.ready` + `networkidle` + 1.5s 让 WebGL 暖机
3. **按 `B` 进静态模式**（guizang 内建快捷键 —— 关动效，保留 WebGL 背景静帧）
4. **逐页**：`document.querySelectorAll('#nav .dot')[i].click()` 跳页 → 轮询 `getAnimations()` 到动画停（low-power 下几乎立刻，封顶 `--wait`）→ 截图。某页失败只记下页码继续，不拖垮整轮
5. **拼装**：`pdf-lib` 拼 PDF；`pptxgenjs` 拼 PPTX（每页 `slide.addImage` 满版背景，版面长宽比按 `--width/--height` 推导，非 16:9 也不变形）

---

## 适合 / 不适合

**适合：**
- guizang-ppt-skill 出的 HTML deck 需要交 .pptx
- 投影 / 带去现场播
- 评委 / 加速器 / 企业内训等需要 PowerPoint 文件的场子

**不适合：**
- 需要在 PowerPoint 里**改字、换数据**（用 v0.2 编辑模式，见 Roadmap）
- 需要从 PPTX 反向拿到原 HTML（skill 不提供）
- 不是 guizang 风格的 HTML（依赖它的 `<section class="slide">` + `#nav .dot` 结构）

---

## 已知 trade-off

- **WebGL 背景动效 → 冻成静帧**（截图是某一瞬间）
- **PPTX 文字 / 图都不可编辑**（每页是 PNG 满版背景）
- **PDF 是栅格不是矢量字**，放大会糊 —— 用 `--width 2560 --height 1440` 出 2K 缓解

---

## 故障排查

| 现象 | 改 |
|---|---|
| 内容空 / 文字缺 | `--wait 4000`（动画 stagger 没跑完） |
| 字体没正确渲染 | `--wait 4000` + 确认网络（Google Fonts 没下完） |
| 某页排版漂 | `--width 1920 --height 1080`（guizang 设计基准） |
| 本地图片 404 | 把 deck **整个目录**给 skill，不要单文件 |
| Chromium 启不来 | `npx playwright install chromium` |

完整故障排查见 [SKILL.md](./SKILL.md#故障排查)。

---

## 核心设计原则

1. **不重发明轮子，用 deck 自身的 API** —— `B` 键切静态、`#nav .dot[i].click()` 跳页，都是 guizang 内建的，直接用。不模拟键盘（键盘事件容易被 SPA 吃掉），不靠私有 hook。
2. **本地路径优先，自动起 server** —— 用户不用自己 host http server，skill 检测 `<base href>` 自己起，把 `<base href="/deck/">` 这类路径正确解析。
3. **视觉还原优先于"可编辑性"** —— v0.1 是图片型，接受 trade-off 换 100% 视觉还原；可编辑混合版做 v0.2。
4. **单文件主脚本** —— `build.mjs` 一个文件搞定截图 + PDF + PPTX，~200 行，不拆 helper。改起来直观。

---

## Roadmap

### v0.1 · 图片型 PPTX（当前）
视觉 100% 还原（含 WebGL 静帧），文字不可编辑。

### v0.2 · 混合型 PPTX（规划中）
**背景截图 + 顶层可编辑文本框 + `<img>` 独立嵌入。** 文字可改、图可换。

实现思路：
1. 临时把所有文字 CSS `color: transparent` 后截图当背景（layout 保留，文字不在像素里）
2. 从 DOM 量每段文字：`getBoundingClientRect()` 取位置，`getComputedStyle()` 取字号 / 颜色 / 字重 / 字体
3. PPTX 每页：背景 = 无字截图，顶层 = `slide.addText(...)` 可编辑文本框，位置 + 样式按 DOM 量
4. `<img>` 元素 → 独立的 `slide.addImage(...)`，在 PPTX 里可拖动可换图

接受的 trade-off：
- WebGL 背景渐变 / 光斑 → 跟着背景图走（不可编辑）
- 字体可能换（Google Fonts 在对方电脑可能没装）
- 长段中文换行可能漂 ~1 字（WebKit 和 PowerPoint 断行算法不同）

触发方式（v0.2 加）：`node build.mjs <input> --mode editable`

### v0.3 · 矢量 PDF 模式（设想中）
直接 `page.pdf()` 走打印通道，文字保持矢量（牺牲 WebGL 背景换可缩放无损）。

---

## 致谢

- [guizang-ppt-skill](https://github.com/op7418/guizang-ppt-skill) by 歸藏 —— 这个 skill 的**输入端**。没有 guizang 的设计语言，这一切都不存在。
- [Playwright](https://playwright.dev/) · [pdf-lib](https://pdf-lib.js.org/) · [pptxgenjs](https://gitbrent.github.io/PptxGenJS/) —— 三个干活的家伙。

---

## License

[MIT](./LICENSE) © 2026 王赞（[@BolynWang](https://github.com/BolynWang)）
