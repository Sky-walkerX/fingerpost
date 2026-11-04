import sharp from 'sharp';
import { expect, test, vi } from 'vitest';
import { loadConfig } from '../src/config.ts';
import { createMetaClient } from '../src/models/meta-client.ts';
import { liveModels } from '../src/models/port.ts';
import { phoneDevConfig } from '../scripts/phone-dev.ts';

const image = { bytes: new Uint8Array([0xff, 0xd8]), mime: 'image/jpeg' as const };
const layout = JSON.stringify({ screen_type: 'menu', sensitivity: 'none', language: 'en', rotation: 0, elements: [
  { label: 'Synthetic', label_local: null, role: 'button', state: null, bbox: { x_min: 100, y_min: 100, x_max: 300, y_max: 200 }, confidence: 0.9 }] });
const grounded = JSON.stringify({ actuation: 'press', bbox: { x_min: 250, y_min: 250, x_max: 750, y_max: 750 }, confidence: 0.9 });

/** Synthetic provider: records every requested model id; `fail` models answer 503. */
function provider(fail: string[] = []) {
  const models: string[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as { model: string; response_format: { json_schema: { name: string } } };
    models.push(body.model);
    if (fail.includes(body.model)) return new Response(JSON.stringify({ error: { message: 'synthetic' } }), { status: 503, headers: { 'content-type': 'application/json' } });
    const content = body.response_format.json_schema.name === 'press_control' ? grounded : layout;
    return new Response(JSON.stringify({ id: 'x', object: 'chat.completion', created: 0, model: body.model,
      choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  return { client: createMetaClient('synthetic-key', 10_000).withOptions({ fetch, logLevel: 'off' }), models };
}

test('guidance-spec §8: screen reading defaults to Spark 1.3 and accepts only Standard vision models', () => {
  expect(loadConfig({}).VISION_MODEL).toBe('muse-spark-1.3');
  expect(loadConfig({ VISION_MODEL: 'muse-wonder-1.0' }).VISION_MODEL).toBe('muse-wonder-1.0');
  for (const bad of ['muse-wonder-1.0-contributor', 'muse-spark-1.3-contributor', 'muse-image-1.0', 'gpt'])
    expect(() => loadConfig({ VISION_MODEL: bad })).toThrow(/VISION_MODEL/);
});

test('the local live phone gateway takes the vision model from the private env', () => {
  expect(phoneDevConfig({ live: true, env: { META_API_KEY: 'synthetic-private-key', VISION_MODEL: 'muse-wonder-1.0' } }).VISION_MODEL).toBe('muse-wonder-1.0');
  expect(phoneDevConfig({ env: { VISION_MODEL: 'muse-wonder-1.0' } }).VISION_MODEL).toBe('muse-spark-1.3');
});

test('a chosen vision model reads the screen and still falls back to Spark 1.2 on a provider failure', async () => {
  const ok = provider();
  await liveModels(ok.client, { visionModel: 'muse-wonder-1.0' }).parseScreen(image, { locale: 'en' });
  expect(ok.models).toEqual(['muse-wonder-1.0']);
  const failing = provider(['muse-wonder-1.0']);
  const result = await liveModels(failing.client, { visionModel: 'muse-wonder-1.0' }).parseScreen(image, { locale: 'en' });
  expect(result.layout.elements[0]!.label).toBe('Synthetic');
  expect(failing.models).toEqual(['muse-wonder-1.0', 'muse-spark-1.2']);
});

test('the focused grounding look uses the same vision model; omitted options keep Spark 1.3', async () => {
  const bytes = await sharp({ create: { width: 100, height: 80, channels: 3, background: '#406080' } }).jpeg().toBuffer();
  const element = { id: 'synthetic-control', label: 'Synthetic control', role: 'button' as const, confidence: .95,
    polygon: [{ u: .4, v: .4 }, { u: .6, v: .4 }, { u: .6, v: .6 }, { u: .4, v: .6 }] };
  const wonder = provider();
  await liveModels(wonder.client, { visionModel: 'muse-wonder-1.0' }).groundControl!({ bytes, width: 100, height: 80 }, { locale: 'en', goal: 'Synthetic', element });
  expect(wonder.models).toEqual(['muse-wonder-1.0']);
  const standard = provider();
  await liveModels(standard.client).parseScreen(image, { locale: 'en' });
  await liveModels(standard.client).groundControl!({ bytes, width: 100, height: 80 }, { locale: 'en', goal: 'Synthetic', element });
  expect(standard.models).toEqual(['muse-spark-1.3', 'muse-spark-1.3']);
});
