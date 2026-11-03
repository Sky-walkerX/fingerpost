import { expect, test, vi } from 'vitest';
import { ServerMessage, type Keyframe, type Polygon } from '@fingerpost/protocol';
import { mockModels, MOCK_LAYOUT } from '../src/models/mock/mock-models.ts';
import { SessionPipeline } from '../src/session/pipeline.ts';
import { ModelsUnavailable, createRouter } from '../src/models/router.ts';
import type { ControlGrounding } from '../src/parse/ground-control.ts';

const box = (l: number, t: number, r: number, b: number): Polygon => [{ u: l, v: t }, { u: r, v: t }, { u: r, v: b }, { u: l, v: b }];
const caption = box(.6, .75, .7, .8), button = box(.6, .6, .7, .7), panel = box(.1, .5, .9, .9), display = box(.3, .1, .7, .25);
const header: Keyframe = { type: 'keyframe', id: 'synthetic-grounding', ts: 0, kind: 'full', purpose: 'locate', imageSize: { w: 1000, h: 1000 }, ocrTokens: [] };
const jpeg = new Uint8Array([0xff, 0xd8]);
const grounded = (): ControlGrounding => ({ actuation: 'press', polygon: button, confidence: .9, usage: { inputTokens: 4, outputTokens: 2 }, latencyMs: 0, promptId: 'synthetic-grounding' });
function setup() {
  const groundControl = vi.fn(async () => grounded());
  const models = { ...mockModels({ ...MOCK_LAYOUT, elements: [{ ...MOCK_LAYOUT.elements[4]!, polygon: caption }] }), groundControl };
  models.segmentByText = vi.fn(async (_image, concept) => ({ polygon: concept === 'control panel' ? panel : display, confidence: .95, latencyMs: 0 }));
  models.segmentByBox = vi.fn(async () => ({ polygon: button, confidence: .9, latencyMs: 0 }));
  const sent: ServerMessage[] = [], usage: string[] = [];
  const pipeline = new SessionPipeline({ models, send: (m) => { ServerMessage.parse(m); sent.push(m); }, onUsage: (u) => { usage.push(u.kind); } });
  pipeline.onGoal('Start');
  return { pipeline, models, sent, usage, groundControl };
}

test('a semantic control panel takes precedence over a broad local quad and a caption box', async () => {
  const { pipeline, models, sent, groundControl, usage } = setup();
  await pipeline.onKeyframe({ ...header, quad: box(.01, .01, .99, .99).map(({ u, v }) => ({ x: u * 1000, y: v * 1000 })) }, jpeg);
  expect(groundControl).toHaveBeenCalledOnce();
  expect(vi.mocked(models.segmentByText).mock.calls.map(([, concept]) => concept)).toEqual(['touchscreen display', 'control panel']);
  expect(sent.find((m) => m.type === 'layout')?.screenQuad).toEqual(panel.map(({ u, v }) => ({ x: u * 1000, y: v * 1000 })));
  const target = sent.find((m) => m.type === 'target')!;
  expect(target.polygon[0]!.u).toBeCloseTo(.625);
  expect(target.polygon[0]!.v).toBeCloseTo(.25);
  expect(usage.filter((u) => u === 'spark')).toHaveLength(2);
});

test('the corrected box also drives rectified-screen targets and the SAM box prompt', async () => {
  const { pipeline, models, sent } = setup();
  await pipeline.onKeyframe({ ...header, kind: 'screen' }, jpeg);
  expect(models.segmentByBox).toHaveBeenCalledWith(expect.anything(), { left: 600, top: 600, right: 700, bottom: 700 });
  expect(sent.at(-1)).toMatchObject({ type: 'target', polygon: button });
});

test.each(['turn', 'slide', 'not_found'] as const)('a %s result cannot fall back to the original misleading caption', async (actuation) => {
  const { pipeline, groundControl, sent, models } = setup();
  groundControl.mockResolvedValue({ ...grounded(), actuation, polygon: null });
  await pipeline.onKeyframe({ ...header, kind: 'screen' }, jpeg);
  expect(sent.at(-1)?.type).toBe('ask');
  expect(sent.some((m) => m.type === 'target')).toBe(false);
  expect(models.segmentByBox).not.toHaveBeenCalled();
});

test('unavailable grounding never silently restores the unverified coarse box', async () => {
  const { pipeline, groundControl, sent } = setup();
  groundControl.mockRejectedValue(new ModelsUnavailable());
  await pipeline.onKeyframe({ ...header, kind: 'screen' }, jpeg);
  expect(sent.some((m) => m.type === 'target')).toBe(false);
  expect(sent.at(-1)?.type).toBe('ask');
});

test('a valid remote-control surface can recover an LCD that excludes the requested control', async () => {
  const { pipeline, models, sent } = setup();
  vi.mocked(models.segmentByText).mockImplementation(async (_image, concept) => ({ polygon: concept === 'remote control' ? panel : concept === 'control panel' ? null : display, confidence: .95, latencyMs: 0 }));
  await pipeline.onKeyframe(header, jpeg);
  expect(vi.mocked(models.segmentByText).mock.calls.map(([, concept]) => concept)).toEqual(['touchscreen display', 'control panel', 'remote control']);
  expect(sent.at(-1)?.type).toBe('target');
});

test('cancelling during grounding suppresses all late geometry and target publication', async () => {
  const { pipeline, groundControl, sent } = setup();
  let finish!: (value: ReturnType<typeof grounded>) => void;
  groundControl.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const pending = pipeline.onKeyframe({ ...header, kind: 'screen' }, jpeg);
  await vi.waitFor(() => expect(groundControl).toHaveBeenCalledOnce());
  pipeline.abort(); await pending; finish(grounded()); await new Promise(setImmediate);
  expect(sent.some((m) => m.type === 'target' || m.type === 'layout')).toBe(false);
});

test('private routing cannot borrow the public locator when Glimmer has no such capability', async () => {
  const { models, groundControl } = setup();
  const privateModels = mockModels({ ...MOCK_LAYOUT, elements: [{ ...MOCK_LAYOUT.elements[4]!, polygon: button }] });
  const sent: ServerMessage[] = [];
  const router = createRouter({ meta: models, glimmer: privateModels });
  const pipeline = new SessionPipeline({ models, route: router, send: (m) => sent.push(m) });
  pipeline.setPrivacy('private'); pipeline.onGoal('Start');
  await pipeline.onKeyframe({ ...header, kind: 'screen' }, jpeg);
  expect(groundControl).not.toHaveBeenCalled();
  expect(sent.at(-1)?.type).toBe('target');
});

test('a fresh sensitive classification does not send a crop to the public locator', async () => {
  const { pipeline, models, groundControl, sent } = setup();
  const parse = models.parseScreen;
  models.parseScreen = async (...args) => {
    const result = await parse(...args);
    return { ...result, layout: { ...result.layout, sensitivity: 'financial' } };
  };
  await pipeline.onKeyframe(header, jpeg);
  expect(groundControl).not.toHaveBeenCalled();
  expect(models.segmentByText).toHaveBeenCalledOnce();
  expect(sent.some((m) => m.type === 'target')).toBe(false);
});

test('a missing appliance button asks directly instead of spending the turn segmenting unrelated surfaces', async () => {
  const { pipeline, models, sent, groundControl } = setup();
  const parse = models.parseScreen;
  models.parseScreen = async (...args) => {
    const result = await parse(...args);
    return { ...result, layout: { ...result.layout, elements: result.layout.elements.map((e) => ({ ...e, label: 'Synthetic other', textNorm: 'synthetic other' })) } };
  };
  await pipeline.onKeyframe(header, jpeg);
  expect(groundControl).not.toHaveBeenCalled();
  expect(models.segmentByText).toHaveBeenCalledOnce();
  expect(sent.at(-1)?.type).toBe('ask');
  expect(sent.some((m) => m.type === 'target')).toBe(false);
});
