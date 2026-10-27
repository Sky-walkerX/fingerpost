import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { PROTOCOL } from '@fingerpost/protocol';
import type { Config } from './config.ts';
import { registerLatencyRoute } from './debug/latency.ts';
import { createMetaClient } from './models/meta-client.ts';
import { liveModels, type ModelPort } from './models/port.ts';
import { mockModels } from './models/mock/mock-models.ts';
import { SessionHub } from './session/hub.ts';

export interface AppOverrides { models?: ModelPort; }

export async function buildApp(cfg: Config, o: AppOverrides = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: cfg.LOG_LEVEL, redact: ['req.headers.authorization'] }, bodyLimit: 64 * 1024 });
  await app.register(websocket, { options: { maxPayload: 512 * 1024 } });
  const models = o.models ?? (cfg.MODEL_MODE === 'live' ? liveModels(createMetaClient(cfg.META_API_KEY!)) : mockModels());

  app.get('/healthz', async () => ({ status: 'ok', version: cfg.GIT_SHA, protocol: PROTOCOL }));
  if (cfg.DEBUG_TOKEN) registerLatencyRoute(app, models, cfg.DEBUG_TOKEN);

  app.get('/v1/session', { websocket: true }, (socket, req) => {
    const hub = new SessionHub({ send: (m) => socket.send(JSON.stringify(m)) });
    // One message at a time per session, in arrival order.
    let queue: Promise<void> = Promise.resolve();
    socket.on('message', (data: Buffer, isBinary: boolean) => {
      req.log.debug({ sessionId: hub.id, bytes: data.length, binary: isBinary }, 'ws message');
      queue = queue.then(() => (isBinary ? hub.onBinary(new Uint8Array(data)) : hub.onText(data.toString('utf8'))));
    });
  });
  return app;
}
