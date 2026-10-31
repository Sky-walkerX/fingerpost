import { expect, test, vi } from 'vitest';
import { ServerMessage, type Keyframe, type Polygon } from '@fingerpost/protocol';
import { SessionPipeline } from '../src/session/pipeline.ts';
import { fullFrameCoordinates } from '../src/session/screen-coordinates.ts';
import { mockModels, MOCK_LAYOUT } from '../src/models/mock/mock-models.ts';

const box = (l: number, t: number, r: number, b: number): Polygon => [{ u: l, v: t }, { u: r, v: t }, { u: r, v: b }, { u: l, v: b }];
const screen = box(0.2, 0.1, 0.8, 0.9), target = box(0.56, 0.66, 0.74, 0.82);
const header: Keyframe = { type: 'keyframe', id: 'full', ts: 0, kind: 'full', purpose: 'locate', imageSize: { w: 1000, h: 500 }, ocrTokens: [] };
const jpeg = new Uint8Array([0xff, 0xd8]);
function setup(mask: Polygon | null = screen) {
  const models = mockModels({ ...MOCK_LAYOUT, elements: [{ ...MOCK_LAYOUT.elements[4]!, polygon: target }] });
  models.segmentByText = vi.fn(async () => ({ polygon: mask, confidence: 0.95, latencyMs: 0 }));
  models.segmentByBox = vi.fn(async () => ({ polygon: target, confidence: 0.9, latencyMs: 0 }));
  const sent: ServerMessage[] = [], usage: string[] = [];
  const pipeline = new SessionPipeline({ models, send: (m) => { ServerMessage.parse(m); sent.push(m); }, onUsage: (u) => { usage.push(u.kind); } });
  pipeline.onGoal('start'); return { models, sent, usage, pipeline };
}
const near = (actual: Polygon, expected: Polygon) => {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((p, i) => { expect(p.u).toBeCloseTo(expected[i]!.u); expect(p.v).toBeCloseTo(expected[i]!.v); });
};

test('full-frame element and SAM target polygons are projected into screen space', async () => {
  const { pipeline, models, sent, usage } = setup();
  await pipeline.onKeyframe(header, jpeg);
  const layout = sent.find((m) => m.type === 'layout'), result = sent.find((m) => m.type === 'target');
  expect(layout?.screenQuad).toEqual([{ x: 200, y: 50 }, { x: 800, y: 50 }, { x: 800, y: 450 }, { x: 200, y: 450 }]);
  near(layout!.elements[0]!.polygon, box(0.6, 0.7, 0.9, 0.9));
  near(result!.polygon, box(0.6, 0.7, 0.9, 0.9));
  expect(models.segmentByText).toHaveBeenCalledWith({ bytes: jpeg, width: 1000, height: 500 }, 'touchscreen display');
  // SAM still reads the full image, so its box prompt must stay in image pixels.
  expect(models.segmentByBox).toHaveBeenCalledWith({ bytes: jpeg, mime: 'image/jpeg', width: 1000, height: 500 },
    { left: 560, top: 330, right: 740, bottom: 410 });
  expect(usage.filter((kind) => kind === 'sam_image')).toHaveLength(2);
});

test('a missing SAM target mask falls back to the projected Spark box', async () => {
  const { pipeline, models, sent } = setup();
  models.segmentByBox = vi.fn(async () => ({ polygon: null, confidence: null, latencyMs: 0 }));
  await pipeline.onKeyframe(header, jpeg);
  near(sent.find((m) => m.type === 'target')!.polygon, box(0.6, 0.7, 0.9, 0.9));
});

test('full frame without any usable screen quad asks for framing instead of publishing a guessed target', async () => {
  const { pipeline, models, sent } = setup(null);
  await pipeline.onKeyframe(header, jpeg);
  expect(sent.map((m) => m.type)).toEqual(['goal.ack', 'ask']);
  expect(models.segmentByBox).not.toHaveBeenCalled();
});

test('a valid device quad is a fallback when screen segmentation finds no mask', async () => {
  const { pipeline, sent } = setup(null);
  const quad = screen.map(({ u, v }) => ({ x: u * 1000, y: v * 500 }));
  await pipeline.onKeyframe({ ...header, quad }, jpeg);
  near(sent.find((m) => m.type === 'target')!.polygon, box(0.6, 0.7, 0.9, 0.9));
});

test('full parse and screen detection run concurrently; abort suppresses both late results', async () => {
  const { pipeline, models, sent, usage } = setup();
  let finishParse!: () => void, finishScreen!: () => void;
  const parse = models.parseScreen, segment = models.segmentByText;
  models.parseScreen = vi.fn(async (image, options) => { await new Promise<void>((r) => { finishParse = r; }); return parse(image, options); });
  models.segmentByText = vi.fn(async (image, phrase) => { await new Promise<void>((r) => { finishScreen = r; }); return segment(image, phrase); });
  const work = pipeline.onKeyframe(header, jpeg);
  await vi.waitFor(() => { expect(models.parseScreen).toHaveBeenCalledOnce(); expect(models.segmentByText).toHaveBeenCalledOnce(); });
  pipeline.abort(); await work; finishParse(); finishScreen(); await new Promise(setImmediate);
  expect(sent.map((m) => m.type)).toEqual(['goal.ack']);
  expect(usage.sort()).toEqual(['sam_image', 'spark']);
});

test.each([0, 90, 180, 270] as const)('quad ordering follows content rotation %i', (rotation) => {
  const space = fullFrameCoordinates(header.imageSize, screen, undefined, rotation)!;
  const shift = rotation / 90, pixels = screen.map(({ u, v }) => ({ x: u * 1000, y: v * 500 }));
  expect(space.screenQuad).toEqual(pixels.map((_, i) => pixels[(i + shift) % 4]));
  const first = space.screenQuad[0]!;
  const around = box(first.x / 1000, first.y / 500, (first.x + (rotation === 90 || rotation === 180 ? -10 : 10)) / 1000,
    (first.y + (rotation === 180 || rotation === 270 ? -10 : 10)) / 500);
  expect(space.toScreen(around)).not.toBeNull();
});

test('perspective screen corners project to the unit square without assuming an axis-aligned crop', () => {
  const mask = [{ u: 0.1, v: 0.15 }, { u: 0.85, v: 0.25 }, { u: 0.75, v: 0.9 }, { u: 0.2, v: 0.8 }];
  const space = fullFrameCoordinates(header.imageSize, mask, undefined, 0)!;
  near(space.toScreen(mask)!, box(0, 0, 1, 1));
});

test('screen geometry rejects degenerate masks and excludes controls outside the screen', () => {
  expect(fullFrameCoordinates(header.imageSize, box(0.2, 0.2, 0.2, 0.2), undefined, 0)).toBeNull();
  const space = fullFrameCoordinates(header.imageSize, screen, undefined, 0)!;
  expect(space.toScreen(box(0, 0, 0.1, 0.05))).toBeNull();
  near(space.toScreen(box(0.1, 0.3, 0.5, 0.5))!, box(0, 0.25, 0.5, 0.5));
});
