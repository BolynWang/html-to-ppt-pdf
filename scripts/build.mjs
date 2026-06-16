#!/usr/bin/env node
// build.mjs — Capture guizang HTML deck slide-by-slide and bundle into PDF + PPTX
//
// Usage:
//   node build.mjs <url-or-path> [--out ./out] [--width 1920] [--height 1080] [--scale 3] [--wait 2500] [--format pdf,pptx]
//
// --scale 控制清晰度:default 3 (5760×3240 物理像素,超清);糊就调到 3,文件嫌大可降到 2。
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
const scale   = +args.scale  || 3;       // deviceScaleFactor:3 = 出片像素 5760×3240(超清)
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

console.log(`📐  Viewport ${W}×${H} · scale=${scale}× (出片 ${W*scale}×${H*scale}) · wait=${waitMs}ms · out=${outDir}`);

// ---------- launch Chromium ----------
const browser = await chromium.launch({
  args: ['--enable-webgl', '--use-gl=swiftshader', '--font-render-hinting=none'],
});
const page = await browser.newPage({
  viewport: { width: W, height: H },
  deviceScaleFactor: scale,
});

await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
try { await page.evaluate(() => document.fonts && document.fonts.ready); } catch {}
await page.waitForTimeout(1500);  // WebGL warmup + fonts

// Static mode (guizang shortcut: B kills motion, WebGL still renders one frame)
await page.keyboard.press('b');
await page.waitForTimeout(400);
const lowPower = await page.evaluate(() => !!window.__lowPowerMode).catch(() => false);
console.log(lowPower
  ? '🔋  low-power on — entrance animations off, fast settle'
  : '⚠️  low-power NOT engaged — falling back to full per-page wait');

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

// Per-slide settle: in low-power mode guizang force-shows all [data-anim] with no
// entrance stagger, so a short beat is enough. Otherwise poll until Web Animations
// stop running, capped by --wait. --wait is the CEILING, not a fixed sleep.
const PRE_BEAT = 150;  // let transitions register after the dot click
const END_BEAT = 120;  // WebGL/paint beat right before the shot
async function settleSlide() {
  await page.waitForTimeout(PRE_BEAT);
  await page.waitForFunction(() => {
    const a = document.getAnimations ? document.getAnimations() : [];
    return a.every(x => x.playState !== 'running');
  }, { timeout: waitMs }).catch(() => {});  // cap reached → screenshot anyway
  await page.waitForTimeout(END_BEAT);
}

// ---------- capture per slide ----------
const pngs = [];
const failed = [];
for (let i = 0; i < count; i++) {
  try {
    await page.evaluate((idx) => {
      const dot = document.querySelectorAll('#nav .dot')[idx];
      if (dot) dot.click();
    }, i);
    await settleSlide();

    const buf = await page.screenshot({ type: 'png' });
    const fp  = path.join(outDir, 'frames', `slide-${String(i + 1).padStart(2, '0')}.png`);
    await fs.writeFile(fp, buf);
    pngs.push(buf);
    process.stdout.write(`  ✓ ${i + 1}/${count}\n`);
  } catch (e) {
    failed.push(i + 1);
    const msg = (e && e.message ? e.message : String(e)).split('\n')[0];
    process.stdout.write(`  ✗ ${i + 1}/${count} — ${msg}\n`);
  }
}

await browser.close();
if (server) server.close();

if (!pngs.length) {
  console.error('❌ All slides failed to capture — nothing to assemble.');
  process.exit(1);
}
if (failed.length) {
  console.warn(`⚠️  ${failed.length}/${count} slide(s) failed: [${failed.join(', ')}] — assembling the ${pngs.length} that succeeded. Retry those with a larger --wait.`);
}

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
  // Derive layout from the real viewport ratio so non-16:9 decks aren't stretched.
  // Height pinned at 7.5in, width = 7.5 × (W/H). 16:9 → 13.333 × 7.5 (unchanged).
  const H_IN = 7.5;
  const W_IN = +((H_IN * W) / H).toFixed(3);
  pptx.defineLayout({ name: 'DECK', width: W_IN, height: H_IN });
  pptx.layout = 'DECK';
  for (const buf of pngs) {
    const slide = pptx.addSlide();
    slide.addImage({
      data: 'image/png;base64,' + buf.toString('base64'),
      x: 0, y: 0, w: W_IN, h: H_IN,
    });
  }
  await pptx.writeFile({ fileName: path.join(outDir, 'deck.pptx') });
  console.log(`📊  deck.pptx`);
}

console.log(`\n✅ Done → ${outDir}/`);
