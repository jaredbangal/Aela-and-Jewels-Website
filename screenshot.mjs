import puppeteer from 'puppeteer';
import { mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const OUT_DIR = join(ROOT, 'temporary screenshots');

const url = process.argv[2];
const label = process.argv[3];
const width = Number(process.env.WIDTH ?? 1440);
const height = Number(process.env.HEIGHT ?? 900);
const fullPage = process.env.FULLPAGE !== '0';

if (!url) {
  console.error('Usage: node screenshot.mjs <url> [label]   (env: WIDTH, HEIGHT, FULLPAGE=0)');
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

const nums = readdirSync(OUT_DIR)
  .map((f) => f.match(/^screenshot-(\d+)/))
  .filter(Boolean)
  .map((m) => Number(m[1]));
const next = nums.length ? Math.max(...nums) + 1 : 1;
const file = join(OUT_DIR, `screenshot-${next}${label ? `-${label}` : ''}.png`);

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.setViewport({ width, height, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

// scroll through the page so IntersectionObserver reveals + lazy images trigger
await page.evaluate(async () => {
  const step = window.innerHeight * 0.6;
  for (let y = 0; y <= document.body.scrollHeight; y += step) {
    window.scrollTo({ top: y, behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 180));
  }
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
  await new Promise((r) => setTimeout(r, 400));
  window.scrollTo({ top: 0, behavior: 'instant' });
});
await page.evaluate(() => new Promise((r) => {
  const done = setTimeout(r, 6000);
  const imgs = [...document.images];
  Promise.all(imgs.map((i) => i.complete ? null : new Promise((res) => { i.onload = i.onerror = res; })))
    .then(() => { clearTimeout(done); r(); });
}));
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({ path: file, fullPage });
await browser.close();
console.log(file);
