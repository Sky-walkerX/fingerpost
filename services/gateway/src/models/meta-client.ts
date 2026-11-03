import OpenAI from 'openai';
import { MODEL_TIMEOUT_LIMIT_MS } from '../config.ts';

export const META_BASE_URL = 'https://api.meta.ai/v1';
export const MODELS = { spark: 'muse-spark-1.3', sparkFallback: 'muse-spark-1.2', sam: 'sam-3.1' } as const;

/** Standard mode only. Never use a "-contributor" model id: frames show users' surroundings. */
export function createMetaClient(apiKey: string, timeoutMs = MODEL_TIMEOUT_LIMIT_MS): OpenAI {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > MODEL_TIMEOUT_LIMIT_MS)
    throw new RangeError('MODEL_TIMEOUT_MS must be an integer from 1000 to 5000');
  return new OpenAI({ apiKey, baseURL: META_BASE_URL, timeout: timeoutMs, maxRetries: 0 });
}

export const toDataUrl = (bytes: Uint8Array, mime: 'image/jpeg' | 'image/png' = 'image/jpeg') =>
  `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
