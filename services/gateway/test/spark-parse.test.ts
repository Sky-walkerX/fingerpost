import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import type OpenAI from 'openai';
import { Layout } from '@fingerpost/protocol';
import { normalizeLabel, parseScreen, SPARK_SCREEN_JSON_SCHEMA } from '../src/parse/spark-parse.ts';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/spark-parse.response.json', import.meta.url), 'utf8'));
const stub = (response: unknown) => {
  const calls: any[] = [];
  const client = { chat: { completions: { create: async (b: unknown) => { calls.push(b); return response; } } } } as unknown as OpenAI;
  return { client, calls };
};
const img = { bytes: new Uint8Array([0xff, 0xd8, 0xff]), mime: 'image/jpeg' as const };

test('recorded response → protocol-valid layout with normalized polygons', async () => {
  const { client } = stub(fixture);
  const r = await parseScreen(client, img, { locale: 'hi' });
  const asMsg = { type: 'layout', id: 'x', ts: 1, fingerprint: '', source: 'model', ...r.layout };
  expect(Layout.safeParse(asMsg).success).toBe(true);
  expect(r.layout).toMatchObject({ screenType: 'payment_entry', sensitivity: 'financial', language: 'en', rotation: 0 });
  expect(r.usage).toEqual({ inputTokens: 1612, outputTokens: 214 });
  expect(r.promptId).toBe('parse-screen.v1');
});
test('the pay-role element survives with its local label; overshoot is clamped', async () => {
  const r = await parseScreen(stub(fixture).client, img, { locale: 'hi' });
  const pay = r.layout.elements.find((e) => e.role === 'pay')!;
  expect(pay).toMatchObject({ id: 'e2', label: 'Pay by card', labelLocal: 'कार्ड से भुगतान', textNorm: 'pay by card' });
  expect(Math.max(...pay.polygon.map((p) => p.u))).toBe(1);
});
test('swapped corners are reordered and confidence is clamped to 1', async () => {
  const cancel = (await parseScreen(stub(fixture).client, img, { locale: 'hi' })).layout.elements.find((e) => e.label === 'Cancel')!;
  expect(cancel.polygon[0]).toEqual({ u: 0.1, v: 0.7 });
  expect(cancel.confidence).toBe(1);
  expect(cancel.state).toBe('enabled');
});
test('zero-area elements are dropped', async () => {
  const r = await parseScreen(stub(fixture).client, img, { locale: 'hi' });
  expect(r.layout.elements.map((e) => e.label)).toEqual(['Total ₹149', 'Pay by card', 'Cancel']);
});
test('request uses muse-spark-1.3, strict json_schema, a system prompt and a data-URL image', async () => {
  const { client, calls } = stub(fixture);
  await parseScreen(client, img, { locale: 'es', goal: 'pay' });
  const body = calls[0];
  expect(body.model).toBe('muse-spark-1.3');
  expect(body.response_format).toMatchObject({ type: 'json_schema', json_schema: { name: 'screen_layout', strict: true } });
  expect(body.messages[0]).toMatchObject({ role: 'system' });
  expect(body.messages[1].content[0].text).toContain('es');
  expect(body.messages[1].content[1].image_url.url).toMatch(/^data:image\/jpeg;base64,/);
});
test('JSON schema meets Meta strict mode: every object closed, every key required', () => {
  const walk = (n: any): void => {
    if (n && typeof n === 'object') {
      if (n.type === 'object') {
        expect(n.additionalProperties).toBe(false);
        expect([...(n.required ?? [])].sort()).toEqual(Object.keys(n.properties ?? {}).sort());
      }
      Object.values(n).forEach(walk);
    }
  };
  walk(SPARK_SCREEN_JSON_SCHEMA);
  expect(SPARK_SCREEN_JSON_SCHEMA).not.toHaveProperty('$schema');
});
test('empty or malformed model content throws a clear error', async () => {
  await expect(parseScreen(stub({ choices: [{ message: { content: '' } }] }).client, img, { locale: 'en' })).rejects.toThrow(/no content/);
  await expect(parseScreen(stub({ choices: [{ message: { content: '{"screen_type":"atm"}' } }] }).client, img, { locale: 'en' })).rejects.toThrow();
});
test('normalizeLabel folds case, width and punctuation', () => {
  expect(normalizeLabel('  ＰＡＹ — by Card! ')).toBe('pay by card');
});
