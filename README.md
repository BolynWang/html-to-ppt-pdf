# zan-html-to-ppt

把 guizang-ppt-skill 生成的横向翻页 HTML deck 转成 **PDF + PPTX**(图片型),供线下演讲用。

## 装(一次性)

```bash
cd scripts
npm install
npx playwright install chromium    # 装独立的 Chromium(~150MB)
```

## 跑

```bash
node scripts/build.mjs <url-or-path> [选项]
```

例:

```bash
# URL(已经有本地 http server 在跑)
node scripts/build.mjs http://localhost:8810/deck/

# 本地路径(skill 自动起 server,处理 <base href>)
node scripts/build.mjs /Users/user/.openclaw/nebula/web/deck/index.html \
  --out ~/Downloads/lumora-deck

# 自定义比例和等待时间
node scripts/build.mjs ./web/deck/ --width 2560 --height 1440 --wait 4000
```

## 选项

| 参数 | 默认 | 说明 |
|---|---|---|
| `<input>` | 必填 | URL / 本地 HTML 文件 / 本地目录 |
| `--out <dir>` | `./out` | 输出目录 |
| `--width <px>` | `1920` | 截图宽 |
| `--height <px>` | `1080` | 截图高 |
| `--wait <ms>` | `2500` | 每页翻到后等动画跑完的毫秒数 |
| `--format pdf,pptx` | 两个都出 | 输出格式 |

## 产物

```
<out>/
├── deck.pdf            ← 多页 PDF,每页 16:9 满版
├── deck.pptx           ← 每页一张 PNG 满版背景(不可编辑)
└── frames/
    ├── slide-01.png
    └── ...
```

## 已知 trade-off

- WebGL 背景动效冻成静帧(截图是某一瞬间)
- PPTX 是"图片型" —— 文字和图都不可编辑
- 需要"文字可编辑 + 图可编辑"的混合版,见 SKILL.md 末尾 v2 计划

## 完整说明 → `SKILL.md`
