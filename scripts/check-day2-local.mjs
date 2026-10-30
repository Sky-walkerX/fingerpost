import assert from 'node:assert/strict';
import { writeSync } from 'node:fs';
import { encodeFrame, ServerMessage } from '../packages/protocol/src/index.ts';
import { buildApp } from '../services/gateway/src/app.ts';
import { loadConfig } from '../services/gateway/src/config.ts';
import { mockModels } from '../services/gateway/src/models/mock/mock-models.ts';
import { mockAsr } from '../services/gateway/src/models/mock/mock-asr.ts';
import { normalizeLabel } from '../services/gateway/src/parse/spark-parse.ts';
import { buildCooktop } from '../apps/web/src/sim/scenes/cooktop.ts';
import { buildTicket } from '../apps/web/src/sim/scenes/ticket.ts';
import { applyTouch, currentScreen, labelsFor, newRun } from '../apps/web/src/sim/log.ts';
import { CANVAS } from '../apps/web/src/sim/model.ts';
import { postTouch } from '../apps/web/src/sim/net.ts';

// A protocol/geometry integration check with known synthetic screens, not recognition or proxy acceptance.
async function check(scene, controlId) {
  const state = newRun(`local-${scene.id}`, scene);
  const control = currentScreen(state).elements.find((element) => element.id === controlId);
  assert.ok(control);
  const fixture = () => ({ screenType: scene.id === 'cooktop' ? 'appliance' : 'menu', sensitivity: 'none', language: 'en', rotation: 0,
    elements: labelsFor(currentScreen(state)).map(({ id, label, role, u, v, w, h }) => ({ id, label, role, confidence: 0.95,
      textNorm: normalizeLabel(label), polygon: [{ u, v }, { u: u + w, v }, { u: u + w, v: v + h }, { u, v: v + h }] })) });
  const models = mockModels(fixture());
  models.parseScreen = async (...args) => mockModels(fixture()).parseScreen(...args);
  models.segmentByText = async () => ({ polygon: [{ u: 0, v: 0 }, { u: 1, v: 0 }, { u: 1, v: 1 }, { u: 0, v: 1 }], confidence: 1, latencyMs: 0 });
  const app = await buildApp(loadConfig({ MODEL_MODE: 'mock', LOG_LEVEL: 'silent' }), { models, asr: mockAsr(control.label) });
  let socket;
  try {
    const url = await app.listen({ host: '127.0.0.1', port: 0 });
    assert.equal((await fetch(`${url}/healthz`)).status, 200);
    const preflight = await fetch(`${url}/v1/sim/events`, { method: 'OPTIONS', headers: {
      origin: 'http://localhost:5173', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type',
    } });
    assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('access-control-allow-origin'), '*');
    const event = { runId: state.runId, screenId: state.screenId, x: 1, y: 1, u: 0.1, v: 0.1, elementId: null, ts: 0 };
    const post = (body) => fetch(`${url}/v1/sim/events`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await (await post(event)).json()).delivered, 0);
    const messages = [], waiters = new Map();
    const next = (type) => new Promise((resolve) => waiters.set(type, resolve));
    socket = new WebSocket(`${url.replace('http:', 'ws:')}/v1/session`);
    socket.onmessage = (received) => {
      const message = ServerMessage.parse(JSON.parse(received.data)); messages.push(message); waiters.get(message.type)?.(message);
    };
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    const ready = next('ready');
    socket.send(JSON.stringify({ type: 'hello', id: 'hello', ts: 0, appVersion: '0.1.0', protocol: 'fp.v1', locale: 'en', mode: 'guide', privacy: 'normal', caps: { simRunId: state.runId } }));
    await ready;
    const ack = next('goal.ack');
    socket.send(encodeFrame({ type: 'audio', id: 'audio', ts: 0, seq: 0, sampleRate: 16000 }, new Uint8Array(640)));
    assert.equal((await ack).goal, control.label);
    assert.equal(messages.filter((m) => m.type === 'transcript' && m.final).length, 1);
    socket.send(JSON.stringify({ type: 'audio.end', id: 'end', ts: 0 }));
    const layout = next('layout'), target = next('target');
    socket.send(encodeFrame({ type: 'keyframe', id: 'locate', ts: 0, kind: 'full', purpose: 'locate', imageSize: CANVAS, ocrTokens: [] }, new Uint8Array([0xff, 0xd8])));
    assert.equal((await layout).screenQuad.length, 4); assert.equal((await target).elementId, control.id);
    assert.equal((await (await post({ ...event, runId: 'unrelated-run' })).json()).delivered, 0);
    const touch = next('sim.touch');
    const hit = applyTouch(state, { x: control.rect.x + control.rect.w / 2, y: control.rect.y + control.rect.h / 2, pointerId: 1, ts: 0 });
    let delivered = 0;
    assert.equal(await postTouch(hit, { gatewayUrl: url, fetchImpl: async (...args) => {
      const response = await fetch(...args); delivered = (await response.clone().json()).delivered;
      assert.equal(response.headers.get('access-control-allow-origin'), '*'); return response;
    } }), true);
    assert.equal(delivered, 1); assert.equal((await touch).elementId, control.id);
    const verified = next('verify');
    socket.send(encodeFrame({ type: 'keyframe', id: 'verify', ts: 0, kind: 'screen', purpose: 'verify', imageSize: CANVAS, ocrTokens: [] }, new Uint8Array([0xff, 0xd8])));
    assert.deepEqual({ re: (await verified).re, result: (await verified).result }, { re: 'verify', result: 'ok' });
    const finish = next('finish'); socket.send(JSON.stringify({ type: 'abort', id: 'stop', ts: 0 }));
    assert.equal((await finish).result, 'aborted');
    assert.equal(messages.some((m) => m.type === 'error'), false);
  } finally { socket?.close(); await app.close(); }
}

const timeout = setTimeout(() => { writeSync(2, 'Local Day 2 check timed out.\n'); process.exit(1); }, 20_000);
try {
  await check(buildCooktop(2), 'boil');
  await check(buildTicket(2), 'english');
  writeSync(1, JSON.stringify({ scenarios: 2, syntheticEndpointing: true, fullFrameAnchor: true, linkedTouchAndVerify: true, externalCalls: 0 }) + '\n');
} catch {
  writeSync(2, 'Local Day 2 check failed. Run the gateway/web tests for details.\n'); process.exitCode = 1;
} finally { clearTimeout(timeout); }
