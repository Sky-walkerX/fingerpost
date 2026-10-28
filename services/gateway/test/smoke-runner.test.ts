import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { runSmoke, type SmokePaths } from '../scripts/smoke-runner.ts';
import { mockModels, MOCK_LAYOUT } from '../src/models/mock/mock-models.ts';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function setup(count = 10): SmokePaths {
  const root = mkdtempSync(join(tmpdir(), 'fingerpost-synthetic-smoke-'));
  roots.push(root);
  const dataset = join(root, 'synthetic-sensitive-directory');
  mkdirSync(dataset);
  for (let index = 0; index < count; index++) {
    // Only synthetic JPEG dimension metadata; no captured image content.
    writeFileSync(join(dataset, `synthetic-sensitive-name-${index}.jpg`),
      new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0, 11, 8, 2, 64, 4, 0, 1, 1, 0x11, 0, 0xff, 0xd9]));
  }
  return { dataset, privateOutput: join(root, 'private'), report: join(root, 'committable', 'day1-smoke.md') };
}

test('public report contains metrics without filenames, recognized text or image data', async () => {
  const paths = setup();
  const models = mockModels({ ...MOCK_LAYOUT, elements: MOCK_LAYOUT.elements.map((element) => ({
    ...element, label: 'synthetic-private-recognized-label', textNorm: 'synthetic-private-recognized-label',
  })) });
  await runSmoke(models, paths);
  const report = readFileSync(paths.report, 'utf8');
  expect(report).toContain('10');
  expect(report).toContain('pending manual review');
  expect(report).toContain('planning rates');
  for (const forbidden of ['synthetic-sensitive', 'synthetic-private', 'data:image', '<svg', Buffer.from(readFileSync(join(paths.dataset, readdirSync(paths.dataset)[0]!))).toString('base64')]) {
    expect(report).not.toContain(forbidden);
  }
  expect(readdirSync(dirname(paths.report))).toEqual(['day1-smoke.md']);
  const overlays = readdirSync(paths.privateOutput);
  expect(overlays).toHaveLength(10);
  expect(overlays.every((name) => /^sample-\d{3}\.svg$/.test(name))).toBe(true);
  const overlay = join(paths.privateOutput, overlays[0]!);
  expect(readFileSync(overlay, 'utf8')).toContain('data:image/jpeg;base64,');
  expect(statSync(overlay).mode & 0o777).toBe(0o600);
});

test('fewer than ten photos is rejected before any model request', async () => {
  const models = mockModels();
  const parse = vi.spyOn(models, 'parseScreen');
  await expect(runSmoke(models, setup(9))).rejects.toThrow('At least 10 JPEG panel photos are required');
  expect(parse).not.toHaveBeenCalled();
});

test('all inputs are checked before spending credits on a partially invalid dataset', async () => {
  const paths = setup();
  writeFileSync(join(paths.dataset, 'z-invalid.jpg'), new Uint8Array([0xff, 0xd8, 0xff, 0xd9]));
  const models = mockModels();
  const parse = vi.spyOn(models, 'parseScreen');
  await expect(runSmoke(models, paths)).rejects.toThrow('Invalid JPEG dimensions');
  expect(parse).not.toHaveBeenCalled();
});

test('missing dataset has a fixed error without leaking its path', async () => {
  const paths = setup(0);
  rmSync(paths.dataset, { recursive: true });
  await expect(runSmoke(mockModels(), paths)).rejects.toThrow('Day 1 JPEG dataset is unavailable');
});

test('missing target masks remain failures to review rather than fabricated quality passes', async () => {
  const paths = setup();
  const models = mockModels();
  models.segmentByBox = async () => ({ polygon: null, confidence: null, latencyMs: 7 });
  await runSmoke(models, paths);
  const report = readFileSync(paths.report, 'utf8');
  expect(report).toContain('Target polygons present: 0/10');
  expect(report).toContain('Correct target polygons: pending manual review');
});
