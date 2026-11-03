import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, expect, test } from 'vitest';
import { numericPinResults, preparePinImages } from '../src/pin-image-export.ts';
import type { ItemResult } from '../src/metrics.ts';

const roots: string[] = [];
afterEach(() => { for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }); });
function dataset() {
  const root = mkdtempSync(join(tmpdir(), 'fingerpost-pin-image-')); roots.push(root);
  const bytes = Buffer.from('synthetic-test-content'), image = 'synthetic-private-filename.jpg';
  writeFileSync(join(root, image), bytes);
  writeFileSync(join(root, 'labels.json'), JSON.stringify({ version: 1, items: [{ image,
    imageSize: { w: 100, h: 200 }, screenType: 'pin_pad', elements: [], goals: [] }] }));
  return { dir: pathToFileURL(root + '/'), out: join(root, 'prepared'), bytes, image };
}
const result: ItemResult = { image: 'synthetic-private-filename.jpg', latencyMs: 1, inputTokens: 1, outputTokens: 1,
  samCalls: 0, match: { tp: 0, fp: 0, fn: 0, pairs: [] }, screenTypeOk: true, gtSensitive: true, predSensitive: true,
  goals: [{ goal: 'synthetic-private-goal', hit: true }] };

test('numeric export contains anonymous identity, image digest and booleans only', () => {
  const d = dataset(), exported = numericPinResults('live', [result], d.dir);
  expect(exported.items).toEqual([{ id: 'sample-000001', sha256: createHash('sha256').update(d.bytes).digest('hex'),
    expectedSensitive: true, serverDetected: true }]);
  expect(JSON.stringify(exported)).not.toContain('synthetic-private');
});

test('prepared image bundle strips source names and never uses DOM tokens as OCR output', () => {
  const d = dataset(); preparePinImages(d.dir, d.out, 'sim');
  const manifest = JSON.parse(readFileSync(join(d.out, 'manifest.json'), 'utf8'));
  expect(manifest.items[0]).toMatchObject({ id: 'sample-000001', format: 'jpg', origin: 'sim',
    expectedLocalBlock: true, expectedSensitive: true, serverDetected: null });
  expect(readFileSync(join(d.out, 'sample-000001.jpg'))).toEqual(d.bytes);
  expect(JSON.stringify(manifest)).not.toContain('synthetic-private'); expect(manifest.items[0].tokens).toBeUndefined();
  expect(() => preparePinImages(d.dir, d.out, 'sim')).toThrow();
});

test('live results join only on matching anonymous identity, digest and truth', () => {
  const d = dataset(), numeric = numericPinResults('private', [result], d.dir);
  preparePinImages(d.dir, d.out, 'real', numeric);
  expect(JSON.parse(readFileSync(join(d.out, 'manifest.json'), 'utf8')).items[0].serverDetected).toBe(true);
});

test('amount summary is a local negative and server positive; absent server samples remain unknown', () => {
  const d = dataset();
  const labels = JSON.parse(readFileSync(new URL('labels.json', d.dir), 'utf8'));
  labels.items[0].screenType = 'payment_entry';
  writeFileSync(new URL('labels.json', d.dir), JSON.stringify(labels));
  preparePinImages(d.dir, d.out, 'sim', { version: 1, mode: 'live', items: [] });
  const row = JSON.parse(readFileSync(join(d.out, 'manifest.json'), 'utf8')).items[0];
  expect(row).toMatchObject({ expectedLocalBlock: false, expectedSensitive: true, serverDetected: null });
});

test.each(['hash', 'truth', 'duplicate', 'mock'])('invalid server evidence %s is refused before publication', (kind) => {
  const d = dataset(), numeric = numericPinResults('live', [result], d.dir);
  if (kind === 'hash') numeric.items[0]!.sha256 = '0'.repeat(64);
  if (kind === 'truth') numeric.items[0]!.expectedSensitive = false;
  if (kind === 'duplicate') numeric.items.push(numeric.items[0]!);
  if (kind === 'mock') numeric.mode = 'mock';
  expect(() => preparePinImages(d.dir, d.out, 'sim', numeric)).toThrow();
  expect(existsSync(d.out)).toBe(false);
});
