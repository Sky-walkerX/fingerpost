import { readFileSync } from 'node:fs';
import type OpenAI from 'openai';
import { z } from 'zod';
import { ElementRole, ScreenType, Sensitivity, type Layout, type LayoutElement, type Locale } from '@fingerpost/protocol';
import { MODELS, toDataUrl } from '../models/meta-client.ts';
import { normalizeSparkBox } from './geometry.ts';

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
  throw new Error('TODO(D1-T4): implement this; the tests describe the behaviour');
}

export async function parseScreen(client: OpenAI, image: { bytes: Uint8Array; mime: 'image/jpeg' }, opts: { locale: Locale; goal?: string }): Promise<ParseResult> {
  throw new Error('TODO(D1-T4): implement this; the tests describe the behaviour');
}
