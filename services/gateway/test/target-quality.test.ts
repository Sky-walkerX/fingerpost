import { expect, test, vi } from 'vitest';
import { ServerMessage, type Keyframe, type Polygon } from '@fingerpost/protocol';
import { mockModels, MOCK_LAYOUT } from '../src/models/mock/mock-models.ts';
import type { ModelPort } from '../src/models/port.ts';
import { SessionPipeline } from '../src/session/pipeline.ts';

const box = (l: number, t: number, r: number, b: number): Polygon => [{ u: l, v: t }, { u: r, v: t }, { u: r, v: b }, { u: l, v: b }];
const panel = box(.15, .1, .85, .9), display = box(.3, .15, .7, .3), control = box(.55, .65, .75, .85);
const header: Keyframe = { type: 'keyframe', id: 'synthetic-frame', ts: 0, kind: 'full', purpose: 'locate', imageSize: { w: 1000, h: 1000 }, ocrTokens: [] };
const jpeg = new Uint8Array([0xff, 0xd8]);
function setup() {
  const models = mockModels({ ...MOCK_LAYOUT, elements: [{ ...MOCK_LAYOUT.elements[4]!, polygon: control }] });
  const segment = vi.fn(models.segmentByText).mockImplementation(async (_image, concept) => ({ polygon: concept === 'appliance' ? panel : null, confidence: .95, latencyMs: 0 }));
  models.segmentByText = segment;
  const sent: ServerMessage[] = [], usage: string[] = [];
  const pipeline = new SessionPipeline({ models, send: (m) => { ServerMessage.parse(m); sent.push(m); }, onUsage: (u) => { usage.push(u.kind); } });
  pipeline.onGoal('start');
  return { models, segment, sent, usage, pipeline };
}

test('an appliance without a display mask acquires the flat touch control panel before targeting', async () => {
  const { pipeline, segment, sent, usage } = setup();
  await pipeline.onKeyframe(header, jpeg);
  expect(segment.mock.calls.map(([, concept]) => concept)).toEqual(['touchscreen display', 'appliance']);
  expect(sent.find((m) => m.type === 'layout')?.screenQuad).toEqual(panel.map(({ u, v }) => ({ x: u * 1000, y: v * 1000 })));
  expect(sent.at(-1)?.type).toBe('target');
  expect(usage.filter((kind) => kind === 'sam_image')).toHaveLength(3);
});

test('an appliance LCD that excludes the requested control cannot replace a usable local panel plane', async () => {
  const { pipeline, segment, sent } = setup();
  segment.mockResolvedValue({ polygon: display, confidence: .99, latencyMs: 0 });
  await pipeline.onKeyframe({ ...header, quad: panel.map(({ u, v }) => ({ x: u * 1000, y: v * 1000 })) }, jpeg);
  expect(sent.find((m) => m.type === 'layout')?.screenQuad).toEqual(panel.map(({ u, v }) => ({ x: u * 1000, y: v * 1000 })));
  expect(sent.at(-1)?.type).toBe('target');
  expect(segment).toHaveBeenCalledOnce();
});

test('an appliance display-only mask triggers one panel lookup, never a guessed union of label boxes', async () => {
  const { pipeline, segment, sent } = setup();
  segment.mockImplementation(async (_image, concept) => ({ polygon: concept === 'touchscreen display' ? display : null, confidence: .99, latencyMs: 0 }));
  await pipeline.onKeyframe(header, jpeg);
  expect(segment).toHaveBeenCalledTimes(2);
  expect(sent.at(-1)?.type).toBe('ask');
  expect(sent.some((m) => m.type === 'target' || m.type === 'layout')).toBe(false);
});

test('screen planes must include most appliance controls and the specifically requested control', async () => {
  const { models, pipeline, segment, sent } = setup();
  const original = models.parseScreen;
  models.parseScreen = async (...args) => ({ ...await original(...args), layout: { ...MOCK_LAYOUT, elements: [
    ...Array.from({ length: 5 }, (_, i) => ({ ...MOCK_LAYOUT.elements[1]!, id: `c${i}`, polygon: box(.3, .2, .4, .3) })),
    { ...MOCK_LAYOUT.elements[4]!, polygon: control },
  ] } });
  segment.mockResolvedValue({ polygon: display, confidence: .99, latencyMs: 0 });
  await pipeline.onKeyframe(header, jpeg);
  expect(sent.some((m) => m.type === 'layout' || m.type === 'target')).toBe(false);
});

test('ordinary touchscreen layouts do not expand the screen plane to include controls outside it', async () => {
  const { models, pipeline, segment, sent } = setup();
  const original = models.parseScreen;
  models.parseScreen = async (...args) => ({ ...await original(...args), layout: { ...MOCK_LAYOUT, screenType: 'menu', elements: [{ ...MOCK_LAYOUT.elements[4]!, polygon: control }] } });
  segment.mockResolvedValue({ polygon: display, confidence: .99, latencyMs: 0 });
  await pipeline.onKeyframe(header, jpeg);
  expect(segment).toHaveBeenCalledOnce();
  expect(sent.find((m) => m.type === 'layout')?.elements).toHaveLength(0);
  expect(sent.some((m) => m.type === 'target')).toBe(false);
});

test.each([
  ['small icon fragment', box(.70, .78, .75, .85)],
  ['entire panel', panel],
  ['neighbouring control', box(.72, .65, .92, .85)],
] as const)('rejects a SAM %s and uses the complete Spark control box', async (_name, mask) => {
  const { models, pipeline, sent } = setup();
  models.segmentByBox = async () => ({ polygon: [...mask], confidence: .99, latencyMs: 0 });
  await pipeline.onKeyframe({ ...header, kind: 'screen' }, jpeg);
  expect(sent.at(-1)).toMatchObject({ type: 'target', polygon: control, confidence: .95 });
});

test('a substantial concave control mask remains valid without requiring its box centre to be tappable', async () => {
  const { models, pipeline, sent } = setup();
  const mask: Polygon = [{ u: .55, v: .65 }, { u: .75, v: .65 }, { u: .75, v: .72 }, { u: .62, v: .72 }, { u: .62, v: .85 }, { u: .55, v: .85 }];
  models.segmentByBox = async () => ({ polygon: mask, confidence: .9, latencyMs: 0 });
  await pipeline.onKeyframe({ ...header, kind: 'screen' }, jpeg);
  expect(sent.at(-1)).toMatchObject({ type: 'target', polygon: mask, confidence: .9 });
});

test('a sensitive appliance classification never starts an additional public panel lookup', async () => {
  const { models, pipeline, segment, sent } = setup();
  const original = models.parseScreen;
  models.parseScreen = async (...args) => ({ ...await original(...args), layout: { ...MOCK_LAYOUT, sensitivity: 'financial' } });
  await pipeline.onKeyframe(header, jpeg);
  expect(segment).toHaveBeenCalledOnce();
  expect(sent.some((m) => m.type === 'target')).toBe(false);
});

test('a sensitive classification remains protected even when no screen plane was acquired', async () => {
  const { models, pipeline, sent } = setup();
  const original = models.parseScreen;
  const parse = vi.fn<ModelPort['parseScreen']>(async (...args) => ({ ...await original(...args), layout: { ...MOCK_LAYOUT, sensitivity: 'financial' } }));
  models.parseScreen = parse;
  await pipeline.onKeyframe(header, jpeg);
  expect(pipeline.requiresLocalSpeech).toBe(true);
  pipeline.onGoal('synthetic new goal');
  await pipeline.onKeyframe({ ...header, id: 'second' }, jpeg);
  expect(parse).toHaveBeenCalledOnce();
  expect(sent.at(-1)).toMatchObject({ type: 'error', code: 'model_unavailable', retryable: false });
});
