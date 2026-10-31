import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { renderDataset, renderOutput } from '../scripts/render-output.ts';

const roots: string[] = [];
afterEach(() => { for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function root() { const dir = mkdtempSync(join(tmpdir(), 'fingerpost-render-')); roots.push(dir); return dir; }
function labels(dir: string, image = true) {
  if (image) writeFileSync(join(dir, 'synthetic.jpg'), 'synthetic-placeholder');
  writeFileSync(join(dir, 'labels.json'), JSON.stringify({ version: 1, items: [
    { image: 'synthetic.jpg', imageSize: { w: 1280, h: 800 }, screenType: 'pin_pad', elements: [], goals: [] },
  ] }));
}

test('default output stays pinpay, explicit reruns use a new private dataset', () => {
  const dir = root();
  expect(renderOutput([], dir)).toBe(join(dir, 'pinpay'));
  expect(renderOutput(['--out', 'private/synthetic-check'], dir)).toBe(join(dir, 'private/synthetic-check'));
});

test.each([['--out'], ['--unknown', 'x'], ['--out', '../escape'], ['--out', '/tmp/escape'],
  ['--out', 'private/../pinpay'], ['--out', 'private/nested/check'], ['--out', 'pinpay', 'extra']])(
  'invalid output arguments are refused: %j', (...args) => { expect(() => renderOutput(args, root())).toThrow('Use --out private/<new-name>'); });

test('an existing corpus is refused before rendering, without changing any file', async () => {
  const dir = root(), dest = join(dir, 'pinpay');
  mkdirSync(dest); writeFileSync(join(dest, 'existing.txt'), 'preserve');
  let called = false;
  await expect(renderDataset(dest, async () => { called = true; })).rejects.toThrow('Dataset output already exists');
  expect(called).toBe(false);
  expect(readFileSync(join(dest, 'existing.txt'), 'utf8')).toBe('preserve');
  expect(readdirSync(dir)).toEqual(['pinpay']);
});

test('validated images and labels are published together', async () => {
  const dir = root(), dest = join(dir, 'new');
  expect(await renderDataset(dest, async (stage) => { expect(existsSync(dest)).toBe(false); labels(stage); })).toBe(1);
  expect(readdirSync(dest).sort()).toEqual(['labels.json', 'synthetic.jpg']);
  expect(readdirSync(dir)).toEqual(['new']);
});

test('renderer failure removes staging and does not publish a partial dataset', async () => {
  const dir = root(), dest = join(dir, 'new');
  await expect(renderDataset(dest, async (stage) => { labels(stage); throw new Error('synthetic failure'); })).rejects.toThrow('synthetic failure');
  expect(readdirSync(dir)).toEqual([]);
});

test('missing images fail validation and remove staging', async () => {
  const dir = root(), dest = join(dir, 'new');
  await expect(renderDataset(dest, async (stage) => { labels(stage, false); })).rejects.toMatchObject({ code: 'ENOENT' });
  expect(readdirSync(dir)).toEqual([]);
});

test('output created while rendering is preserved', async () => {
  const dir = root(), dest = join(dir, 'new');
  await expect(renderDataset(dest, async (stage) => {
    labels(stage); mkdirSync(dest); writeFileSync(join(dest, 'existing.txt'), 'preserve');
  })).rejects.toThrow('Dataset output already exists');
  expect(readFileSync(join(dest, 'existing.txt'), 'utf8')).toBe('preserve');
  expect(readdirSync(dir)).toEqual(['new']);
});
