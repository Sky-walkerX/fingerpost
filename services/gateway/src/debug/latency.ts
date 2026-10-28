import type { FastifyInstance } from 'fastify';
import type { ModelPort } from '../models/port.ts';
import { timingSafeEqual } from 'node:crypto';
import { LIMITS } from '@fingerpost/protocol';
import { jpegSize } from './jpeg.ts';
import { LatencyMetrics } from './latency-metrics.ts';

/**
 * POST /v1/debug/latency (only when DEBUG_TOKEN is set; header x-debug-token must match).
 * Body: raw JPEG (≤ 400 KB). Times one Spark parse and one SAM box call from this region (ADR 0003).
 */
export function registerLatencyRoute(app: FastifyInstance, models: ModelPort, debugToken: string): void {
  app.addContentTypeParser('image/jpeg', { parseAs: 'buffer', bodyLimit: LIMITS.keyframeBytes }, (_req, body, done) => done(null, body));
  app.post('/v1/debug/latency', async (req, reply) => {
    const supplied = req.headers['x-debug-token'];
    const expected = Buffer.from(debugToken);
    const received = typeof supplied === 'string' ? Buffer.from(supplied) : Buffer.alloc(0);
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return reply.code(404).send();
    const jpeg = new Uint8Array(req.body as Buffer);
    try {
      const size = jpegSize(jpeg);
      if (size.width !== 1024 || size.height !== 576) return reply.code(400).send({ error: 'invalid_sample' });
    } catch { return reply.code(400).send({ error: 'invalid_sample' }); }
    try {
      const t0 = performance.now();
      const parsed = await models.parseScreen({ bytes: jpeg, mime: 'image/jpeg' }, { locale: 'en' });
      const sparkMs = Math.round(performance.now() - t0);
      const t1 = performance.now();
      await models.segmentByBox({ bytes: jpeg, width: 1024, height: 576 }, { left: 400, top: 300, right: 600, bottom: 400 });
      const samMs = Math.round(performance.now() - t1);
      return LatencyMetrics.parse({ sparkMs, samMs, elements: parsed.layout.elements.length, inputTokens: parsed.usage.inputTokens });
    } catch {
      // Never let model response content reach Fastify's default error logging/response.
      return reply.code(503).send({ error: 'model_unavailable' });
    }
  });
}
