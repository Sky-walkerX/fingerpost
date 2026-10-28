import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { PROTOCOL } from '@fingerpost/protocol';
import type { Config } from './config.ts';
import { registerLatencyRoute } from './debug/latency.ts';
import { createMetaClient } from './models/meta-client.ts';
import { liveModels, type ModelPort } from './models/port.ts';
import { mockModels } from './models/mock/mock-models.ts';
import { createSessionController, type AsrFactory } from './session/controller.ts';
import { openAsrRelay } from './asr/relay.ts';
import { mockAsr } from './models/mock/mock-asr.ts';
import { SimEventBody, SimRegistry } from './sim/registry.ts';
import { safeEqual } from './util/safe-equal.ts';
import { probeAsrConnection, type AsrTimings } from './debug/asr-probe.ts';
import { registerRegionRoutes } from './debug/region.ts';

export interface AppOverrides { models?: ModelPort; asrProbe?: () => Promise<AsrTimings>; asr?: AsrFactory; sims?: SimRegistry; }

export async function buildApp(cfg: Config, o: AppOverrides = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: cfg.LOG_LEVEL, redact: ['req.headers.authorization', 'req.headers["x-debug-token"]', 'req.headers["x-sim-token"]'] }, bodyLimit: 64 * 1024 });
  await app.register(websocket, { options: { maxPayload: 512 * 1024 } });
  const models = o.models ?? (cfg.MODEL_MODE === 'live' ? liveModels(createMetaClient(cfg.META_API_KEY!)) : mockModels());
  const live = cfg.MODEL_MODE === 'live';
  const asr: AsrFactory = o.asr ?? (live ? (opts, sink) => openAsrRelay({ ...opts, apiKey: cfg.META_API_KEY! }, sink) : mockAsr());
  const sims = o.sims ?? new SimRegistry();

  app.get('/healthz', async () => ({ status: 'ok', version: cfg.GIT_SHA, protocol: PROTOCOL }));
  if (cfg.DEBUG_TOKEN) {
    registerLatencyRoute(app, models, cfg.DEBUG_TOKEN);
    registerRegionRoutes(app, cfg, models, o.asrProbe ?? (cfg.MODEL_MODE === 'live'
      ? () => probeAsrConnection(cfg.META_API_KEY!) : async () => ({ connectMs: 0, readyMs: 0 })));
  }

  if (!live || cfg.SIM_TOKEN) app.post('/v1/sim/events', async (req, reply) => {
    const got = req.headers['x-sim-token'];
    if (cfg.SIM_TOKEN && !safeEqual(typeof got === 'string' ? got : undefined, cfg.SIM_TOKEN)) return reply.code(401).send({ error: 'bad sim token' });
    const body = SimEventBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid sim event' });
    return { delivered: sims.publish(body.data) };
  });

  app.get('/v1/session', { websocket: true }, (socket, req) => {
    const { hub, dispose } = createSessionController({ send: (m) => socket.send(JSON.stringify(m)), models, asr, sims });
    // One message at a time per session, in arrival order.
    let queue: Promise<void> = Promise.resolve();
    socket.on('message', (data: Buffer, isBinary: boolean) => {
      req.log.debug({ sessionId: hub.id, bytes: data.length, binary: isBinary }, 'ws message');
      queue = queue.then(() => (isBinary ? hub.onBinary(new Uint8Array(data)) : hub.onText(data.toString('utf8'))));
    });
    socket.on('close', dispose);
  });
  return app;
}
