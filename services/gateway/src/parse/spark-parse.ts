import { readFileSync } from 'node:fs';
import type OpenAI from 'openai';
import { z } from 'zod';
import { ElementRole, ScreenType, Sensitivity, type Layout, type LayoutElement, type Locale } from '@fingerpost/protocol';
import { MODELS, toDataUrl } from '../models/meta-client.ts';
import { normalizeSparkBox } from './geometry.ts';
import { modelRequest } from '../models/deadline.ts';

export const PARSE_PROMPT_ID = 'parse-screen.v1';
const SYSTEM_PROMPT = readFileSync(new URL(`../../prompts/${PARSE_PROMPT_ID}.md`, import.meta.url), 'utf8');

/** What Spark must return. Strict-mode compatible: strict objects everywhere, optional values are nullable. */
export const SparkElement = z.strictObject({
  label: z.string(),
  label_local: z.string().nullable(),
  role: ElementRole,
  state: z.string().nullable(),
  bbox: z.strictObject({ x_min: z.number(), y_min: z.number(), x_max: z.number(), y_max: z.number() }),
  confidence: z.number(),
});
export const SparkScreen = z.strictObject({
  screen_type: ScreenType,
  sensitivity: Sensitivity,
  language: z.string(),
  rotation: z.literal([0, 90, 180, 270]),
  elements: z.array(SparkElement).max(60),
});
export type SparkScreen = z.infer<typeof SparkScreen>;
export const SPARK_SCREEN_JSON_SCHEMA = (() => { const { $schema: _drop, ...rest } = z.toJSONSchema(SparkScreen) as Record<string, unknown>; return rest; })();

export type ParsedLayout = Pick<Layout, 'screenType' | 'sensitivity' | 'language' | 'rotation' | 'elements'>;
export interface ParseResult { layout: ParsedLayout; usage: { inputTokens: number; outputTokens: number }; latencyMs: number; promptId: string; }

export const normalizeLabel = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/g, ' ').trim();

/** Spark output → protocol layout. Drops zero-area boxes and empty labels; clamps confidence; ids are e1, e2, … in Spark's order. */
export function toLayout(s: SparkScreen): ParsedLayout {
  const elements: LayoutElement[] = [];
  for (const element of s.elements) {
    const box = normalizeSparkBox(element.bbox);
    const label = element.label.trim();
    if (!label || box.w === 0 || box.h === 0) continue;
    const right = Math.min(1, box.u + box.w), bottom = Math.min(1, box.v + box.h);
    const textNorm = normalizeLabel(label);
    elements.push({ id: `e${elements.length + 1}`, label, role: element.role,
      polygon: [{ u: box.u, v: box.v }, { u: right, v: box.v }, { u: right, v: bottom }, { u: box.u, v: bottom }],
      confidence: Math.max(0, Math.min(1, element.confidence)),
      ...(element.label_local !== null ? { labelLocal: element.label_local } : {}),
      ...(element.state !== null ? { state: element.state } : {}),
      ...(textNorm ? { textNorm } : {}),
    });
  }
  return { screenType: s.screen_type, sensitivity: s.sensitivity,
    language: s.language.slice(0, 16) || 'und', rotation: s.rotation, elements };
}

export type ReasoningEffort = 'low' | 'medium' | 'high';

export async function parseScreen(client: OpenAI, image: { bytes: Uint8Array; mime: 'image/jpeg' }, opts: { locale: Locale; goal?: string; signal?: AbortSignal },
  model: string = MODELS.spark, reasoning?: ReasoningEffort): Promise<ParseResult> {
  const started = performance.now();
  const response = await modelRequest(client, opts.signal, (signal) => client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: [
        { type: 'text', text: `Locale for label_local: ${opts.locale}.` + (opts.goal ? ` The user wants to: ${opts.goal}` : '') },
        { type: 'image_url', image_url: { url: toDataUrl(image.bytes, image.mime) } },
      ] },
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'screen_layout', strict: true, schema: SPARK_SCREEN_JSON_SCHEMA } },
    ...(reasoning ? { reasoning_effort: reasoning } : {}),
  }, { headers: { 'X-Prompt-Id': PARSE_PROMPT_ID }, signal }));
  const content = response.choices[0]?.message.content;
  if (!content) throw new Error('Spark returned no content');
  const layout = toLayout(SparkScreen.parse(JSON.parse(content)));
  return { layout, usage: { inputTokens: response.usage?.prompt_tokens ?? 0, outputTokens: response.usage?.completion_tokens ?? 0 },
    latencyMs: Math.round(performance.now() - started), promptId: PARSE_PROMPT_ID };
}
