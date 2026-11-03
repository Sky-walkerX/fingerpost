/** Synthetic B-roll only. Start the built web app on loopback port 4173 first. */
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';

const output = fileURLToPath(new URL('../../video/out/sim-demo/', import.meta.url));
await mkdir(dirname(output), { recursive: true });
await mkdir(output); // Refuse to overwrite an existing take.
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: output, size: { width: 1280, height: 800 } } });
  await context.route('**/*', (route) => new URL(route.request().url()).origin === 'http://127.0.0.1:4173' ? route.continue() : route.abort());
  const page = await context.newPage();
  await page.addInitScript("Element.prototype.requestFullscreen = async function () {};");
  await page.goto('http://127.0.0.1:4173/sim/?scene=fastfood&seed=1&export=1&run=synthetic-video');
  await page.waitForFunction(() => '__fp' in globalThis);
  await page.evaluate(`(() => {
    const caption = document.createElement('div');
    caption.textContent = 'SIMULATOR ONLY · Synthetic B-roll · No phone or cloud session';
    caption.style.cssText = 'position:fixed;left:0;right:0;bottom:0;padding:12px;color:white;background:#000;font:20px system-ui;text-align:center;z-index:100;pointer-events:none';
    document.body.append(caption);
  })()`);
  const expected = ['home', 'menu', 'drink-size', 'pay', 'pin', 'done'];
  const buttons = ['start-order', 'drinks', 'medium', 'pay-card', 'key-ok'];
  for (let i = 0; i < expected.length; i++) {
    await page.waitForFunction((id) => (globalThis as unknown as { __fp: { screenId(): string } }).__fp.screenId() === id, expected[i]);
    await page.waitForTimeout(1800);
    if (i < buttons.length) {
      const box = await page.evaluate((id) => (globalThis as unknown as { __fp: { labels(): Array<{ id: string; u: number; v: number; w: number; h: number }> } }).__fp.labels().find((label) => label.id === id), buttons[i]);
      if (!box) throw new Error('Expected synthetic control missing');
      await page.mouse.click((box.u + box.w / 2) * 1280, (box.v + box.h / 2) * 800);
    }
  }
  const video = page.video()!;
  await context.close();
  await rename(await video.path(), join(output, 'simulator-fastfood.webm'));
  await writeFile(join(output, 'take.json'), JSON.stringify({ type: 'synthetic-simulator-only', scene: 'fastfood', seed: 1, screens: expected, width: 1280, height: 800, audio: false, phoneAcceptance: false, cloudAcceptance: false }, null, 2) + '\n');
  console.log('Synthetic simulator take captured; no device/cloud acceptance implied.');
} finally { await browser.close(); }
