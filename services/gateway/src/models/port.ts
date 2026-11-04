import OpenAI from 'openai';
import { MODELS } from './meta-client.ts';
import type { Locale } from '@fingerpost/protocol';
import { parseScreen, type ParseResult, type ReasoningEffort } from '../parse/spark-parse.ts';
import { segmentByBox, segmentByText, type PxBox, type SamImage, type SegmentResult } from '../parse/sam.ts';
import { groundControl, type ControlGrounding, type GroundRequest } from '../parse/ground-control.ts';

/** Everything the session pipeline needs from models. Live = Meta API; mock = canned answers for dev and CI. */
export interface ModelPort {
  parseScreen(image: { bytes: Uint8Array; mime: 'image/jpeg' }, opts: { locale: Locale; goal?: string; signal?: AbortSignal }): Promise<ParseResult>;
  segmentByBox(image: SamImage, box: PxBox): Promise<SegmentResult>;
  segmentByText(image: SamImage, phrase: string): Promise<SegmentResult>;
  /** Meta's focused locator; ports without it retain their existing OCR/mock geometry path. */
  groundControl?(image: SamImage, options: GroundRequest): Promise<ControlGrounding>;
}

/** A provider-side failure worth one try on the older Spark: a timeout or a 5xx. Bad requests (4xx) are not. */
export function sparkFallbackWorthy(error: unknown): boolean {
  if (error instanceof OpenAI.APIConnectionTimeoutError) return true;
  return error instanceof OpenAI.APIError && typeof error.status === 'number' && error.status >= 500;
}

/** guidance-spec §8 (initial value, 2026-11-04): a 1.3 parse still unanswered this long also starts 1.2. */
export const SPARK_HEDGE_MS = 15_000;

type ParseImage = Parameters<ModelPort['parseScreen']>[0];
type ParseOptions = Parameters<ModelPort['parseScreen']>[1];

/**
 * Days 4–7 plan, B4-1: Spark 1.3, then Spark 1.2 once on a timeout or 5xx. Cluttered photos keep 1.3 busy for
 * about the whole per-call bound, so 1.2 also starts once 1.3 has been silent for `hedgeMs`; the first valid
 * parse wins and the other request is cancelled. A 4xx before the hedge still fails without 1.2.
 */
function hedgedParse(client: OpenAI, img: ParseImage, o: ParseOptions, hedgeMs: number, reasoning?: ReasoningEffort): Promise<ParseResult> {
  const parent = o.signal;
  const primary = new AbortController(), backup = new AbortController();
  const scoped = (c: AbortController) => (parent ? AbortSignal.any([parent, c.signal]) : c.signal);
  return new Promise<ParseResult>((resolve, reject) => {
    let settled = false, backupStarted = false, primaryFailed = false, backupFailed = false, backupError: unknown;
    const finish = (settle: () => void, winner?: AbortController) => {
      if (settled) return;
      settled = true; clearTimeout(timer); parent?.removeEventListener('abort', onParentAbort);
      for (const c of [primary, backup]) if (c !== winner) c.abort();
      settle();
    };
    const onParentAbort = () => finish(() => reject(parent!.reason));
    const startBackup = () => {
      if (backupStarted || settled) return;
      backupStarted = true;
      parseScreen(client, img, { ...o, signal: scoped(backup) }, MODELS.sparkFallback, reasoning).then(
        (result) => finish(() => resolve(result), backup),
        (error: unknown) => { backupFailed = true; backupError = error; if (primaryFailed) finish(() => reject(error)); });
    };
    const timer = setTimeout(startBackup, hedgeMs);
    if (parent?.aborted) { onParentAbort(); return; }
    parent?.addEventListener('abort', onParentAbort, { once: true });
    parseScreen(client, img, { ...o, signal: scoped(primary) }, MODELS.spark, reasoning).then(
      (result) => finish(() => resolve(result), primary),
      (error: unknown) => {
        primaryFailed = true;
        if (backupFailed) { finish(() => reject(backupError)); return; }
        if (backupStarted) return;
        if (!sparkFallbackWorthy(error)) { finish(() => reject(error)); return; }
        clearTimeout(timer); startBackup();
      });
  });
}

/** [parseReasoning] applies only to the screen parse; omitted means the model's own default. */
export function liveModels(client: OpenAI, options: { hedgeMs?: number; parseReasoning?: ReasoningEffort } = {}): ModelPort {
  const hedgeMs = options.hedgeMs ?? SPARK_HEDGE_MS;
  return {
    // No other retries here (B5-3): the router owns the one jittered retry and the Glimmer step.
    parseScreen: (img, o) => hedgedParse(client, img, o, hedgeMs, options.parseReasoning),
    segmentByBox: (img, box) => segmentByBox(client, img, box),
    segmentByText: (img, phrase) => segmentByText(client, img, phrase),
    groundControl: (img, opts) => groundControl(client, img, opts),
  };
}
