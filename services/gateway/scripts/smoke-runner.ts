import type { ModelPort } from '../src/models/port.ts';
import type { ParseResult } from '../src/parse/spark-parse.ts';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { UV } from '@fingerpost/protocol';
import { jpegSize } from '../src/debug/jpeg.ts';

export interface SmokePaths {
  dataset: string;
  privateOutput: string;
  report: string;
}

type Status = 'pending' | 'ok' | 'failed' | 'not run';
interface Stage { status: Status; ms: number | null; }
interface Sample {
  index: number;
  complete: boolean;
  elements: number | null;
  spark: Stage;
  box: Stage;
  text: Stage;
  target: boolean;
  screen: boolean;
  inputTokens: number;
  outputTokens: number;
}

/** Keeps review overlays private and checkpoints numerical outcomes, including failed calls. */
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
  const samples: Sample[] = [];
  const stages = (sample: Sample) => [sample.spark, sample.box, sample.text];
  const failureCount = () => samples.reduce((count, sample) => count + stages(sample).filter((stage) => stage.status === 'failed').length, 0);
  mkdirSync(paths.privateOutput, { recursive: true, mode: 0o700 });
  mkdirSync(dirname(paths.report), { recursive: true });
  const checkpoint = (finished = false) => {
    const inputTokens = samples.reduce((sum, sample) => sum + sample.inputTokens, 0);
    const outputTokens = samples.reduce((sum, sample) => sum + sample.outputTokens, 0);
    const samCalls = samples.flatMap((sample) => [sample.box, sample.text]).filter((stage) => stage.status === 'ok').length;
    const parseCount = samples.filter((sample) => sample.spark.status === 'ok').length;
    const estimatedCost = (inputTokens * 1.25 + outputTokens * 4.25) / 1e6 + samCalls * 0.0025;
    const timings: [string, Stage[]][] = [
      ['Spark parse', samples.map((sample) => sample.spark)],
      ['SAM box', samples.map((sample) => sample.box)],
      ['SAM text', samples.map((sample) => sample.text)],
    ];
    const status = !finished ? 'in progress' : failureCount() ? 'completed with model errors' : 'completed';
    const report = `# Day 1 live smoke (${new Date().toISOString()})\n\nRun status: ${status}.\n\n` +
      `Samples attempted: ${samples.length}/${images.length}. Samples completed without model errors: ${samples.filter((sample) => sample.complete && stages(sample).every((stage) => stage.status !== 'failed')).length}/${images.length}. Failed model calls: ${failureCount()}.\n\n` +
      `Target polygons present: ${samples.filter((sample) => sample.target).length}/${images.length}.\n\n` +
      'Correct target polygons: pending manual review. Polygon presence does not establish correctness.\n\n' +
      '| Sample | Elements | Spark ms | SAM box ms | Target present | SAM text ms | Screen present | Tokens in/out | Call status |\n|---|---|---|---|---|---|---|---|---|\n' +
      samples.map((sample) => `| ${sample.index} | ${sample.elements ?? 'not measured'} | ${sample.spark.ms ?? 'not measured'} | ${sample.box.ms ?? 'not measured'} | ${Number(sample.target)} | ${sample.text.ms ?? 'not measured'} | ${Number(sample.screen)} | ${sample.inputTokens}/${sample.outputTokens} | Spark ${sample.spark.status}; SAM box ${sample.box.status}; SAM text ${sample.text.status} |`).join('\n') +
      '\n\nSuccessful calls only; failed or unfinished calls are excluded from latency percentiles.\n\n| Call | Successful calls | p50 ms | p95 ms |\n|---|---|---|---|\n' +
      timings.map(([label, values]) => {
        const measured = values.flatMap((stage) => stage.status === 'ok' && stage.ms !== null ? [stage.ms] : []);
        return `| ${label} | ${measured.length} | ${percentile(measured, 0.5)} | ${percentile(measured, 0.95)} |`;
      }).join('\n') +
      `\n\nAverage input tokens per successful parse: ${parseCount ? Math.round(inputTokens / parseCount) : 'not measured'}. Estimated cost of successful calls using Day 1 planning rates (not measured billing): $${estimatedCost.toFixed(4)}. Failed or unfinished calls may also be billed; this is not the total run cost.\n\n` +
      'Review overlays remain in ignored local storage: blue = Spark boxes, orange = selected box prompt, green = SAM target. No photo, source filename or recognized label is included in this report.\n';
    writeFileSync(paths.report, report);
  };
  checkpoint();
  for (const [index, image] of images.entries()) {
    const sample: Sample = { index: index + 1, complete: false, elements: null,
      spark: { status: 'pending', ms: null }, box: { status: 'not run', ms: null }, text: { status: 'not run', ms: null },
      target: false, screen: false, inputTokens: 0, outputTokens: 0 };
    samples.push(sample);
    checkpoint();
    let parsed: ParseResult;
    try {
      parsed = await models.parseScreen({ bytes: image.bytes, mime: 'image/jpeg' }, { locale: 'en' });
    } catch {
      sample.spark.status = 'failed';
      sample.complete = true;
      checkpoint();
      continue;
    }
    sample.spark = { status: 'ok', ms: parsed.latencyMs };
    sample.elements = parsed.layout.elements.length;
    sample.inputTokens = parsed.usage.inputTokens;
    sample.outputTokens = parsed.usage.outputTokens;
    checkpoint();
    const button = parsed.layout.elements.find((element) => element.role !== 'text');
    let polygon: UV[] | null = null;
    if (button) {
      sample.box.status = 'pending';
      checkpoint();
      const xs = button.polygon.map((point) => point.u * image.width);
      const ys = button.polygon.map((point) => point.v * image.height);
      try {
        const target = await models.segmentByBox(image, {
          left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys),
        });
        sample.box = { status: 'ok', ms: target.latencyMs };
        polygon = target.polygon;
        sample.target = polygon !== null;
      } catch {
        sample.box.status = 'failed';
      }
    }
    const points = (values: UV[]) => values.map((point) =>
      `${(point.u * image.width).toFixed(1)},${(point.v * image.height).toFixed(1)}`).join(' ');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${image.width} ${image.height}">` +
      `<image href="data:image/jpeg;base64,${Buffer.from(image.bytes).toString('base64')}" width="${image.width}" height="${image.height}"/>` +
      parsed.layout.elements.map((element) => `<polygon points="${points(element.polygon)}" fill="none" stroke="#2563eb" stroke-width="3"/>`).join('') +
      (button ? `<polygon points="${points(button.polygon)}" fill="none" stroke="#f59e0b" stroke-width="5" stroke-dasharray="10 5"/>` : '') +
      (polygon ? `<polygon points="${points(polygon)}" fill="rgba(22,163,74,.35)" stroke="#16a34a" stroke-width="4"/>` : '') + '</svg>';
    writeFileSync(join(paths.privateOutput, `sample-${String(index + 1).padStart(3, '0')}.svg`), svg, { mode: 0o600 });
    sample.text.status = 'pending';
    checkpoint();
    try {
      const screen = await models.segmentByText(image, 'touchscreen display');
      sample.text = { status: 'ok', ms: screen.latencyMs };
      sample.screen = screen.polygon !== null;
    } catch {
      sample.text.status = 'failed';
    }
    sample.complete = true;
    checkpoint();
  }
  checkpoint(true);
  if (failureCount()) throw new Error('Live smoke incomplete: one or more model calls failed');
}
