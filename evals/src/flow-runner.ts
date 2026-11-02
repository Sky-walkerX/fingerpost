import { readFileSync, readdirSync, writeSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { encodeFrame, ServerMessage } from '@fingerpost/protocol';

export interface FlowStep {
  from: 'client' | 'server';
  msg: Record<string, unknown>;
  screen?: string;
}

export interface Flow {
  name: string;
  scene?: string;
  seed?: number;
  steps: FlowStep[];
}

export interface RunFlowOptions {
  gatewayUrl: string;
  simRender: (screen: string) => Uint8Array;
  timeoutMs?: number;
}

export interface Divergence {
  index: number;
  expected: unknown;
  got: unknown;
}

export interface FlowResult {
  ok: boolean;
  steps: number;
  firstDivergence?: Divergence;
}

/** Fields that carry decisions; everything else (ids, ts, wording, refined polygons) may differ. */
export const DECISION_FIELDS: Record<string, string[]> = {
  'goal.ack': ['intent'],
  say: ['priority'],
  layout: ['fingerprint', 'screenType', 'source'],
  target: ['elementId'],
  verify: ['re', 'result'],
  confirm: ['amount'],
  ask: [],
  finish: ['result', 'say'],
  'sim.touch': ['elementId'],
  ready: [],
};

function parseGatewayUrls(gatewayUrl: string): { wsUrl: string; httpBase: string } {
  const parsed = new URL(gatewayUrl);
  const isSecure = parsed.protocol === 'https:' || parsed.protocol === 'wss:';
  const httpProtocol = isSecure ? 'https:' : 'http:';
  const httpBase = `${httpProtocol}//${parsed.host}`;
  const wsProtocol = isSecure ? 'wss:' : 'ws:';
  const wsPath = parsed.pathname === '/' || parsed.pathname === '' ? '/v1/session' : parsed.pathname;
  const wsUrl = `${wsProtocol}//${parsed.host}${wsPath}`;
  return { wsUrl, httpBase };
}

function matchesValue(expected: unknown, actual: unknown): boolean {
  if (expected === '*') return true;
  if (expected === actual) return true;
  if (expected === undefined || actual === undefined) return false;
  if (typeof expected !== typeof actual) return false;
  if (typeof expected === 'object' && expected !== null && typeof actual === 'object' && actual !== null) {
    if (Array.isArray(expected)) {
      if (!Array.isArray(actual) || expected.length !== actual.length) return false;
      return expected.every((val, i) => matchesValue(val, (actual as unknown[])[i]));
    }
    const expObj = expected as Record<string, unknown>;
    const actObj = actual as Record<string, unknown>;
    for (const key of Object.keys(expObj)) {
      if (!matchesValue(expObj[key], actObj[key])) return false;
    }
    return true;
  }
  return false;
}

function matchesServerMessage(
  want: Record<string, unknown>,
  got: Record<string, unknown>,
  ids: Map<string, string>,
): boolean {
  if (want.type !== '*' && want.type !== got.type) return false;
  const fields = DECISION_FIELDS[want.type as string];
  if (fields) {
    for (const field of fields) {
      const expectedVal = want[field];
      const actualVal = got[field];
      if (field === 're' && typeof expectedVal === 'string') {
        const mapped = ids.get(expectedVal);
        if (mapped !== undefined && (actualVal === mapped || actualVal === expectedVal)) continue;
      }
      if (!matchesValue(expectedVal, actualVal)) return false;
    }
    return true;
  }
  for (const [k, expectedVal] of Object.entries(want)) {
    if (k === 'id' || k === 'ts' || k === 'sessionId') continue;
    if (!matchesValue(expectedVal, got[k])) return false;
  }
  return true;
}

/**
 * Contract replay runner: opens a real WebSocket to the gateway, sends client messages in order
 * (binary frames with simRender(screen) bytes as payload for keyframes), and compares each server
 * message to the flow's expected one.
 */
export async function runFlow(flow: Flow, o: RunFlowOptions): Promise<FlowResult> {
  const { wsUrl, httpBase } = parseGatewayUrls(o.gatewayUrl);
  const timeoutMs = o.timeoutMs ?? 5000;

  let ws: WebSocket;
  try {
    ws = new WebSocket(wsUrl);
  } catch (err) {
    return {
      ok: false,
      steps: 0,
      firstDivergence: { index: 0, expected: 'connected', got: String(err) },
    };
  }

  const received: ServerMessage[] = [];
  const waiters: Array<() => void> = [];
  let closed = false;

  const notifyWaiters = () => {
    while (waiters.length > 0) {
      waiters.shift()?.();
    }
  };

  ws.onmessage = (event) => {
    try {
      const text = typeof event.data === 'string'
        ? event.data
        : Buffer.isBuffer(event.data)
        ? event.data.toString('utf8')
        : new TextDecoder().decode(event.data as ArrayBuffer);
      const parsed = ServerMessage.parse(JSON.parse(text));
      received.push(parsed);
      notifyWaiters();
    } catch {
      // Ignore unparseable frames
    }
  };

  ws.onclose = () => {
    closed = true;
    notifyWaiters();
  };

  ws.onerror = () => {
    closed = true;
    notifyWaiters();
  };

  try {
    await new Promise<void>((resolve, reject) => {
      if (ws.readyState === WebSocket.OPEN) return resolve();
      ws.onopen = () => resolve();
      const origOnError = ws.onerror;
      ws.onerror = (e) => {
        origOnError?.call(ws, e);
        reject(new Error('WebSocket connection failed'));
      };
    });
  } catch (err) {
    return {
      ok: false,
      steps: 0,
      firstDivergence: { index: 0, expected: 'connected', got: String(err) },
    };
  }

  const ignored = new Set(['say', 'transcript']);
  const ids = new Map<string, string>();
  let consumed = 0;
  let seq = 0;

  try {
    for (let i = 0; i < flow.steps.length; i++) {
      const step = flow.steps[i]!;
      if (step.from === 'client') {
        const msg: Record<string, unknown> = {
          ...step.msg,
          id: step.msg.id === '*' ? `c${seq++}` : step.msg.id,
        };
        if (typeof msg.re === 'string') {
          msg.re = ids.get(msg.re) ?? msg.re;
        }
        if (msg.type === 'keyframe') {
          const bytes = o.simRender(step.screen ?? '');
          ws.send(encodeFrame(msg, bytes));
        } else {
          ws.send(JSON.stringify(msg));
        }
        if (step.msg.id !== '*' && typeof step.msg.id === 'string') {
          ids.set(step.msg.id, msg.id as string);
        }
        continue;
      }

      const want = step.msg;
      if (want.type === 'sim.touch') {
        const { runId, screenId, x, y, u, v, elementId } = want as Record<string, unknown>;
        const simUrl = new URL('/v1/sim/events', httpBase);
        await fetch(simUrl.toString(), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ runId, screenId, x, y, u, v, elementId, ts: 1 }),
        });
      }

      let got: ServerMessage | undefined;
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const next = received
          .slice(consumed)
          .findIndex((m) =>
            want.type === 'say'
              ? m.type === 'say' && (want.priority === undefined || m.priority === want.priority)
              : want.type === 'transcript'
              ? m.type === 'transcript'
              : !ignored.has(m.type),
          );
        if (next >= 0) {
          consumed += next;
          got = received[consumed];
          consumed++;
          break;
        }
        if (closed && received.slice(consumed).length === 0) break;
        await new Promise<void>((r) => {
          const timer = setTimeout(r, 20);
          waiters.push(() => {
            clearTimeout(timer);
            r();
          });
        });
      }

      if (!got) {
        return {
          ok: false,
          steps: i,
          firstDivergence: { index: i, expected: want, got: undefined },
        };
      }

      if (!matchesServerMessage(want, got as unknown as Record<string, unknown>, ids)) {
        return {
          ok: false,
          steps: i,
          firstDivergence: { index: i, expected: want, got },
        };
      }

      if (want.id !== '*' && typeof want.id === 'string') {
        ids.set(want.id, got.id);
      }
    }

    // Give a brief tick to see if any extra unexpected non-ignored message arrives
    await new Promise((r) => setTimeout(r, 30));
    const extra = received.slice(consumed).filter((m) => !ignored.has(m.type));
    if (extra.length > 0) {
      return {
        ok: false,
        steps: flow.steps.length,
        firstDivergence: { index: flow.steps.length, expected: undefined, got: extra[0] },
      };
    }

    return { ok: true, steps: flow.steps.length };
  } finally {
    try {
      ws.close();
    } catch {
      // Ignore close errors
    }
  }
}

export async function main(args = process.argv.slice(2)): Promise<number> {
  let gateway = process.env.GATEWAY_URL || 'http://localhost:8080';
  let flowFilter: string | undefined;

  try {
    const { values } = parseArgs({
      args: args.filter((a) => a !== '--'),
      options: {
        gateway: { type: 'string', default: gateway },
        flow: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
      strict: false,
    });
    if (values.help) {
      writeSync(1, 'usage: src/flow-runner.ts [--gateway <url>] [--flow <name>]\n');
      return 0;
    }
    if (values.gateway) gateway = values.gateway as string;
    if (values.flow) flowFilter = values.flow as string;
  } catch {
    writeSync(2, 'usage: src/flow-runner.ts [--gateway <url>] [--flow <name>]\n');
    return 2;
  }

  const flowsDir = new URL('../../packages/protocol/fixtures/flows/', import.meta.url);
  const files = readdirSync(flowsDir).filter((f) => f.endsWith('.json'));
  const targetFiles = flowFilter ? [`${flowFilter}.json`] : files;

  let allOk = true;
  for (const file of targetFiles) {
    const flowName = file.replace(/\.json$/, '');
    let flow: Flow;
    try {
      flow = JSON.parse(readFileSync(new URL(file, flowsDir), 'utf8'));
    } catch {
      writeSync(2, `Failed to read flow fixture: ${file}\n`);
      return 1;
    }

    const simRender = (_screen: string) => new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    try {
      const res = await runFlow(flow, { gatewayUrl: gateway, simRender });
      if (res.ok) {
        writeSync(1, `PASS: ${flowName} (${res.steps} steps)\n`);
      } else {
        allOk = false;
        writeSync(
          2,
          `FAIL: ${flowName} at step ${res.firstDivergence?.index}: expected ${JSON.stringify(res.firstDivergence?.expected)}, got ${JSON.stringify(res.firstDivergence?.got)}\n`,
        );
      }
    } catch (err) {
      allOk = false;
      writeSync(2, `ERROR: ${flowName}: ${err}\n`);
    }
  }

  return allOk ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
