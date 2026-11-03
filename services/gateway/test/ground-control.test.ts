import OpenAI from 'openai';
import sharp from 'sharp';
import { expect, test, vi } from 'vitest';
import { groundControl } from '../src/parse/ground-control.ts';

const element = { id: 'synthetic-control', label: 'Synthetic control', role: 'button' as const, confidence: .95,
  polygon: [{ u: .4, v: .4 }, { u: .6, v: .4 }, { u: .6, v: .6 }, { u: .4, v: .6 }] };
const box = { x_min: 250, y_min: 250, x_max: 750, y_max: 750 };
const bytes = () => sharp({ create: { width: 100, height: 80, channels: 3, background: '#406080' } }).jpeg().toBuffer();
function client(result: unknown) {
  const request = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ id: 'synthetic', object: 'chat.completion', created: 0,
    model: 'muse-spark-1.3', choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(result) }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 } }), { headers: { 'content-type': 'application/json' } }));
  return { port: new OpenAI({ apiKey: 'synthetic-key', baseURL: 'https://synthetic.invalid/v1', maxRetries: 0, fetch: request }), request };
}

test('strict structured grounding maps crop coordinates back to the source and reports its billed tokens', async () => {
  const { port, request } = client({ actuation: 'press', bbox: box, confidence: .9 });
  const image = await bytes(), saved = Buffer.from(image);
  const result = await groundControl(port, { bytes: image, width: 100, height: 80 }, { locale: 'en', goal: 'Synthetic', element });
  expect(request).toHaveBeenCalledOnce();
  expect(result.polygon![0]!.u).toBeCloseTo(.35);
  expect(result.polygon![0]!.v).toBeCloseTo(.35);
  expect(result.polygon![2]!.u).toBeCloseTo(.65);
  expect(result.polygon![2]!.v).toBeCloseTo(.65);
  expect(result.usage).toEqual({ inputTokens: 4, outputTokens: 2 });
  expect(image.equals(saved)).toBe(true);
});

test.each(['turn', 'slide', 'not_found'] as const)('a %s result has no guessed press polygon', async (actuation) => {
  const { port } = client({ actuation, bbox: null, confidence: .9 });
  const result = await groundControl(port, { bytes: await bytes(), width: 100, height: 80 }, { locale: 'en', goal: 'Synthetic', element });
  expect(result.polygon).toBeNull();
  expect(result.actuation).toBe(actuation);
});

test.each([
  { actuation: 'press', bbox: null, confidence: .9 },
  { actuation: 'turn', bbox: box, confidence: .9 },
  { actuation: 'press', bbox: { ...box, x_max: 250 }, confidence: .9 },
  { actuation: 'press', bbox: { ...box, y_max: 1001 }, confidence: .9 },
  { actuation: 'press', bbox: box, confidence: .9, unexpected: true },
])('invalid model output cannot become a target', async (value) => {
  const { port } = client(value);
  await expect(groundControl(port, { bytes: await bytes(), width: 100, height: 80 }, { locale: 'en', goal: 'Synthetic', element })).rejects.toThrow();
});

test('cancellation before the crop prevents every model request', async () => {
  const { port, request } = client({ actuation: 'press', bbox: box, confidence: .9 });
  const controller = new AbortController(); controller.abort();
  await expect(groundControl(port, { bytes: await bytes(), width: 100, height: 80, signal: controller.signal },
    { locale: 'en', goal: 'Synthetic', element })).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
});
