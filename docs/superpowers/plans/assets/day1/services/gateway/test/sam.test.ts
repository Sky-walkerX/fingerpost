import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import type OpenAI from 'openai';
import { Polygon } from '@fingerpost/protocol';
import { segmentByBox, segmentByText } from '../src/parse/sam.ts';

const events = (name: string) => {
  const list = JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')) as { type: string }[];
  return (async function* () { yield* list; })();
};
const image = { bytes: new Uint8Array([0xff, 0xd8, 0xff]), width: 320, height: 334 };
const noClient = {} as OpenAI; // the events override means no network call is made

test('two objects without confidence → the larger mask wins, polygon is valid and inside its box', async () => {
  const r = await segmentByBox(noClient, image, { left: 150, top: 220, right: 280, bottom: 260 }, events('sam-two-objects.events.json'));
  expect(r.confidence).toBeNull();
  expect(Polygon.safeParse(r.polygon).success).toBe(true);
  const us = r.polygon!.map((p) => p.u * 320);
  expect(Math.min(...us)).toBeGreaterThanOrEqual(210); // object 0 spans x 211–270
  expect(Math.max(...us)).toBeLessThanOrEqual(272);
});

test('confidence decides over area when present', async () => {
  const r = await segmentByBox(noClient, image, { left: 150, top: 220, right: 280, bottom: 260 }, events('sam-confidence.events.json'));
  expect(r.confidence).toBe(0.93);
  expect(Math.max(...r.polygon!.map((p) => p.u * 320))).toBeLessThanOrEqual(204); // object 1 spans x 155–202
});

test('zero matches → polygon null, confidence null, no throw', async () => {
  const r = await segmentByText(noClient, image, 'touchscreen display', events('sam-empty.events.json'));
  expect(r).toMatchObject({ polygon: null, confidence: null });
});

test('a box partly outside the image is clamped instead of throwing', async () => {
  await expect(segmentByBox(noClient, image, { left: -20, top: 300, right: 900, bottom: 9999 }, events('sam-empty.events.json'))).resolves.toMatchObject({ polygon: null });
});

test('a command-style phrase is rejected before any request', () => {
  expect(() => segmentByText(noClient, image, 'Segment the start button?')).toThrow(/noun phrase/);
});

test('live path sends sam-3.1 with input_text + input_image (request shape)', async () => {
  let body: any;
  const client = { responses: { create: async (b: unknown) => { body = b; return events('sam-empty.events.json'); } } } as unknown as OpenAI;
  await segmentByBox(client, image, { left: 10, top: 20, right: 40, bottom: 60 });
  expect(body).toMatchObject({ model: 'sam-3.1', stream: true });
  expect(body.input[0].content[0]).toEqual({ type: 'input_text', text: '<0f>1<|box;x1=10;y1=20;x2=39;y2=59;w=320;h=334|>' });
  expect(body.input[0].content[1].image_url).toMatch(/^data:image\/jpeg;base64,/);
});
