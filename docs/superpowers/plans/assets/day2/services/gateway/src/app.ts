import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { PROTOCOL } from '@fingerpost/protocol';
import type { Config } from './config.ts';
import { openAsrRelay } from './asr/relay.ts';
import { registerLatencyRoute } from './debug/latency.ts';
import { createMetaClient } from './models/meta-client.ts';
import { liveModels, type ModelPort } from './models/port.ts';
import { mockModels } from './models/mock/mock-models.ts';
import { mockAsr } from './models/mock/mock-asr.ts';
import { createSessionController, type AsrFactory } from './session/controller.ts';
import { SimEventBody, SimRegistry } from './sim/registry.ts';

export interface AppOverrides { models?: ModelPort; asr?: AsrFactory; sims?: SimRegistry; }

export async function buildApp(cfg: Config, o: AppOverrides = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: cfg.LOG_LEVEL, redact: ['req.headers.authorization', 'req.headers["x-sim-token"]'] }, bodyLimit: 64 * 1024 });
  await app.register(websocket, { options: { maxPayload: 512 * 1024 } });

  const live = cfg.MODEL_MODE === 'live';
  const models = o.models ?? (live ? liveModels(createMetaClient(cfg.META_API_KEY!)) : mockModels());
  const asr: AsrFactory = o.asr ?? (live ? (opts, sink) => openAsrRelay({ ...opts, apiKey: cfg.META_API_KEY! }, sink) : mockAsr());
  const sims = o.sims ?? new SimRegistry();

  app.get('/healthz', async () => ({ status: 'ok', version: cfg.GIT_SHA, protocol: PROTOCOL }));
  if (cfg.DEBUG_TOKEN) registerLatencyRoute(app, models, cfg.DEBUG_TOKEN);

  app.post('/v1/sim/events', async (req, reply) => {
    if (cfg.SIM_TOKEN && req.headers['x-sim-token'] !== cfg.SIM_TOKEN) return reply.code(401).send({ error: 'bad sim token' });
    const body = SimEventBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid sim event' });
    return { delivered: sims.publish(body.data) };
  });

  app.get('/v1/session', { websocket: true }, (socket, req) => {
    const { hub, dispose } = createSessionController({ send: (m) => socket.send(JSON.stringify(m)), models, asr, sims });
    // One message at a time per session, in arrival order (a verify must never overtake its locate).
    let queue: Promise<void> = Promise.resolve();
    socket.on('message', (data: Buffer, isBinary: boolean) => {
      req.log.debug({ sessionId: hub.id, bytes: data.length, binary: isBinary }, 'ws message');
      queue = queue.then(() => (isBinary ? hub.onBinary(new Uint8Array(data)) : hub.onText(data.toString('utf8'))));
    });
    socket.on('close', dispose);
  });
  return app;
}
