import OpenAI from 'openai';

export const META_BASE_URL = 'https://api.meta.ai/v1';
export const MODELS = { spark: 'muse-spark-1.3', sparkFallback: 'muse-spark-1.2', sam: 'sam-3.1' } as const;

/** Standard mode only. Never use a "-contributor" model id: frames show users' surroundings. */
export function createMetaClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey, baseURL: META_BASE_URL, timeout: 5_000, maxRetries: 0 });
}

export const toDataUrl = (bytes: Uint8Array, mime: 'image/jpeg' | 'image/png' = 'image/jpeg') =>
  `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
