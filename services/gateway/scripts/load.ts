import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { isAbsolute, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import type { LayoutElement } from '@fingerpost/protocol';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { mockModels } from '../src/models/mock/mock-models.ts';
import type { ParsedLayout } from '../src/parse/spark-parse.ts';
// Load runner dynamically or via path to avoid TS6059 rootDir restriction
interface FlowStep {
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

interface RunFlowOptions {
  gatewayUrl: string;
  simRender: (screen: string) => Uint8Array;
  timeoutMs?: number;
}

interface FlowResult {
  ok: boolean;
  steps: number;
  firstDivergence?: { index: number; expected: unknown; got: unknown };
}

type RunFlowFn = (flow: Flow, o: RunFlowOptions) => Promise<FlowResult>;

export interface LoadOptions {
  sessions?: number;
  seconds?: number;
  out?: string;
  flowName?: string;
}

export interface LoadResult {
  sessions: number;
  durationSeconds: number;
  messageCount: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  errors: number;
  pass: boolean;
  date: string;
  machine: string;
}

export function formatReport(result: LoadResult): string {
  return [
    '# 50-session load test',
    '',
    `- date: ${result.date}`,
    `- machine: ${result.machine}`,
    `- result: ${result.pass ? 'pass' : 'fail'}`,
    '',
    '| Metric | Value |',
    '|---|---|',
    `| Sessions | ${result.sessions} |`,
    `| Duration | ${result.durationSeconds} s |`,
    `| Message count | ${result.messageCount} |`,
    `| Latency p50 | ${result.p50Ms.toFixed(1)} ms |`,
    `| Latency p95 | ${result.p95Ms.toFixed(1)} ms |`,
    `| Latency max | ${result.maxMs.toFixed(1)} ms |`,
    `| Errors | ${result.errors} |`,
    `| Status | ${result.pass ? 'pass' : 'fail'} |`,
    '',
  ].join('\n');
}

export async function runLoadTest(options: LoadOptions = {}): Promise<LoadResult> {
  const sessions = options.sessions ?? 50;
  const seconds = options.seconds ?? 300;
  const flowName = options.flowName ?? 'guide-start';
  const out = options.out ?? 'docs/evals/load-day5.md';

  const flowsDir = new URL('../../../packages/protocol/fixtures/flows/', import.meta.url);
  const flowPath = new URL(`${flowName}.json`, flowsDir);
  const baseFlow: Flow = JSON.parse(readFileSync(flowPath, 'utf8'));

  const layouts = new Map<string, ParsedLayout>();
  for (const step of baseFlow.steps) {
    if (step.from === 'server' && step.msg.type === 'layout' && step.screen && !layouts.has(step.screen)) {
      const m = step.msg as {
        screenType: ParsedLayout['screenType'];
        sensitivity: ParsedLayout['sensitivity'];
        language: string;
        rotation: ParsedLayout['rotation'];
        elements: LayoutElement[];
      };
      layouts.set(step.screen, {
        screenType: m.screenType,
        sensitivity: m.sensitivity,
        language: m.language,
        rotation: m.rotation,
        elements: m.elements,
      });
    }
  }

  const models = mockModels();
  models.parseScreen = async (img) => {
    const screen = new TextDecoder().decode(img.bytes.subarray(4));
    const layout = layouts.get(screen) ?? layouts.get('home') ?? Array.from(layouts.values())[0]!;
    return { layout, usage: { inputTokens: 0, outputTokens: 0 }, latencyMs: 0, promptId: 'flow' };
  };

  const flowRunnerModule = new URL('../../../evals/src/flow-runner.ts', import.meta.url).href;
  const { runFlow } = (await import(flowRunnerModule)) as { runFlow: RunFlowFn };

  const app = await buildApp(
    loadConfig({
      LOG_LEVEL: 'silent',
      DAILY_CAP_USD: '1000000000',
    }),
    { models },
  );

  await app.listen({ port: 0, host: '127.0.0.1' });
  const addr = app.server.address() as AddressInfo;
  const gatewayUrl = `http://127.0.0.1:${addr.port}`;

  const simRender = (screen: string): Uint8Array => {
    const enc = new TextEncoder().encode(screen);
    const bytes = new Uint8Array(4 + enc.length);
    bytes[0] = 0xff;
    bytes[1] = 0xd8;
    bytes[2] = 0xff;
    bytes[3] = 0xd9;
    bytes.set(enc, 4);
    return bytes;
  };

  const latencies: number[] = [];
  let errors = 0;

  const OriginalWebSocket = globalThis.WebSocket;

  class InstrumentedWebSocket extends OriginalWebSocket {
    private _pendingSendTime: number | null = null;

    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols);

      this.addEventListener('message', (event: MessageEvent) => {
        const now = performance.now();
        try {
          const text = typeof event.data === 'string'
            ? event.data
            : Buffer.isBuffer(event.data)
            ? event.data.toString('utf8')
            : new TextDecoder().decode(event.data as ArrayBuffer);
          const msg = JSON.parse(text) as { type?: string };
          if (msg.type === 'error') {
            errors++;
          }
          if (msg.type !== 'say' && msg.type !== 'transcript' && this._pendingSendTime !== null) {
            latencies.push(now - this._pendingSendTime);
            this._pendingSendTime = null;
          }
        } catch {
          // Ignore unparseable frames
        }
      });
    }

    override send(data: Parameters<WebSocket['send']>[0]): void {
      const now = performance.now();
      try {
        this._pendingSendTime = now;
      } catch {
        // Ignore send errors
      }
      super.send(data);
    }
  }

  function makeFlowForSession(sessionId: number, seq: number): Flow {
    const flow: Flow = JSON.parse(JSON.stringify(baseFlow));
    const runId = `run-${sessionId}-${seq}`;
    for (const step of flow.steps) {
      if ((step.msg as Record<string, unknown>).caps && typeof (step.msg as Record<string, unknown>).caps === 'object') {
        const caps = (step.msg as Record<string, unknown>).caps as Record<string, unknown>;
        if (caps.simRunId) caps.simRunId = runId;
      }
      if ((step.msg as Record<string, unknown>).runId) {
        (step.msg as Record<string, unknown>).runId = runId;
      }
    }
    return flow;
  }

  const stopTime = Date.now() + seconds * 1000;

  try {
    globalThis.WebSocket = InstrumentedWebSocket as unknown as typeof WebSocket;

    const worker = async (sessionId: number): Promise<void> => {
      let seq = 0;
      while (Date.now() < stopTime) {
        try {
          const flow = makeFlowForSession(sessionId, seq++);
          const res = await runFlow(flow, { gatewayUrl, simRender, timeoutMs: 5000 });
          if (!res.ok) errors++;
          await new Promise((r) => setTimeout(r, 50));
        } catch {
          errors++;
        }
      }
    };

    await Promise.all(Array.from({ length: sessions }, (_, i) => worker(i)));
  } finally {
    globalThis.WebSocket = OriginalWebSocket;
    await app.close();
  }

  latencies.sort((a, b) => a - b);
  const p50Ms = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.50)]! : 0;
  const p95Ms = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)]! : 0;
  const maxMs = latencies.length > 0 ? latencies[latencies.length - 1]! : 0;

  const pass = errors === 0 && p95Ms < 200;
  const date = new Date().toISOString();
  const machine = `${process.platform}-${process.arch}`;

  const result: LoadResult = {
    sessions,
    durationSeconds: seconds,
    messageCount: latencies.length,
    p50Ms,
    p95Ms,
    maxMs,
    errors,
    pass,
    date,
    machine,
  };

  const report = formatReport(result);
  const repoRoot = new URL('../../../', import.meta.url);
  const outPath = isAbsolute(out) ? out : fileURLToPath(new URL(out, repoRoot));
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, report, 'utf8');

  return result;
}

export async function main(args = process.argv.slice(2)): Promise<number> {
  const { values } = parseArgs({
    args: args.filter((a) => a !== '--'),
    options: {
      sessions: { type: 'string', default: '50' },
      seconds: { type: 'string', default: '300' },
      out: { type: 'string', default: 'docs/evals/load-day5.md' },
      flow: { type: 'string', default: 'guide-start' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: false,
  });

  if (values.help) {
    console.log('usage: node --conditions=source scripts/load.ts [--sessions <n>] [--seconds <s>] [--out <path>]');
    return 0;
  }

  const sessions = parseInt(String(values.sessions ?? 50), 10);
  const seconds = parseInt(String(values.seconds ?? 300), 10);
  const out = String(values.out ?? 'docs/evals/load-day5.md');
  const flowName = String(values.flow ?? 'guide-start');

  console.log(`Starting load test: ${sessions} sessions for ${seconds}s (flow: ${flowName})...`);
  const result = await runLoadTest({ sessions, seconds, out, flowName });

  console.log(`Finished: ${result.messageCount} messages, p50: ${result.p50Ms.toFixed(1)} ms, p95: ${result.p95Ms.toFixed(1)} ms, max: ${result.maxMs.toFixed(1)} ms, errors: ${result.errors}`);
  console.log(`Result: ${result.pass ? 'PASS' : 'FAIL'} (report written to ${out})`);

  return result.pass ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
