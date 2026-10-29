import { readFileSync } from 'node:fs';
import { resolveByText, type ModelPort } from '@fingerpost/gateway/eval-api';
import type { LabeledItem } from './dataset.ts';
import { boxOfPolygon, centreInBox, matchElements, SENSITIVE, type ItemResult } from './metrics.ts';

/** Runs one labeled image through the same parse + resolve + SAM path the gateway uses. */
export async function evaluateItem(models: ModelPort, dir: URL, item: LabeledItem, readImage = (u: URL) => new Uint8Array(readFileSync(u))): Promise<ItemResult> {
  const bytes = readImage(new URL(item.image, dir));
  const started = performance.now();
  const parsed = await models.parseScreen({ bytes, mime: 'image/jpeg' }, { locale: 'en' });
  const latencyMs = Math.round(performance.now() - started);
  const { elements } = parsed.layout;
  const match = matchElements(elements.map((e) => ({ label: e.label, box: boxOfPolygon(e.polygon) })), item.elements);
  let samCalls = 0;
  const goals: ItemResult['goals'] = [];
  for (const { goal, label } of item.goals) {
    const resolved = resolveByText(goal, elements);
    const truth = item.elements.find((e) => e.label === label);
    if (resolved.kind !== 'match' || !truth) { goals.push({ goal, hit: false }); continue; }
    const b = boxOfPolygon(resolved.element.polygon), { w, h } = item.imageSize;
    const mask = await models.segmentByBox({ bytes, width: w, height: h },
      { left: b.u * w, top: b.v * h, right: (b.u + b.w) * w, bottom: (b.v + b.h) * h });
    samCalls++;
    goals.push({ goal, hit: centreInBox(mask.polygon ?? resolved.element.polygon, truth.box) });
  }
  return { image: item.image, latencyMs, inputTokens: parsed.usage.inputTokens, outputTokens: parsed.usage.outputTokens, samCalls,
    match, screenTypeOk: parsed.layout.screenType === item.screenType,
    gtSensitive: SENSITIVE.has(item.screenType), predSensitive: SENSITIVE.has(parsed.layout.screenType), goals };
}
