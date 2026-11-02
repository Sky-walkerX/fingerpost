#!/usr/bin/env node
// Check actual production output over HTTP. This does not emulate Firebase headers.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from '../apps/web/node_modules/vite/dist/node/index.js';

const root = fileURLToPath(new URL('../apps/web/', import.meta.url));
const hosting = JSON.parse(await readFile(new URL('../infra/firebase.json', import.meta.url), 'utf8')).hosting;
assert.equal(resolve(fileURLToPath(new URL('../infra/', import.meta.url)), hosting.public), resolve(root, 'dist'));
assert.equal(hosting.rewrites?.length ?? 0, 0, 'Multipage pages must not be hidden behind a home-page fallback');

// Reserve an ephemeral loopback port; strictPort prevents accidental probing of another service.
const reservation = createServer();
reservation.listen(0, '127.0.0.1');
await once(reservation, 'listening');
const port = reservation.address().port;
await new Promise((done) => reservation.close(done));
const server = await preview({ root, configFile: resolve(root, 'vite.config.ts'),
  preview: { host: '127.0.0.1', port, strictPort: true, open: false } });
const origin = `http://127.0.0.1:${port}`;
const get = (path) => fetch(new URL(path, origin), { signal: AbortSignal.timeout(5_000) });
const pages = ['/', '/privacy/', '/data-safety/', '/install/', '/sim/', '/label/'];
const assets = new Set(['/release-qr.png']);
const titles = new Set();
try {
  for (const page of pages) {
    const response = await get(page);
    assert.equal(response.status, 200, page);
    assert.match(response.headers.get('content-type') ?? '', /text\/html/, page);
    const html = await response.text();
    const title = html.match(/<title>([^<]+)<\/title>/i)?.[1];
    assert.ok(title && !titles.has(title), `Missing or duplicated page title at ${page}`);
    titles.add(title);
    for (const [, reference] of html.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
      const target = new URL(reference, new URL(page, origin));
      if (target.origin === origin) assets.add(target.pathname);
    }
  }
  // Include every emitted asset, including chunks referenced by other chunks.
  for (const name of await readdir(resolve(root, 'dist/assets'))) assets.add(`/assets/${name}`);
  for (const asset of assets) {
    const response = await get(asset);
    assert.equal(response.status, 200, asset);
    const body = new Uint8Array(await response.arrayBuffer());
    assert.ok(body.length > 0, asset);
    if (/\.(?:js|css|png)$/.test(asset)) assert.doesNotMatch(response.headers.get('content-type') ?? '', /text\/html/, asset);
    if (asset.endsWith('.png')) assert.deepEqual([...body.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], asset);
  }
  for (const missing of ['/missing-page/', '/assets/missing.js', '/sim/missing/']) {
    const response = await get(missing);
    assert.equal(response.status, 404, missing);
    await response.arrayBuffer();
  }
  const notFound = await readFile(resolve(root, 'dist/404.html'), 'utf8');
  assert.match(notFound, /<h1>Page not found<\/h1>/);
  console.log(`Built web check passed: ${pages.length} distinct pages, ${assets.size} linked/emitted resources, 3 missing routes, custom 404 artifact.`);
} finally {
  server.httpServer.closeAllConnections();
  await new Promise((done, reject) => server.httpServer.close((error) => error ? reject(error) : done()));
}
