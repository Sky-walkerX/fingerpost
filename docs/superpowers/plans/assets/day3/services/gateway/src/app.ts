import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { PROTOCOL } from '@fingerpost/protocol';
import type { Config } from './config.ts';
import { openAsrRelay } from './asr/relay.ts';
import { createMetaClient } from './models/meta-client.ts';
import { liveModels, type ModelPort } from './models/port.ts';
import { mockModels } from './models/mock/mock-models.ts';
import { mockAsr } from './models/mock/mock-asr.ts';
import { createSessionController, type AsrFactory } from './session/controller.ts';
import { SimEventBody, SimRegistry } from './sim/registry.ts';
import { safeEqual } from './util/safe-equal.ts';
import { ChallengeStore } from './auth/challenges.ts';
import { registerAuthRoutes, type AuthDeps } from './auth/routes.ts';
import { verifySessionToken } from './auth/tokens.ts';
import { loadGoogleRoots } from './auth/google-roots.ts';
import { MemoryFlagStore, MemoryQuotaStore, type FlagStore, type QuotaStore } from './quota/ports.ts';
import { DEFAULT_QUOTA, QuotaService } from './quota/service.ts';
import { registerLatencyRoute } from './debug/latency.ts';

export interface AppOverrides {
  models?: ModelPort; asr?: AsrFactory; sims?: SimRegistry;
  /** Day 3. Tests inject memory stores and fake auth; live builds Firestore + firebase-admin in server.ts. */
  quotaStore?: QuotaStore; flagStore?: FlagStore; auth?: Partial<AuthDeps>; now?: () => number;
}

export async function buildApp(cfg: Config, o: AppOverrides = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: cfg.LOG_LEVEL, redact: ['req.headers.authorization', 'req.headers["x-sim-token"]'] }, bodyLimit: 64 * 1024 });
  await app.register(websocket, { options: { maxPayload: 512 * 1024 } });

  const live = cfg.MODEL_MODE === 'live';
  const models = o.models ?? (live ? liveModels(createMetaClient(cfg.META_API_KEY!)) : mockModels());
  const asr: AsrFactory = o.asr ?? (live ? (opts, sink) => openAsrRelay({ ...opts, apiKey: cfg.META_API_KEY! }, sink) : mockAsr());
  const sims = o.sims ?? new SimRegistry();
  const now = o.now ?? Date.now;
  const quota = new QuotaService(o.quotaStore ?? new MemoryQuotaStore(), o.flagStore ?? new MemoryFlagStore(),
    { ...DEFAULT_QUOTA, dailyCapMicros: Math.round(cfg.DAILY_CAP_USD * 1e6) }, now);
  const secret = cfg.SESSION_SECRET ? new TextEncoder().encode(cfg.SESSION_SECRET) : null;
  if (cfg.AUTH_REQUIRED) {
    registerAuthRoutes(app, {
      challenges: o.auth?.challenges ?? new ChallengeStore(now),
      verifyFirebaseIdToken: o.auth?.verifyFirebaseIdToken ?? (async () => null),
      policy: o.auth?.policy ?? { trustedRoots: loadGoogleRoots(), packageName: 'io.github.fingerpost', signatureDigests: cfg.SIGNING_DIGESTS!.split(','), allowSoftware: cfg.ALLOW_SOFTWARE_ATTESTATION },
      secret: secret!, now,
    });
  }

  app.get('/healthz', async () => ({ status: 'ok', version: cfg.GIT_SHA, protocol: PROTOCOL }));
  if (cfg.DEBUG_TOKEN) registerLatencyRoute(app, models, cfg.DEBUG_TOKEN);

  // Simulator touches: open in mock/dev; in live mode only when SIM_TOKEN is set (fail closed).
  if (!live || cfg.SIM_TOKEN) app.post('/v1/sim/events', async (req, reply) => {
    const got = req.headers['x-sim-token'];
    if (cfg.SIM_TOKEN && !safeEqual(typeof got === 'string' ? got : undefined, cfg.SIM_TOKEN)) return reply.code(401).send({ error: 'bad sim token' });
    const body = SimEventBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid sim event' });
    return { delivered: sims.publish(body.data) };
  });

  app.get('/v1/session', { websocket: true }, (socket, req) => {
    // Listen synchronously: the client may send hello before the async auth check finishes.
    const early: Array<[Buffer, boolean]> = [];
    let handle: ((data: Buffer, isBinary: boolean) => void) | null = null;
    socket.on('message', (data: Buffer, isBinary: boolean) => (handle ? handle(data, isBinary) : early.push([data, isBinary])));
    void (async () => {
      let claims;
      if (cfg.AUTH_REQUIRED) {
        const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];
        claims = token ? await verifySessionToken(secret!, token, now()) : null;
        if (!claims) { socket.close(4401, 'auth required'); return; }
      }
      const { hub, dispose } = createSessionController({ send: (m) => socket.send(JSON.stringify(m)), models, asr, sims, now, quota, ...(claims ? { claims } : {}) });
      // One message at a time per session, in arrival order (a verify must never overtake its locate).
      let queue: Promise<void> = Promise.resolve();
      handle = (data, isBinary) => {
        req.log.debug({ sessionId: hub.id, bytes: data.length, binary: isBinary }, 'ws message');
        queue = queue.then(() => (isBinary ? hub.onBinary(new Uint8Array(data)) : hub.onText(data.toString('utf8'))));
      };
      for (const [d, b] of early.splice(0)) handle(d, b);
      socket.on('close', dispose);
    })();
  });
  return app;
}
