// Renders simulator PIN-pad and pay screens to evals/datasets/pinpay (images + labels.json) for the PIN/payment recall gate.
// pnpm --filter @fingerpost/web build && pnpm --filter @fingerpost/evals render-sim
import { createReadStream, existsSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright';
import { renderDataset, renderOutput } from './render-output.ts';

interface Label { id: string; label: string; role: string; u: number; v: number; w: number; h: number; }
type Sim = { __fp: { labels(): Label[]; screenId(): string } };

async function main() {
  const dist = fileURLToPath(new URL('../../apps/web/dist/', import.meta.url));
  const destination = renderOutput(process.argv.slice(2), fileURLToPath(new URL('../datasets/', import.meta.url)));
  if (!existsSync(join(dist, 'sim/index.html'))) { console.error('Build the web app first: pnpm --filter @fingerpost/web build'); process.exit(2); }
  const count = await renderDataset(destination, async (outDir) => {
    const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
    const server = createServer((req, res) => {
      const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
      let file = join(dist, path);
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
      if (!file.startsWith(dist) || !existsSync(file)) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      createReadStream(file).pipe(res);
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as { port: number }).port;
    let browser: Browser | undefined;
    try {
      browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      const items: unknown[] = [];

      const labels = (p: Page) => p.evaluate(() => (globalThis as unknown as Sim).__fp.labels());
      async function tap(p: Page, id: string) {
        const l = (await labels(p)).find((x) => x.id === id);
        if (!l) throw new Error(`no element ${id}`);
        await p.mouse.click((l.u + l.w / 2) * 1280, (l.v + l.h / 2) * 800);
      }
      async function capture(name: string, screenType: 'pin_pad' | 'payment_entry', goals: Array<{ goal: string; label: string }> = []) {
        await page.screenshot({ path: join(outDir, name), type: 'jpeg', quality: 80 });
        items.push({ image: name, imageSize: { w: 1280, h: 800 }, screenType,
          elements: (await labels(page)).map(({ label, role, u, v, w, h }) => ({ label, role, box: { u, v, w, h } })), goals });
      }
      const open = (query: string) => page.goto(`http://127.0.0.1:${port}/sim/?export=1&run=eval&${query}`);

      for (const layout of ['phone', 'calculator', 'scrambled'] as const) {
        for (let seed = 1; seed <= 40; seed++) {
          await open(`scene=pinpad&layout=${layout}&seed=${seed}`);
          await capture(`pin-${layout}-${seed}.jpg`, 'pin_pad');
        }
      }
      for (let seed = 1; seed <= 30; seed++) {
        await open(`scene=fastfood&seed=${seed}`);
        for (const id of ['start-order', 'drinks', 'medium']) await tap(page, id);
        await capture(`pay-fastfood-${seed}.jpg`, 'payment_entry', [{ goal: 'pay by card', label: 'Pay by card' }]);
      }
      for (let seed = 1; seed <= 20; seed++) {
        await open(`scene=ticket&seed=${seed}`);
        for (const id of ['hindi', 'rajiv-chowk', 'two']) await tap(page, id);
        await capture(`pay-ticket-${seed}.jpg`, 'payment_entry', [{ goal: 'pay by UPI', label: 'Pay by UPI' }]);
      }

      writeFileSync(join(outDir, 'labels.json'), JSON.stringify({ version: 1, items }, null, 1) + '\n');
    } finally {
      try { await browser?.close(); }
      finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
    }
  });
  console.log(JSON.stringify({ synthetic: true, images: count, validated: true }));

}
if (import.meta.main) {
  try { await main(); }
  catch { console.error('Rendering failed. Check the web build, Chromium and a new output folder. Existing datasets are preserved.'); process.exitCode = 1; }
}
