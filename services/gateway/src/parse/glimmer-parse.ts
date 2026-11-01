import OpenAI from 'openai';
import type { Config } from '../config.ts';
import type { ModelPort } from '../models/port.ts';
import { parseScreen } from './spark-parse.ts';
import type { SegmentResult } from './sam.ts';

/** Glimmer on Modal has no SAM: geometry comes from the box Glimmer returns and device OCR (design §3.2 private mode). */
const NO_MASK: SegmentResult = { polygon: null, confidence: null, latencyMs: 0 };

/**
 * Days 4–7 plan, B4-3. Private mode parses with Glimmer behind vLLM's OpenAI-compatible server. It reuses the
 * Spark prompt, strict SparkScreen schema and toLayout, so a private layout has exactly the same shape.
 */
export function glimmerModels(client: OpenAI, model: string): ModelPort {
  return {
    parseScreen: (img, o) => parseScreen(client, img, o, model),
    segmentByBox: async () => NO_MASK,
    segmentByText: async () => NO_MASK,
  };
}

/**
 * The Modal endpoint uses proxy auth: GLIMMER_TOKEN is "<Modal-Key>:<Modal-Secret>" of a proxy-auth token.
 * Same timeout as Meta calls and no SDK retries; the router owns fallback.
 */
export function createGlimmerClient(cfg: Config, fetchImpl?: typeof fetch): OpenAI {
  const [key, secret] = cfg.GLIMMER_TOKEN!.split(':') as [string, string];
  return new OpenAI({ apiKey: 'unused', baseURL: cfg.GLIMMER_URL!, timeout: cfg.MODEL_TIMEOUT_MS, maxRetries: 0,
    defaultHeaders: { 'Modal-Key': key, 'Modal-Secret': secret }, ...(fetchImpl ? { fetch: fetchImpl } : {}) });
}
