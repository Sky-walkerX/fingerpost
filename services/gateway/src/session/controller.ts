import { ulid } from 'ulid';
import type { ServerMessage } from '@fingerpost/protocol';
import type { AsrOptions, AsrRelay, AsrSink } from '../asr/relay.ts';
import type { ModelPort } from '../models/port.ts';
import type { Planner } from '../agent/planner.ts';
import type { RoutedModels } from '../models/router.ts';
import type { SimRegistry } from '../sim/registry.ts';
import type { QuotaPort, SessionClaims, StartResult } from './types.ts';
import { SessionHub } from './hub.ts';
import { SessionPipeline } from './pipeline.ts';
import { SPOKEN_ERRORS } from '../errors/spoken.ts';

export type AsrFactory = (o: Omit<AsrOptions, 'apiKey'>, sink: AsrSink) => AsrRelay;
export interface ControllerDeps {
  send: (m: ServerMessage) => void; models: ModelPort; asr: AsrFactory; sims: SimRegistry; now?: () => number;
  /** Day 3: present when the socket was authenticated. Without it, quotas are not applied (mock/dev). */
  claims?: SessionClaims; quota?: QuotaPort;
  /** Day 4 task planner; the pipeline falls back to the rules planner when absent or failing. */
  planner?: Planner; onPlannerError?: (plannerId: string) => void;
  /** B4-1 model router (Meta / Glimmer). Without it every frame uses `models`. */
  router?: RoutedModels;
}

/** Wires one WebSocket: hub (validation) → pipeline (brain) + ASR relay + sim touches. Returns a disposer. */
export function createSessionController(d: ControllerDeps): { hub: SessionHub; dispose(): void } {
  let disposed = false, relay: AsrRelay | null = null, unsubscribe: (() => void) | undefined;
  let turn = 0, audioBytes = 0, audioEnded = false, awaitingEnd = false;
  let keywords: string[] = [], accountingFailed = false;
  const base = () => ({ id: ulid(), ts: d.now?.() ?? Date.now() });
  const send = (message: ServerMessage) => {
    if (disposed) return;
    if (message.type === 'layout') keywords = message.elements.filter((element) => element.role !== 'text').map(({ label }) => label);
    d.send(message);
  };
  const usage = (u: Parameters<QuotaPort['recordUsage']>[0]): Promise<void> | void => {
    if (!d.quota) return;
    return d.quota.recordUsage(u).then(() => {}, () => {
      if (!accountingFailed) {
        accountingFailed = true;
        closeRelay(); pipeline.abort();
        send({ ...base(), type: 'error', code: 'cloud_paused', ...SPOKEN_ERRORS.cloud_paused });
      }
      throw new Error('Spend accounting unavailable');
    });
  };
  // Authenticated sessions spend a daily task; unauthenticated (dev) sessions still obey the kill switch.
  const quota = d.quota, claims = d.claims;
  const beforeTask = quota && (claims
    ? () => quota.startTask(claims.uid, claims.tier)
    : async (): Promise<StartResult> => ((await quota.cloudEnabled()) ? { ok: true, tasksLeft: 0 } : { ok: false, code: 'cloud_paused' }));
  const pipeline = new SessionPipeline({ models: d.models, send, ...(d.now ? { now: d.now } : {}), onUsage: usage,
    ...(beforeTask ? { beforeTask } : {}), ...(quota ? { cloudEnabled: () => quota.cloudEnabled() } : {}),
    ...(d.planner ? { planner: d.planner } : {}), ...(d.router ? { route: d.router } : {}), ...(d.onPlannerError ? { onPlannerError: d.onPlannerError } : {}) });
  const closeRelay = () => {
    turn++;
    const old = relay;
    relay = null;
    audioBytes = 0;
    audioEnded = false;
    awaitingEnd = false;
    old?.close();
  };
  const hub = new SessionHub({ send, ...(d.now ? { now: d.now } : {}), handlers: {
    onHello(message) {
      if (disposed) return;
      pipeline.setLocale(message.locale);
      pipeline.setMode(message.mode);
      pipeline.setPrivacy(message.privacy);
      unsubscribe?.();
      unsubscribe = message.caps.simRunId ? d.sims.subscribe(message.caps.simRunId, (event) => {
        if (disposed) return;
        pipeline.onSimTouch(event.elementId);
        send({ ...base(), type: 'sim.touch', runId: event.runId, screenId: event.screenId,
          x: event.x, y: event.y, u: event.u, v: event.v, elementId: event.elementId });
      }) : undefined;
    },
    async onMessage(message, payload) {
      if (disposed) return;
      if (accountingFailed && message.type !== 'abort' && message.type !== 'audio.end') return;
      switch (message.type) {
        case 'goal': closeRelay(); pipeline.onGoal(message.text); break;
        case 'answer':
          closeRelay();
          if (!pipeline.onAnswer(message.re, message.text)) pipeline.onGoal(message.text);
          break;
        case 'confirm.reply': pipeline.onConfirmReply(message.re, message.accepted); break;
        case 'event':
          // PIN entry is local: stop listening at once, and close the task's cloud part.
          if (message.kind === 'pinModeEntered') { closeRelay(); pipeline.onPinModeEntered(); }
          break;
        case 'audio': {
          if (!payload || audioEnded || awaitingEnd) break;
          audioBytes += payload.length;
          if (!relay) {
            // ASR is billed too: a paused cloud refuses the utterance up front.
            const openingTurn = turn;
            let enabled: boolean;
            try { enabled = quota ? await quota.cloudEnabled() : true; }
            catch (error) {
              if (disposed || openingTurn !== turn) break;
              throw error;
            }
            if (disposed || openingTurn !== turn) break;
            if (!enabled) {
              awaitingEnd = true;
              send({ ...base(), type: 'error', code: 'cloud_paused', ...SPOKEN_ERRORS.cloud_paused });
              break;
            }
            if (relay || disposed) break;
            const currentTurn = ++turn;
            const active = () => !disposed && currentTurn === turn;
            const error = () => {
              if (!active()) return;
              const ended = audioEnded;
              closeRelay();
              awaitingEnd = !ended;
              send({ ...base(), type: 'error', code: 'model_unavailable', retryable: true, say: "I didn't catch that. Please say it again." });
            };
            try {
              const opened = d.asr({ locales: [hub.locale], keywords }, {
                partial(text) { if (active()) send({ ...base(), type: 'transcript', text, final: false }); },
                final(text) {
                  if (!active()) return;
                  if (!text.trim() || text.length > 500) { error(); return; }
                  const seconds = audioBytes / 32_000;
                  const ended = audioEnded;
                  closeRelay();
                  awaitingEnd = !ended;
                  const completedTurn = turn;
                  const publish = () => {
                    if (disposed || accountingFailed || completedTurn !== turn) return;
                    send({ ...base(), type: 'transcript', text, final: true });
                    if (!pipeline.onTranscript(text)) pipeline.onGoal(text);
                  };
                  const recorded = usage({ kind: 'asr', seconds });
                  // The rejection path already pauses the controller and reports a content-free error.
                  if (recorded) void recorded.then(publish, () => {});
                  else publish();
                },
                error,
              });
              if (!active()) { opened.close(); break; }
              relay = opened;
            } catch { error(); break; }
          }
          relay?.push(payload);
          break;
        }
        case 'audio.end':
          if (awaitingEnd) awaitingEnd = false;
          else if (relay && !audioEnded) { audioEnded = true; relay.end(); }
          break;
        case 'keyframe': if (payload) await pipeline.onKeyframe(message, payload); break;
        case 'abort':
          closeRelay();
          pipeline.abort();
          keywords = [];
          send({ ...base(), type: 'finish', result: 'aborted', say: 'Stopped.' });
          break;
      }
    },
  } });
  return { hub, dispose() {
    if (disposed) return;
    disposed = true;
    closeRelay();
    pipeline.abort();
    unsubscribe?.();
    unsubscribe = undefined;
    keywords = [];
  } };
}
