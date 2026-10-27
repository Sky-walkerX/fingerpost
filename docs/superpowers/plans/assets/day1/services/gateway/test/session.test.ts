import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { encodeFrame, LIMITS, type ServerMessage } from '@fingerpost/protocol';
import { SessionHub } from '../src/session/hub.ts';

const fixture = (name: string) => readFileSync(new URL(`../../../packages/protocol/fixtures/valid/${name}`, import.meta.url), 'utf8');
const hello = fixture('client.hello.json');
const keyframeHeader = JSON.parse(fixture('client.keyframe.json'));
const make = (onMessage?: (m: unknown, p: Uint8Array | null) => void | Promise<void>) => {
  const sent: ServerMessage[] = [];
  const hub = new SessionHub({ send: (m) => sent.push(m), ...(onMessage ? { handlers: { onMessage } } : {}) });
  return { hub, sent };
};
const helloed = async (onMessage?: Parameters<typeof make>[0]) => { const h = make(onMessage); await h.hub.onText(hello); h.sent.length = 0; return h; };

test('hello → ready with session id, quota and flags; locale and simRunId are remembered', async () => {
  const { hub, sent } = make();
  await hub.onText(hello);
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ type: 'ready', sessionId: hub.id, quota: { tasksLeft: 30 }, flags: { cloudEnabled: true, privateAvailable: false } });
  expect([hub.locale, hub.simRunId]).toEqual(['en', 'run-01']);
});
test('message before hello → bad_message', async () => {
  const { hub, sent } = make();
  await hub.onText(fixture('client.goal.json'));
  expect(sent[0]).toMatchObject({ type: 'error', code: 'bad_message' });
});
test('unknown client type → bad_message and the session stays usable', async () => {
  const seen: string[] = [];
  const { hub, sent } = await helloed((m) => { seen.push((m as { type: string }).type); });
  await hub.onText('{"type":"nope","id":"x","ts":1}');
  expect(sent[0]).toMatchObject({ code: 'bad_message' });
  await hub.onText(fixture('client.goal.json'));
  expect(seen).toEqual(['goal']);
});
test('non-JSON text → bad_message', async () => { const { hub, sent } = await helloed(); await hub.onText('not json'); expect(sent[0]).toMatchObject({ code: 'bad_message' }); });
test(`text over ${LIMITS.textBytes} bytes → bad_message`, async () => {
  const { hub, sent } = await helloed();
  await hub.onText(JSON.stringify({ type: 'goal', pad: 'x'.repeat(LIMITS.textBytes) }));
  expect(sent[0]).toMatchObject({ code: 'bad_message' });
});
test('binary frame with headerLen beyond the buffer → bad_message', async () => {
  const { hub, sent } = await helloed();
  await hub.onBinary(new Uint8Array([0, 0, 1, 0, 123]));
  expect(sent[0]).toMatchObject({ code: 'bad_message' });
});
test('keyframe payload at the limit is forwarded, one byte over is rejected', async () => {
  const got: number[] = [];
  const { hub, sent } = await helloed((_m, p) => { got.push(p?.length ?? -1); });
  await hub.onBinary(encodeFrame(keyframeHeader, new Uint8Array(LIMITS.keyframeBytes)));
  await hub.onBinary(encodeFrame(keyframeHeader, new Uint8Array(LIMITS.keyframeBytes + 1)));
  expect(got).toEqual([LIMITS.keyframeBytes]);
  expect(sent[0]).toMatchObject({ code: 'bad_message' });
});
test('a keyframe sent as text (no payload) → bad_message', async () => {
  const { hub, sent } = await helloed();
  await hub.onText(fixture('client.keyframe.json'));
  expect(sent[0]).toMatchObject({ code: 'bad_message' });
});
test('hello with another protocol version → version_unsupported', async () => {
  const { hub, sent } = make();
  await hub.onText(hello.replace('fp.v1', 'fp.v2'));
  expect(sent[0]).toMatchObject({ type: 'error', code: 'version_unsupported' });
});
test('a handler that throws becomes a retryable model_unavailable error, not a crash', async () => {
  const { hub, sent } = await helloed(() => { throw new Error('boom'); });
  await hub.onText(fixture('client.goal.json'));
  expect(sent[0]).toMatchObject({ type: 'error', code: 'model_unavailable', retryable: true });
});
