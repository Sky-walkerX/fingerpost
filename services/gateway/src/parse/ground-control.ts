import { readFileSync } from 'node:fs';
import type OpenAI from 'openai';
import { z } from 'zod';
import type { LayoutElement, Locale, Polygon } from '@fingerpost/protocol';
import { MODELS, toDataUrl } from '../models/meta-client.ts';
import { modelRequest } from '../models/deadline.ts';
import { controlCrop } from './control-crop.ts';
import type { SamImage } from './sam.ts';

export const GROUND_PROMPT_ID = 'ground-control.v1';
const PROMPT = readFileSync(new URL(`../../prompts/${GROUND_PROMPT_ID}.md`, import.meta.url), 'utf8');
const Coordinate = z.number().int().min(0).max(1000);
export const GroundedControl = z.strictObject({
  actuation: z.enum(['press', 'turn', 'slide', 'not_found']),
  bbox: z.strictObject({ x_min: Coordinate, y_min: Coordinate, x_max: Coordinate, y_max: Coordinate }).nullable(),
  confidence: z.number().min(0).max(1),
});
const ValidControl = GroundedControl.superRefine((result, ctx) => {
  if ((result.actuation === 'press') !== (result.bbox !== null)
    || result.bbox && (result.bbox.x_min >= result.bbox.x_max || result.bbox.y_min >= result.bbox.y_max)) {
    ctx.addIssue({ code: 'custom', message: 'Invalid grounded control' });
  }
});
const JSON_SCHEMA = (() => { const { $schema: _drop, ...schema } = z.toJSONSchema(GroundedControl) as Record<string, unknown>; return schema; })();
export interface GroundRequest { locale: Locale; goal: string; element: LayoutElement }
export interface ControlGrounding {
  actuation: z.infer<typeof GroundedControl>['actuation']; polygon: Polygon | null; confidence: number;
  usage: { inputTokens: number; outputTokens: number }; latencyMs: number; promptId: string;
}

/** A focused second look must confirm a pressable area; uncertainty never restores the coarse box. */
export function groundControl(client: OpenAI, image: SamImage, options: GroundRequest): Promise<ControlGrounding> {
  const started = performance.now();
  return modelRequest(client, image.signal, async (signal) => {
    const crop = await controlCrop({ ...image, signal }, options.element.polygon);
    try {
      signal.throwIfAborted();
      const response = await client.chat.completions.create({ model: MODELS.spark, messages: [
        { role: 'system', content: PROMPT },
        { role: 'user', content: [
          { type: 'text', text: JSON.stringify({ locale: options.locale, label: options.element.label,
            labelLocal: options.element.labelLocal ?? null, goal: options.goal }) },
          { type: 'image_url', image_url: { url: toDataUrl(crop.bytes) } },
        ] },
      ], response_format: { type: 'json_schema', json_schema: { name: 'press_control', strict: true, schema: JSON_SCHEMA } } },
      { headers: { 'X-Prompt-Id': GROUND_PROMPT_ID }, signal });
      const content = response.choices[0]?.message.content;
      if (!content) throw new Error('Missing control grounding');
      const result = ValidControl.parse(JSON.parse(content)), b = result.bbox;
      const polygon = b ? crop.toImage([{ u: b.x_min / 1000, v: b.y_min / 1000 }, { u: b.x_max / 1000, v: b.y_min / 1000 },
        { u: b.x_max / 1000, v: b.y_max / 1000 }, { u: b.x_min / 1000, v: b.y_max / 1000 }]) : null;
      return { actuation: result.actuation, polygon, confidence: result.confidence,
        usage: { inputTokens: response.usage?.prompt_tokens ?? 0, outputTokens: response.usage?.completion_tokens ?? 0 },
        latencyMs: Math.round(performance.now() - started), promptId: GROUND_PROMPT_ID };
    } finally { crop.bytes.fill(0); }
  });
}
