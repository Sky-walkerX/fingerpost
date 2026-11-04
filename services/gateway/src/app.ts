import type { TelemetryCollector } from './telemetry/collector.ts';
import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { ulid } from 'ulid';
import { decodeFrame, LIMITS, parseClientMessage, PROTOCOL } from '@fingerpost/protocol';
import { privateAvailable, type Config } from './config.ts';
import { registerLatencyRoute } from './debug/latency.ts';
import { createMetaClient } from './models/meta-client.ts';
import { rulesPlanner, sparkPlanner, type Planner } from './agent/planner.ts';
import { createRouter } from './models/router.ts';
import { createGlimmerClient, glimmerModels } from './parse/glimmer-parse.ts';
import { MemoryDonationStore, registerDonateRoute, type DonationStore } from './donate/donation.ts';
import { randomBytes } from 'node:crypto';
import { MemoryService } from './memory/service.ts';
import { InMemoryStore, type MemoryStore } from './memory/store.ts';
import { liveModels, type ModelPort } from './models/port.ts';
import { mockModels } from './models/mock/mock-models.ts';
import { createSessionController, type AsrFactory } from './session/controller.ts';
import { MODEL_TURN_TIMEOUT_MS, MODEL_WAIT_MS } from './session/model-budget.ts';
import { openAsrRelay } from './asr/relay.ts';
import { mockAsr } from './models/mock/mock-asr.ts';
import { SimEventBody, SimRegistry } from './sim/registry.ts';
import { safeEqual } from './util/safe-equal.ts';
import { probeAsrConnection, type AsrTimings } from './debug/asr-probe.ts';
import { registerRegionRoutes } from './debug/region.ts';
import { ChallengeStore } from './auth/challenges.ts';
import { registerAuthRoutes, type AuthDeps } from './auth/routes.ts';
import { verifySessionGrant } from './auth/tokens.ts';
import { loadGoogleRoots } from './auth/google-roots.ts';
import { MemoryFlagStore, MemoryQuotaStore, type FlagStore, type QuotaStore } from './quota/ports.ts';
import { DEFAULT_QUOTA, QuotaService } from './quota/service.ts';
import { MemoryWaitlistStore, type WaitlistStore } from './waitlist/store.ts';
import { registerWaitlistRoute } from './waitlist/routes.ts';
import { CachedMinVersionSource, MemoryMinVersionSource, type MinVersionSource } from './min-version/source.ts';
import { registerConfigRoute } from './min-version/routes.ts';
import { TransportCounters } from './debug/transport-counters.ts';

export interface AppOverrides {
  telemetry?: TelemetryCollector;
  /** Local phone practice announces simulated targets; ignored entirely in live mode. */
  mockNotice?: string;
  models?: ModelPort; planner?: Planner; /** B4-3: Glimmer on Modal (private mode). */ glimmer?: ModelPort;
  /** C5-4: live builds a GCS store in server.ts when DONATE_BUCKET is set; null = donations unavailable. */
  donations?: DonationStore | null;
  /** B5-3: tests replace the 200–600 ms retry wait. */ routerSleep?: (ms: number) => Promise<void>;
  /** B5-2: tests inject a seeded service; live builds a Firestore store in server.ts. */ memory?: MemoryService; memoryStore?: MemoryStore; asrProbe?: () => Promise<AsrTimings>; asr?: AsrFactory; sims?: SimRegistry;
  /** Day 3. Tests inject memory stores and fake auth; live builds Firestore + firebase-admin in server.ts. */
  quotaStore?: QuotaStore; flagStore?: FlagStore; auth?: Partial<AuthDeps>; now?: () => number;
  /** Live: Google's attestation status list (auth/revocation.ts). */
  isRevoked?: (serialHex: string) => boolean;
  /** B6-2: waitlist store. In-memory for mock/tests, Firestore in server.ts. */
  waitlistStore?: WaitlistStore;
  /** B6-2: min-version source. In-memory default "0.1.0" for mock/tests, Remote Config in server.ts. */
  minVersionSource?: MinVersionSource;
  /** Bound only by the local mock phone gateway; records counters, never transport contents. */
  transportCounters?: TransportCounters;
}

export async function buildApp(cfg: Config, o: AppOverrides = {}): Promise<FastifyInstance> {
  // Trust exactly one proxy hop: Cloud Run's front end appends the real client IP to X-Forwarded-For.
  const app = Fastify({ trustProxy: (_address: string, hop: number) => hop === 0, logger: { level: cfg.LOG_LEVEL, redact: ['req.headers.authorization', 'req.headers["x-debug-token"]', 'req.headers["x-sim-token"]'] }, bodyLimit: 64 * 1024 });
  await app.register(websocket, { options: { maxPayload: 512 * 1024 } });

  const live = cfg.MODEL_MODE === 'live';
  const client = live ? createMetaClient(cfg.META_API_KEY!, cfg.MODEL_TIMEOUT_MS) : null;
  const parseReasoning = cfg.SPARK_PARSE_REASONING === 'default' ? {} : { parseReasoning: cfg.SPARK_PARSE_REASONING };
  const models = o.models ?? (client ? liveModels(client, { ...parseReasoning, visionModel: cfg.VISION_MODEL }) : mockModels());
  // Glimmer is a paid GPU: only live mode calls it. Mock/dev private sessions use an injected port or are refused.
  const glimmer = o.glimmer ?? (live && privateAvailable(cfg) ? glimmerModels(createGlimmerClient(cfg), cfg.GLIMMER_MODEL!) : undefined);
  const router = createRouter({ meta: models, glimmer, ...(o.routerSleep ? { sleep: o.routerSleep } : {}) });
  const memory = o.memory ?? new MemoryService(o.memoryStore ?? new InMemoryStore(),
    { salt: cfg.MEMORY_SALT ?? randomBytes(16).toString('hex'), minInstalls: cfg.MEMORY_MIN_INSTALLS });
  const planner = o.planner ?? (client && (cfg.AGENT_PLANNER ?? 'spark') === 'spark' ? sparkPlanner(client) : rulesPlanner());
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
      policy: o.auth?.policy ?? { trustedRoots: loadGoogleRoots(), packageName: 'io.github.fingerpost', signatureDigests: cfg.SIGNING_DIGESTS!.split(','), allowSoftware: cfg.ALLOW_SOFTWARE_ATTESTATION,
        ...(o.isRevoked ? { isRevoked: o.isRevoked } : {}) },
      secret: secret!, now,
    });
  }

  // Mock/dev keeps donations in memory (no bytes leave the machine); live needs a configured bucket.
  registerDonateRoute(app, { store: o.donations !== undefined ? o.donations : (live ? null : new MemoryDonationStore()),
    authSecret: cfg.AUTH_REQUIRED ? secret : null, cloudEnabled: () => quota.cloudEnabled(), now });

  // B6-2: waitlist and config endpoints
  const waitlistStore = o.waitlistStore ?? new MemoryWaitlistStore();
  registerWaitlistRoute(app, { store: waitlistStore, now });

  const rawMinVersion = o.minVersionSource ?? new MemoryMinVersionSource('0.1.0');
  const minVersionSource = new CachedMinVersionSource(rawMinVersion, 30_000, now);
  registerConfigRoute(app, { minVersionSource, cloudEnabled: () => quota.cloudEnabled() });

  app.get('/healthz', async () => ({ status: 'ok', version: cfg.GIT_SHA, protocol: PROTOCOL }));
  if (o.transportCounters) app.get('/v1/debug/transport-counters', async () => o.transportCounters!.snapshot());
  if (cfg.DEBUG_TOKEN) {
    registerLatencyRoute(app, models, cfg.DEBUG_TOKEN);
    registerRegionRoutes(app, cfg, models, o.asrProbe ?? (live
      ? () => probeAsrConnection(cfg.META_API_KEY!) : async () => ({ connectMs: 0, readyMs: 0 })));
  }

  // Simulator touches: open in mock/dev; in live mode only when SIM_TOKEN is set (fail closed).
  if (!live || cfg.SIM_TOKEN) {
    // The tablet page and gateway use different origins. This stateless route uses an explicit token,
    // never browser cookies; keep its CORS permission separate from auth/debug/session endpoints.
    app.options('/v1/sim/events', async (_req, reply) => reply
      .header('access-control-allow-origin', '*').header('access-control-allow-methods', 'POST')
      .header('access-control-allow-headers', 'content-type, x-sim-token').code(204).send());
    app.post('/v1/sim/events', async (req, reply) => {
      reply.header('access-control-allow-origin', '*');
      const got = req.headers['x-sim-token'];
      if (cfg.SIM_TOKEN && !safeEqual(typeof got === 'string' ? got : undefined, cfg.SIM_TOKEN)) return reply.code(401).send({ error: 'bad sim token' });
      const body = SimEventBody.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'invalid sim event' });
      return { delivered: sims.publish(body.data) };
    });
  }

  app.get('/v1/session', { websocket: true }, (socket, req) => {
    // Listen synchronously: the client may send hello before the async auth check finishes.
    const early: Array<[Buffer, boolean]> = [];
    let handle: ((data: Buffer, isBinary: boolean) => void) | null = null;
    let dispose: (() => void) | null = null, closed = false;
    let expiresAtMs: number | null = null, timer: ReturnType<typeof setTimeout> | undefined;
    let releaseHandshake = () => {};
    const stop = () => {
      closed = true;
      clearTimeout(timer);
      early.length = 0;
      releaseHandshake();
      dispose?.();
    };
    const expire = () => {
      if (closed) return;
      stop();
      socket.close(4401, 'auth expired');
    };
    const expired = () => {
      if (!closed && expiresAtMs !== null && now() >= expiresAtMs) expire();
      return closed;
    };
    socket.on('message', (data: Buffer, isBinary: boolean) => {
      if (!expired()) { if (handle) handle(data, isBinary); else early.push([data, isBinary]); }
    });
    socket.on('close', stop);
    void (async () => {
      let claims;
      if (cfg.AUTH_REQUIRED) {
        const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];
        const grant = token ? await verifySessionGrant(secret!, token, now()) : null;
        if (!grant) { stop(); socket.close(4401, 'auth required'); return; }
        claims = grant.claims;
        expiresAtMs = grant.expiresAtMs;
        if (expired()) return;
        timer = setTimeout(expire, Math.max(0, expiresAtMs - now()));
        timer.unref();
      }
      if (closed) return;
      let ready = false, helloQueued = false;
      let markReady!: () => void;
      const handshake = new Promise<void>((resolve) => { markReady = resolve; });
      releaseHandshake = markReady;
      const session = createSessionController({ send: (m) => {
        if (expired()) return;
        if (m.type === 'ready') { ready = true; markReady(); }
        if (m.type === 'error' && m.code === 'version_unsupported') markReady();
        socket.send(JSON.stringify(m));
        if (m.type === 'ready' && !live && o.mockNotice) socket.send(JSON.stringify({
          type: 'say', id: ulid(), ts: now(), priority: 'safety', text: o.mockNotice,
        }));
      }, models, asr, sims, now, quota, minimumVersion: () => minVersionSource.getMinVersion(), ...(claims ? { claims } : {}),
        ...(live ? { turnTimeoutMs: MODEL_TURN_TIMEOUT_MS, modelWaitMs: MODEL_WAIT_MS } : {}),
        ...(live && cfg.MONITORING_ENABLED && o.telemetry ? { telemetry: o.telemetry } : {}),
        planner, router, memory, ...(o.transportCounters ? { onInbound: (message) => o.transportCounters!.record(message) } : {}),
        onPlannerError: (id) => req.log.warn({ planner: id }, 'planner failed; rules planner used for this step') });
      dispose = session.dispose;
      const { hub } = session;
      // Ordinary messages stay ordered; a validated abort cancels the in-flight task and its backlog.
      let queue: Promise<void> = Promise.resolve();
      let generation = 0;
      let inputTurn = 0;
      const pendingCaptures = new Set<string>();
      handle = (data, isBinary) => {
        if (expired()) return;
        req.log.debug({ sessionId: hub.id, bytes: data.length, binary: isBinary }, 'ws message');
        let isHello = false;
        if (!isBinary && data.length <= LIMITS.textBytes) {
          let json: unknown;
          try { json = JSON.parse(data.toString('utf8')); } catch { /* The hub reports malformed messages. */ }
          const parsed = parseClientMessage(json);
          if (parsed.ok && parsed.msg.type === 'hello') { isHello = true; helloQueued = true; }
          if (parsed.ok && ['goal', 'answer', 'confirm.reply', 'audio.end'].includes(parsed.msg.type)) inputTurn++;
          const interrupts = parsed.ok && (parsed.msg.type === 'abort' ||
            (parsed.msg.type === 'event' && parsed.msg.kind === 'pinModeEntered'));
          if (interrupts && (ready || helloQueued)) {
            generation++;
            const abortedIn = generation;
            // Cancellation/PIN entry waits for hello, never for queued model work.
            queue = (ready ? Promise.resolve() : handshake).then(() => {
              if (expired() || abortedIn !== generation) return;
              return hub.onText(data.toString('utf8'));
            });
            return;
          }
        }
        let captureKey: string | undefined;
        if (isBinary && (ready || helloQueued)) {
          const frame = decodeFrame(new Uint8Array(data));
          const parsed = frame.ok ? parseClientMessage(frame.header) : null;
          if (frame.ok && parsed?.ok && parsed.msg.type === 'keyframe' && parsed.msg.purpose !== 'verify'
              && frame.payload.length <= LIMITS.keyframeBytes) {
            captureKey = `${generation}:${inputTurn}:${parsed.msg.purpose}`;
            // A retry received while this turn is still running must not become another paid parse later.
            if (pendingCaptures.has(captureKey)) return;
            pendingCaptures.add(captureKey);
          }
        }
        const receivedIn = generation;
        queue = queue.then(() => {
          if (expired() || (receivedIn !== generation && !(isHello && !ready))) return;
          return isBinary ? hub.onBinary(new Uint8Array(data)) : hub.onText(data.toString('utf8'));
        }).finally(() => { if (captureKey !== undefined) pendingCaptures.delete(captureKey); });
      };
      for (const [d, b] of early.splice(0)) handle(d, b);
    })();
  });
  return app;
}
