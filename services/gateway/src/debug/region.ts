import type { FastifyInstance } from 'fastify';
import type { Config } from '../config.ts';
import type { ModelPort } from '../models/port.ts';
import type { AsrTimings } from './asr-probe.ts';
import { timingSafeEqual, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Layout, LIMITS, Target } from '@fingerpost/protocol';
import { SessionHub } from '../session/hub.ts';
import { normalizeLabel } from '../parse/spark-parse.ts';
import { jpegSize } from './jpeg.ts';
import { AsrMetrics, BenchmarkEnvelope, TargetTimings } from './region-metrics.ts';

function authorized(supplied: unknown, expected: string): boolean {
  const received = typeof supplied === 'string' ? Buffer.from(supplied) : Buffer.alloc(0);
  const secret = Buffer.from(expected);
  return received.length === secret.length && timingSafeEqual(received, secret);
}

export function registerRegionRoutes(
  app: FastifyInstance, cfg: Config, models: ModelPort, probe: () => Promise<AsrTimings>,
): void {
  const token = cfg.DEBUG_TOKEN;
  if (!token) return;
  app.post('/v1/debug/asr-connect', async (req, reply) => {
    if (!authorized(req.headers['x-debug-token'], token)) return reply.code(404).send();
    try { return AsrMetrics.parse({ mode: cfg.MODEL_MODE, ...await probe() }); }
    catch { return reply.code(503).send({ error: 'measurement_failed' }); }
  });

  app.get('/v1/debug/region-target', { websocket: true }, (socket) => {
    let authenticated = false, closed = false, goal: string | null = null, used = false;
    let framesReceived = 0;
    let helloed = false;
    const timer = setTimeout(() => socket.close(1008), 60_000);
    socket.on('close', () => { closed = true; clearTimeout(timer); });
    socket.on('error', () => { closed = true; clearTimeout(timer); });
    const send = (message: unknown, timings?: unknown) => {
      if (!closed) socket.send(JSON.stringify(BenchmarkEnvelope.parse({ message, ...(timings ? { timings } : {}) })));
    };
    const base = () => ({ id: randomUUID(), ts: Date.now() });
    const hub = new SessionHub({ send: (message) => send(message), handlers: {
      onHello: (message) => {
        if (helloed || message.locale !== 'en' || message.privacy !== 'normal' || message.mode !== 'guide')
          throw new Error('Invalid benchmark session');
        helloed = true;
      },
      onMessage: async (message, bytes) => {
        if (message.type === 'goal' && goal === null && !used) {
          if (!normalizeLabel(message.text)) throw new Error('Invalid benchmark goal');
          goal = message.text;
          send({ ...base(), type: 'goal.ack', goal, intent: 'guide' });
          return;
        }
        if (message.type !== 'keyframe' || !bytes || goal === null || used ||
            message.kind !== 'screen' || message.purpose !== 'locate') throw new Error('Invalid benchmark request');
        used = true;
        const size = jpegSize(bytes);
        if (size.width !== 1024 || size.height !== 576 || message.imageSize.w !== size.width || message.imageSize.h !== size.height)
          throw new Error('Invalid benchmark sample');
        const started = performance.now();
        const parsed = await models.parseScreen({ bytes, mime: 'image/jpeg' }, { locale: 'en', goal });
        const sparkMs = performance.now() - started;
        if (closed) return;
        const layout = Layout.parse({ ...base(), type: 'layout', fingerprint: 'benchmark', source: 'model', ...parsed.layout });
        if (layout.screenType === 'pin_pad' || layout.screenType === 'payment_entry' || layout.sensitivity !== 'none')
          throw new Error('Sensitive benchmark sample');
        // This controlled benchmark requires one exact label, not the later fuzzy task resolver.
        const matches = layout.elements.filter((element) => element.role !== 'text' &&
          [element.label, element.labelLocal, element.textNorm].some((name) => name !== undefined && normalizeLabel(name) === normalizeLabel(goal!)));
        const element = matches.length === 1 ? matches[0] : undefined;
        if (!element || !['button', 'back', 'cancel', 'icon'].includes(element.role)) throw new Error('Target unavailable');
        const xs = element.polygon.map((point) => point.u * size.width);
        const ys = element.polygon.map((point) => point.v * size.height);
        const box = { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
        if (box.left >= box.right || box.top >= box.bottom) throw new Error('Invalid target geometry');
        const samStart = performance.now();
        const segmented = await models.segmentByBox({ bytes, ...size }, box);
        const samMs = performance.now() - samStart;
        const target = Target.parse({ ...base(), type: 'target', elementId: element.id,
          polygon: segmented.polygon ?? element.polygon,
          confidence: Math.min(element.confidence, segmented.confidence ?? element.confidence), say: 'Target ready.' });
        const timings = TargetTimings.parse({ sparkMs, samMs, elements: layout.elements.length,
          inputTokens: parsed.usage.inputTokens, samRefined: segmented.polygon === null ? 0 : 1 });
        send(target, timings);
      },
    } });
    let queue: Promise<void> = Promise.resolve();
    socket.on('message', (data: Buffer, binary: boolean) => {
      // One auth, hello, goal and keyframe; do not accumulate work behind a model call.
      if (++framesReceived > 4) { closed = true; socket.close(1008); return; }
      queue = queue.then(async () => {
        if (closed) return;
        if (!authenticated) {
          if (binary || data.length > LIMITS.textBytes) { socket.close(1008); return; }
          let input: unknown;
          try { input = JSON.parse(data.toString('utf8')); } catch { socket.close(1008); return; }
          const parsed = z.strictObject({ token: z.string().min(16).max(4096) }).safeParse(input);
          if (!parsed.success || !authorized(parsed.data.token, token)) { socket.close(1008); return; }
          authenticated = true;
          socket.send(JSON.stringify({ authenticated: true, mode: cfg.MODEL_MODE }));
        } else if (binary) await hub.onBinary(new Uint8Array(data));
        else await hub.onText(data.toString('utf8'));
      }).catch(() => { if (!closed) socket.close(1011); });
    });
  });
}
