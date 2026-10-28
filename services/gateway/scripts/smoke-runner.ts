import type { ModelPort } from '../src/models/port.ts';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { UV } from '@fingerpost/protocol';
import { jpegSize } from '../src/debug/jpeg.ts';

export interface SmokePaths {
  dataset: string;
  privateOutput: string;
  report: string;
}

/** Keeps review overlays private and writes only numerical outcomes to the public report. */
export async function runSmoke(models: ModelPort, paths: SmokePaths): Promise<void> {
  let names: string[];
  try {
    names = readdirSync(paths.dataset).filter((name) => /\.jpe?g$/i.test(name)).sort();
  } catch {
    throw new Error('Day 1 JPEG dataset is unavailable');
  }
  if (names.length < 10) throw new Error('At least 10 JPEG panel photos are required');
  // Validate the entire dataset before the first paid request.
  const images = names.map((name) => {
    let bytes: Uint8Array;
    try { bytes = new Uint8Array(readFileSync(join(paths.dataset, name))); }
    catch { throw new Error('Day 1 JPEG dataset is unavailable'); }
    return { bytes, ...jpegSize(bytes) };
  });
  const percentile = (values: number[], p: number): string => {
    const sorted = [...values].sort((a, b) => a - b);
    const value = sorted[Math.ceil(p * sorted.length) - 1];
    return value === undefined ? 'not measured' : String(value);
  };
  const rows: string[] = [], spark: number[] = [], samBox: number[] = [], samText: number[] = [];
  let inputTokens = 0, outputTokens = 0, targets = 0;
  mkdirSync(paths.privateOutput, { recursive: true, mode: 0o700 });
  for (const [index, image] of images.entries()) {
    const parsed = await models.parseScreen({ bytes: image.bytes, mime: 'image/jpeg' }, { locale: 'en' });
    spark.push(parsed.latencyMs);
    inputTokens += parsed.usage.inputTokens;
    outputTokens += parsed.usage.outputTokens;
    const button = parsed.layout.elements.find((element) => element.role !== 'text');
    let polygon: UV[] | null = null, targetMs: number | null = null;
    if (button) {
      const xs = button.polygon.map((point) => point.u * image.width);
      const ys = button.polygon.map((point) => point.v * image.height);
      const target = await models.segmentByBox(image, {
        left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys),
      });
      samBox.push(target.latencyMs);
      polygon = target.polygon;
      targetMs = target.latencyMs;
      if (polygon) targets++;
    }
    const screen = await models.segmentByText(image, 'touchscreen display');
    samText.push(screen.latencyMs);
    rows.push(`| ${index + 1} | ${parsed.layout.elements.length} | ${parsed.latencyMs} | ${targetMs ?? 'not measured'} | ${polygon ? 1 : 0} | ${screen.latencyMs} | ${screen.polygon ? 1 : 0} | ${parsed.usage.inputTokens}/${parsed.usage.outputTokens} |`);
    const points = (values: UV[]) => values.map((point) =>
      `${(point.u * image.width).toFixed(1)},${(point.v * image.height).toFixed(1)}`).join(' ');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${image.width} ${image.height}">` +
      `<image href="data:image/jpeg;base64,${Buffer.from(image.bytes).toString('base64')}" width="${image.width}" height="${image.height}"/>` +
      parsed.layout.elements.map((element) => `<polygon points="${points(element.polygon)}" fill="none" stroke="#2563eb" stroke-width="3"/>`).join('') +
      (button ? `<polygon points="${points(button.polygon)}" fill="none" stroke="#f59e0b" stroke-width="5" stroke-dasharray="10 5"/>` : '') +
      (polygon ? `<polygon points="${points(polygon)}" fill="rgba(22,163,74,.35)" stroke="#16a34a" stroke-width="4"/>` : '') + '</svg>';
    writeFileSync(join(paths.privateOutput, `sample-${String(index + 1).padStart(3, '0')}.svg`), svg, { mode: 0o600 });
  }
  const estimatedCost = (inputTokens * 1.25 + outputTokens * 4.25) / 1e6 + (samBox.length + samText.length) * 0.0025;
  const timings: [string, number[]][] = [['Spark parse', spark], ['SAM box', samBox], ['SAM text', samText]];
  const report = `# Day 1 live smoke (${new Date().toISOString()})\n\nImages evaluated: ${images.length}. Target polygons present: ${targets}/${images.length}.\n\n` +
    'Correct target polygons: pending manual review. Polygon presence does not establish correctness.\n\n' +
    '| Sample | Elements | Spark ms | SAM box ms | Target present | SAM text ms | Screen present | Tokens in/out |\n|---|---|---|---|---|---|---|---|\n' +
    rows.join('\n') + '\n\n| Call | p50 ms | p95 ms |\n|---|---|---|\n' +
    timings.map(([label, values]) => `| ${label} | ${percentile(values, 0.5)} | ${percentile(values, 0.95)} |`).join('\n') +
    `\n\nAverage input tokens per parse: ${Math.round(inputTokens / images.length)}. Estimated total cost using Day 1 planning rates (not measured billing): $${estimatedCost.toFixed(4)} (~$${(estimatedCost / images.length).toFixed(4)} per image).\n\n` +
    'Review overlays remain in ignored local storage: blue = Spark boxes, orange = selected box prompt, green = SAM target. No photo, source filename or recognized label is included in this report.\n';
  mkdirSync(dirname(paths.report), { recursive: true });
  writeFileSync(paths.report, report);
}
