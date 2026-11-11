import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from 'playwright';

import {
  CITY_LAYERS,
  cityLayerSvg,
  frameSvg,
  type SpriteName,
  SPRITES,
  type TimeOfDay,
} from '../src/index';

/**
 * Writes `dist/sheet.html`, every frame of every sprite and both cities, and renders it to
 * `dist/sheet.png` in Chromium, so the art can be looked at without the game. Run it with
 * `pnpm --filter @buzzkill/art sheet`; `dist/` is not committed.
 */
const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');

const NIGHT: readonly SpriteName[] = [
  'moth',
  'firefly',
  'mosquito',
  'julie',
  'explosion-smoke',
  'shot',
  'shot-trail',
];

function row(name: SpriteName): string {
  const sprite = SPRITES[name];
  const ground = NIGHT.includes(name) ? '#121a2b' : '#cfe6fb';
  const scale = Math.min(1, 220 / sprite.width, 220 / sprite.height);
  const frames = Array.from({ length: sprite.frames }, (_, i) =>
    frameSvg(name, i).replace(
      /width="(\d+)" height="(\d+)"/,
      (_match, w: string, h: string) =>
        `width="${String(Number(w) * scale)}" height="${String(Number(h) * scale)}"`,
    ),
  );
  return `<h2>${name} <small>${String(sprite.width)}×${String(sprite.height)}, ${String(sprite.frames)} frames</small></h2><div class="row">${frames
    .map((f) => `<div style="background:${ground}">${f}</div>`)
    .join('')}</div>`;
}

function city(time: TimeOfDay): string {
  const layers = CITY_LAYERS.map((layer) =>
    cityLayerSvg(time, layer).replace(
      '<svg ',
      '<svg style="position:absolute;inset:0;width:100%;height:100%" ',
    ),
  ).join('');
  return `<h2>city, ${time}</h2><div class="city">${layers}</div>`;
}

const html = `<!doctype html><meta charset="utf-8"><title>Buzzkill art</title><style>
body{margin:0;padding:24px;background:#1b1f2a;color:#e9edf2;font:14px system-ui,sans-serif}
h2{font-size:15px;margin:18px 0 6px} small{color:#aab4c3;font-weight:400}
.row{display:flex;flex-wrap:wrap;gap:6px} .row>div{border-radius:6px;padding:4px;line-height:0}
.city{position:relative;width:640px;height:360px;border-radius:8px;overflow:hidden}
</style>${(Object.keys(SPRITES) as SpriteName[]).map(row).join('')}${city('day')}${city('night')}`;

mkdirSync(dist, { recursive: true });
const sheet = resolve(dist, 'sheet.html');
writeFileSync(sheet, html);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(pathToFileURL(sheet).href);
await page.screenshot({ path: resolve(dist, 'sheet.png'), fullPage: true });
await browser.close();
process.stdout.write(`Wrote ${sheet} and sheet.png\n`);
