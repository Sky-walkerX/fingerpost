import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { encodeFrame, ServerMessage, type Layout, type LayoutElement } from '@fingerpost/protocol';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { mockModels } from '../src/models/mock/mock-models.ts';
import { hamming, lshBands, simhash64 } from '../src/memory/simhash.ts';
import { InMemoryStore } from '../src/memory/store.ts';
import { MemoryService, type OcrToken } from '../src/memory/service.ts';
import { layoutFingerprint } from '../src/session/pipeline.ts';

const poly = (u: number, v: number, w = 0.25, h = 0.1): LayoutElement['polygon'] =>
  [{ u, v }, { u: u + w, v }, { u: u + w, v: v + h }, { u, v: v + h }];
const el = (id: string, label: string, role: LayoutElement['role'], u: number, v: number): LayoutElement =>
  ({ id, label, role, polygon: poly(u, v), confidence: 0.9, textNorm: label.toLowerCase() });
const layout = (elements: LayoutElement[], extra: Partial<Layout> = {}): Layout => ({ id: 'l', ts: 0, type: 'layout',
  fingerprint: layoutFingerprint(elements), screenType: 'menu', rotation: 0, language: 'en', sensitivity: 'none', elements, source: 'model', ...extra });
/** OCR tokens that read an element's label inside its box. */
const tokensFor = (els: LayoutElement[]): OcrToken[] => els.map((e) => ({ text: e.label, box: { u: e.polygon[0]!.u, v: e.polygon[0]!.v, w: 0.25, h: 0.1 } }));

const sizes = [el('small', 'Small ₹99', 'button', 0.05, 0.3), el('medium', 'Medium ₹149', 'button', 0.37, 0.3),
  el('large', 'Large ₹179', 'button', 0.69, 0.3), el('back', 'Back', 'back', 0.05, 0.75), el('title', 'Choose a size', 'text', 0.3, 0.05)];
const ASPECT = 1.6;

async function trusted(service: MemoryService, l: Layout, tokens: OcrToken[]) {
  await service.record(l, tokens, ASPECT, 'install-a');
  await service.record(l, tokens, ASPECT, 'install-b');
}

describe('simhash', () => {
  test('stable 64-bit hash, hamming distance and four 16-bit LSH bands', () => {
    const a = simhash64(['start', 'order', 'welcome']);
    expect(a).toBe(simhash64(['welcome', 'start', 'order']));
    expect(hamming(a, a)).toBe(0);
    expect(hamming(0n, 0b1011n)).toBe(3);
    const bands = lshBands(a);
    expect(bands).toHaveLength(4);
    expect(new Set(bands.map((b) => b.split(':')[0]))).toEqual(new Set(['0', '1', '2', '3']));
  });
});

describe('kiosk memory (B5-2)', () => {
  test('same screen different price hits', async () => {
    const service = new MemoryService(new InMemoryStore(), { salt: 's' });
    await trusted(service, layout(sizes), tokensFor(sizes));
    const repriced = sizes.map((e) => e.id === 'medium' ? { ...e, label: 'Medium ₹159' } : e);
    const hit = await service.lookup(tokensFor(repriced), ASPECT);
    expect(hit?.source).toBe('memory');
    // Static text two installs agreed on is kept; prices are not.
    expect(hit?.elements.map((e) => e.label)).toEqual(['Small', 'Medium', 'Large', 'Back', 'Choose a size']);
  });

  test('near-duplicate fingerprint still requires OCR agreement', async () => {
    const service = new MemoryService(new InMemoryStore(), { salt: 's' });
    await trusted(service, layout(sizes), tokensFor(sizes));
    // One label changed in place: the SimHash may stay within reach, but fresh OCR no longer agrees with the stored button.
    const swapped = sizes.map((e) => e.id === 'large' ? { ...e, label: 'Extra large ₹199' } : e);
    expect(hamming(simhash64(['small', 'medium', 'large', 'back', 'choose', 'a', 'size']), simhash64(['small', 'medium', 'extra', 'large', 'back', 'choose', 'a', 'size']))).toBeLessThan(20);
    expect(await service.lookup(tokensFor(swapped), ASPECT)).toBeNull();
    // Same words, two buttons swapped: the SimHash is identical, so only the fresh-OCR check can tell.
    const small = sizes[0]!, large = sizes[2]!;
    const moved = sizes.map((e) => e.id === 'small' ? { ...e, polygon: large.polygon } : e.id === 'large' ? { ...e, polygon: small.polygon } : e);
    expect(simhash64(tokensFor(moved).flatMap((t) => t.text.toLowerCase().split(' ')))).toBe(simhash64(tokensFor(sizes).flatMap((t) => t.text.toLowerCase().split(' '))));
    expect(await service.lookup(tokensFor(moved), ASPECT)).toBeNull();
    expect(await service.lookup(tokensFor(sizes), ASPECT)).not.toBeNull();
    // A different aspect bucket is a different screen.
    expect(await service.lookup(tokensFor(sizes), 0.75)).toBeNull();
  });

  test('trusted only after 2 distinct attested installs', async () => {
    const service = new MemoryService(new InMemoryStore(), { salt: 's' });
    const tokens = tokensFor(sizes);
    await service.record(layout(sizes), tokens, ASPECT, 'install-a');
    await service.record(layout(sizes), tokens, ASPECT, 'install-a');
    expect(await service.lookup(tokens, ASPECT)).toBeNull();
    await service.record(layout(sizes), tokens, ASPECT, 'install-b');
    expect(await service.lookup(tokens, ASPECT)).not.toBeNull();
  });

  test('stores at most 5 salted key hashes', async () => {
    const store = new InMemoryStore();
    const service = new MemoryService(store, { salt: 'pepper' });
    for (const k of ['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7']) await service.record(layout(sizes), tokensFor(sizes), ASPECT, k);
    const [entry] = store.all();
    expect(entry!.installs).toHaveLength(5);
    expect(entry!.installs.every((h) => /^[0-9a-f]{64}$/.test(h))).toBe(true);
    expect(JSON.stringify(entry)).not.toMatch(/k[1-7]/);
  });

  test('strips prices, names and numbers before storing', async () => {
    const store = new InMemoryStore();
    const service = new MemoryService(store, { salt: 's' });
    const els = [...sizes, el('hi', 'Hello Rahul', 'text', 0.3, 0.9), el('total', 'Total ₹149', 'text', 0.6, 0.9), el('table', 'Table 12', 'button', 0.69, 0.75)];
    await service.record(layout(els), tokensFor(els), ASPECT, 'k1');
    const [entry] = store.all();
    // Words are checked, not hex hashes: a hash can contain any digit pair by chance.
    const words = JSON.stringify(entry!.elements);
    for (const secret of ['Rahul', 'Hello', '149', '99', '179', '12', '₹', 'Choose a size', 'Total']) expect(words).not.toContain(secret);
    expect(entry!.elements.map((e) => e.label)).toEqual(['Small', 'Medium', 'Large', 'Back', 'Table']);
    // One install's static text is kept only as salted hashes, never as words.
    expect(entry!.textVotes.every((v) => /^[0-9a-f]{64}$/.test(v.hash) && Object.keys(v).sort().join() === 'hash,installs')).toBe(true);
    expect(JSON.stringify(entry!.textVotes)).not.toMatch(/Rahul|Choose|size/);
  });

  test('never remembers payment, PIN, confirm or sensitive screens', async () => {
    const store = new InMemoryStore();
    const service = new MemoryService(store, { salt: 's' });
    const pay = [el('total', 'Total ₹149', 'text', 0.3, 0.1), el('pay', 'Pay by card', 'pay', 0.6, 0.6)];
    await service.record(layout(pay, { screenType: 'payment_entry' }), tokensFor(pay), ASPECT, 'k1');
    await service.record(layout(sizes, { sensitivity: 'financial' }), tokensFor(sizes), ASPECT, 'k1');
    await service.record(layout(sizes, { screenType: 'pin_pad' }), tokensFor(sizes), ASPECT, 'k1');
    expect(store.all()).toHaveLength(0);
  });
});

// ── over a real socket ─────────────────────────────────────────────────────────────────────────────────
let app: FastifyInstance | undefined;
afterEach(async () => { await app?.close(); app = undefined; });

test('memory hit path sends layout{source:memory} without calling parseScreen, in under 50 ms', async () => {
  const flow = JSON.parse(readFileSync(new URL('../../../packages/protocol/fixtures/flows/memory-hit.json', import.meta.url), 'utf8'));
  const home = flow.steps.find((s: { msg: { type: string } }) => s.msg.type === 'layout').msg as Layout;
  const keyframe = flow.steps.find((s: { msg: { type: string } }) => s.msg.type === 'keyframe').msg;
  const memory = new MemoryService(new InMemoryStore(), { salt: 's' });
  const aspect = keyframe.imageSize.w / keyframe.imageSize.h;
  await memory.record({ ...home, source: 'model' }, keyframe.ocrTokens, aspect, 'install-a');
  await memory.record({ ...home, source: 'model' }, keyframe.ocrTokens, aspect, 'install-b');
  const models = mockModels();
  const parse = vi.fn(models.parseScreen);
  const box = vi.fn(models.segmentByBox);
  app = await buildApp(loadConfig({ LOG_LEVEL: 'silent' }), { models: { ...models, parseScreen: parse, segmentByBox: box }, memory });
  await app.ready();
  const ws = await app.injectWS('/v1/session'), messages: ServerMessage[] = [];
  ws.on('message', (d: Buffer) => messages.push(ServerMessage.parse(JSON.parse(d.toString()))));
  ws.send(JSON.stringify({ type: 'hello', id: 'h1', ts: 1, appVersion: '0.1.0', protocol: 'fp.v1', locale: 'en', mode: 'guide', privacy: 'normal', caps: {} }));
  await vi.waitFor(() => expect(messages.some((m) => m.type === 'ready')).toBe(true));
  ws.send(JSON.stringify({ type: 'goal', id: 'g1', ts: 2, source: 'typed', text: 'Press start order' }));
  await vi.waitFor(() => expect(messages.some((m) => m.type === 'goal.ack')).toBe(true));
  // Timed by the message event itself: vi.waitFor polls every 50 ms and would hide the real latency.
  const arrived = new Promise<number>((resolve) => ws.on('message', (d: Buffer) => {
    if (JSON.parse(d.toString()).type === 'target') resolve(performance.now());
  }));
  const started = performance.now();
  ws.send(encodeFrame({ ...keyframe, ts: 3 }, new Uint8Array([0xff, 0xd8])));
  const elapsed = (await arrived) - started;
  expect(messages.find((m) => m.type === 'layout')).toMatchObject({ source: 'memory', fingerprint: home.fingerprint });
  expect(messages.find((m) => m.type === 'target')).toMatchObject({ elementId: 'start-order' });
  expect(parse).not.toHaveBeenCalled();
  expect(box).not.toHaveBeenCalled();
  expect(elapsed).toBeLessThan(50);
  ws.terminate();
});
