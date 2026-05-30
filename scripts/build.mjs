#!/usr/bin/env node
// build.mjs — Capture guizang HTML deck slide-by-slide and bundle into PDF + PPTX
//
// Usage:
//   node build.mjs <url-or-path> [--out ./out] [--width 1920] [--height 1080] [--wait 2500] [--format pdf,pptx]
//
// Examples:
//   node build.mjs http://localhost:8810/deck/
//   node build.mjs /path/to/deck/index.html --out ~/Downloads/my-deck

import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import PptxGenJS from 'pptxgenjs';
import { createServer } from 'node:http';
import path from 'node:path';
import { promises as fs, existsSync } from 'node:fs';

// ---------- arg parsing ----------
function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x.startsWith('--')) {
      const k = x.slice(2);
      const next = argv[i + 1];
      const v = (next === undefined || next.startsWith('--')) ? true : argv[++i];
      a[k] = v;
    } else {
      a._.push(x);
    }
  }
  return a;
}

const args = parseArgs(process.argv.slice(2));
const input = args._[0];
if (!input) {
  console.error('Usage: node build.mjs <url-or-path> [--out ./out] [--width 1920] [--height 1080] [--wait 2500] [--format pdf,pptx]');
  process.exit(1);
}

const outDir  = path.resolve(args.out || './out');
const W       = +args.width  || 1920;
const H       = +args.height || 1080;
const waitMs  = +args.wait   || 2500;
const formats = String(args.format || 'pdf,pptx').split(',').map(s => s.trim());

// ---------- static server (only if local path) ----------
const MIME = {
  '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.mjs':'text/javascript',
  '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.gif':'image/gif', '.svg':'image/svg+xml', '.webp':'image/webp', '.avif':'image/avif',
  '.woff':'font/woff', '.woff2':'font/woff2', '.ttf':'font/ttf', '.otf':'font/otf',
  '.ico':'image/x-icon', '.txt':'text/plain'
};

let server = null;
let url = input;

if (!/^https?:\/\//.test(url)) {
  const abs = path.resolve(input);
  if (!existsSync(abs)) {
    console.error(`Not found: ${abs}`);
    process.exit(1);
  }
  const stat = await fs.stat(abs);
  const fileDir  = stat.isDirectory() ? abs : path.dirname(abs);
  const fileName = stat.isDirectory() ? 'index.html' : path.basename(abs);

  // Detect <base href> to choose serving root
  let baseHref = '/';
  try {
    const html = await fs.readFile(path.join(fileDir, fileName), 'utf-8');
    const m = html.match(/<base\s+href=["']([^"']+)["']/i);
    if (m && m[1].startsWith('/')) baseHref = m[1].endsWith('/') ? m[1] : (m[1] + '/');
  } catch {}

  // For base="/X/", serve from `dirname(fileDir, X)` so that URL /X/ resolves to fileDir
  let serveRoot = fileDir;
  if (baseHref !== '/') {
    const segs = baseHref.split('/').filter(Boolean);
    for (let i = 0; i < segs.length; i++) serveRoot = path.dirname(serveRoot);
  }
  serveRoot = path.resolve(serveRoot);

  server = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const full = path.resolve(path.join(serveRoot, p));
      if (!full.startsWith(serveRoot)) { res.statusCode = 403; return res.end('Forbidden'); }
      const data = await fs.readFile(full);
      res.setHeader('Content-Type', MIME[path.extname(full).toLowerCase()] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store');
      res.end(data);
    } catch {
      res.statusCode = 404;
      res.end('Not found: ' + req.url);
    }
  });

  const port = await new Promise(r => server.listen(0, () => r(server.address().port)));
  url = (baseHref === '/')
    ? `http://localhost:${port}/${fileName === 'index.html' ? '' : fileName}`
    : `http://localhost:${port}${baseHref}${fileName === 'index.html' ? '' : fileName}`;

  console.log(`🌐  http server :${port}  root=${serveRoot}`);
  console.log(`📍  Open: ${url}`);
}

await fs.mkdir(outDir, { recursive: true });
await fs.mkdir(path.join(outDir, 'frames'), { recursive: true });

console.log(`📐  Viewport ${W}×${H}  · wait=${waitMs}ms · out=${outDir}`);

// ---------- launch Chromium ----------
const browser = await chromium.launch({
  args: ['--enable-webgl', '--use-gl=swiftshader', '--font-render-hinting=none'],
});
const page = await browser.newPage({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
});

await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
try { await page.evaluate(() => document.fonts && document.fonts.ready); } catch {}
await page.waitForTimeout(1500);  // WebGL warmup + fonts

// Static mode (guizang shortcut: B kills motion, WebGL still renders one frame)
await page.keyboard.press('b');
await page.waitForTimeout(400);

// Count slides
const count = await page.evaluate(() =>
  document.querySelectorAll('section.slide').length
);
if (!count) {
  console.error('❌ No <section class="slide"> found — is this a guizang deck?');
  await browser.close();
  if (server) server.close();
  process.exit(1);
}
console.log(`🎞  ${count} slides`);

// ---------- capture per slide ----------
const pngs = [];
for (let i = 0; i < count; i++) {
  await page.evaluate((idx) => {
    const dot = document.querySelectorAll('#nav .dot')[idx];
    if (dot) dot.click();
  }, i);
  await page.waitForTimeout(waitMs);

  const buf = await page.screenshot({ type: 'png' });
  const fp  = path.join(outDir, 'frames', `slide-${String(i + 1).padStart(2, '0')}.png`);
  await fs.writeFile(fp, buf);
  pngs.push(buf);
  process.stdout.write(`  ✓ ${i + 1}/${count}\n`);
}

await browser.close();
if (server) server.close();

// ---------- assemble PDF ----------
if (formats.includes('pdf')) {
  const pdf = await PDFDocument.create();
  for (const buf of pngs) {
    const img  = await pdf.embedPng(buf);
    const pg   = pdf.addPage([W, H]);
    pg.drawImage(img, { x: 0, y: 0, width: W, height: H });
  }
  const bytes = await pdf.save();
  await fs.writeFile(path.join(outDir, 'deck.pdf'), bytes);
  console.log(`📄  deck.pdf`);
}

// ---------- assemble PPTX ----------
if (formats.includes('pptx')) {
  const pptx = new PptxGenJS();
  // 16:9 widescreen layout; 13.333 × 7.5 inches = 1920 × 1080 px at 144 DPI
  pptx.defineLayout({ name: 'WIDE_HD', width: 13.333, height: 7.5 });
  pptx.layout = 'WIDE_HD';
  for (const buf of pngs) {
    const slide = pptx.addSlide();
    slide.addImage({
      data: 'image/png;base64,' + buf.toString('base64'),
      x: 0, y: 0, w: 13.333, h: 7.5,
    });
  }
  await pptx.writeFile({ fileName: path.join(outDir, 'deck.pptx') });
  console.log(`📊  deck.pptx`);
}

console.log(`\n✅ Done → ${outDir}/`);
