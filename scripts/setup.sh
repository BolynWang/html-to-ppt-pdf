#!/usr/bin/env bash
# setup.sh — 一键装依赖,幂等。首次跑 ~1-2 分钟(装 Chromium ~150MB),之后秒过。
set -e

cd "$(dirname "$0")"

# Node deps
if [ ! -d node_modules ]; then
  echo "📦 装 npm 依赖(playwright + pdf-lib + pptxgenjs)…"
  npm install --no-audit --no-fund
else
  echo "✓ npm deps already installed"
fi

# Playwright Chromium
PW_CACHE="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/Library/Caches/ms-playwright}"
if ! ls "$PW_CACHE" 2>/dev/null | grep -q '^chromium'; then
  echo "🌐 装 Chromium(~150MB,慢一点)…"
  npx playwright install chromium
else
  echo "✓ Chromium already installed"
fi

echo ""
echo "✅ ready — node build.mjs <url-or-path> 跑起来"
