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
  expect(readFileSync(overlay, 'utf8')).toContain('stroke="#f59e0b"');
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

test('a failed parse is counted, redacted and does not discard the other nine samples', async () => {
  const paths = setup();
  const models = mockModels();
  const parse = vi.spyOn(models, 'parseScreen');
  parse.mockRejectedValueOnce(new Error('synthetic-private-response-and-key'));
  await expect(runSmoke(models, paths)).rejects.toThrow('Live smoke incomplete: one or more model calls failed');
  expect(parse).toHaveBeenCalledTimes(10);
  const report = readFileSync(paths.report, 'utf8');
  expect(report).toContain('Samples completed without model errors: 9/10');
  expect(report).toContain('Failed model calls: 1');
  expect(report).toContain('Spark failed');
  expect(report).not.toContain('synthetic-private');
  expect(readdirSync(paths.privateOutput)).toHaveLength(9);
});

test('failed segmentation stages are recorded independently and still fail the run', async () => {
  const paths = setup();
  const models = mockModels();
  const box = vi.spyOn(models, 'segmentByBox');
  const text = vi.spyOn(models, 'segmentByText');
  box.mockRejectedValueOnce(new Error('synthetic-private-box-response'));
  text.mockRejectedValueOnce(new Error('synthetic-private-text-response'));
  await expect(runSmoke(models, paths)).rejects.toThrow('Live smoke incomplete');
  expect(box).toHaveBeenCalledTimes(10);
  expect(text).toHaveBeenCalledTimes(10);
  const report = readFileSync(paths.report, 'utf8');
  expect(report).toContain('Failed model calls: 2');
  expect(report).toContain('SAM box failed');
  expect(report).toContain('SAM text failed');
  expect(report).toContain('Target polygons present: 9/10');
  expect(report).not.toContain('synthetic-private');
  expect(readdirSync(paths.privateOutput)).toHaveLength(10);
});

test('completed box overlay and partial numeric report exist before the text call finishes', async () => {
  const paths = setup();
  const models = mockModels();
  const original = models.segmentByText;
  let checked = false;
  models.segmentByText = async (...args) => {
    if (!checked) {
      checked = true;
      expect(readFileSync(join(paths.privateOutput, 'sample-001.svg'), 'utf8')).toContain('stroke="#16a34a"');
      const partial = readFileSync(paths.report, 'utf8');
      expect(partial).toContain('Run status: in progress');
      expect(partial).toContain('Target polygons present: 1/10');
      expect(partial).toContain('pending');
    }
    return original(...args);
  };
  await runSmoke(models, paths);
  expect(checked).toBe(true);
  expect(readFileSync(paths.report, 'utf8')).toContain('Run status: completed');
});

test('all failed parses retain an honest report with no successful latency or zero-cost claim', async () => {
  const paths = setup();
  const models = mockModels();
  vi.spyOn(models, 'parseScreen').mockRejectedValue(new Error('synthetic-private-response'));
  const box = vi.spyOn(models, 'segmentByBox');
  await expect(runSmoke(models, paths)).rejects.toThrow('Live smoke incomplete');
  expect(box).not.toHaveBeenCalled();
  const report = readFileSync(paths.report, 'utf8');
  expect(report).toContain('Samples completed without model errors: 0/10');
  expect(report).toContain('Failed model calls: 10');
  expect(report).toContain('not measured');
  expect(report).toContain('Failed or unfinished calls may also be billed');
});

test('the active parse is visible in the checkpoint while its result is still pending', async () => {
  const paths = setup();
  const models = mockModels();
  const original = models.parseScreen;
  vi.spyOn(models, 'parseScreen').mockImplementationOnce(async (...args) => {
    const partial = readFileSync(paths.report, 'utf8');
    expect(partial).toContain('Samples attempted: 1/10');
    expect(partial).toContain('Spark pending');
    return original(...args);
  });
  await runSmoke(models, paths);
});
