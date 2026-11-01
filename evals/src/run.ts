import { mkdirSync, writeFileSync, writeSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { createGlimmerClient, createMetaClient, glimmerModels, liveModels, loadConfig, mockModels, PARSE_PROMPT_ID, type ModelPort } from '@fingerpost/gateway/eval-api';
import { loadLabels } from './dataset.ts';
import { evaluateItem } from './evaluate.ts';
import { renderReport, summarize } from './metrics.ts';

const Options = z.object({
  set: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/),
  mode: z.enum(['mock', 'live', 'private']).default('mock'),
  out: z.string().min(1).endsWith('.md'),
  limit: z.string().regex(/^[1-9]\d*$/).transform(Number).refine(Number.isSafeInteger).optional(),
});

/** Local evaluation CLI. Errors and reports must never expose provider content or private paths. */
export async function main(args = process.argv.slice(2), env: NodeJS.ProcessEnv = process.env): Promise<number> {
  let options: z.infer<typeof Options>;
  try {
    const { values } = parseArgs({ args: args.filter((arg) => arg !== '--'), options: {
      set: { type: 'string' }, mode: { type: 'string', default: 'mock' }, out: { type: 'string' }, limit: { type: 'string' },
    } });
    options = Options.parse(values);
  } catch {
    writeSync(2, 'usage: --set <dataset dir name> --out <report.md> [--mode mock|live|private] [--limit N]\n');
    return 2;
  }
  if (options.mode === 'live' && !env.META_API_KEY?.trim()) {
    writeSync(2, 'META_API_KEY missing (configure the ignored local environment first)\n');
    return 2;
  }
  // B4-3: private mode reads with Glimmer on Modal, using only the three GLIMMER_* settings.
  const glimmerEnv = { GLIMMER_URL: env.GLIMMER_URL?.trim(), GLIMMER_TOKEN: env.GLIMMER_TOKEN?.trim(), GLIMMER_MODEL: env.GLIMMER_MODEL?.trim() };
  if (options.mode === 'private' && !(glimmerEnv.GLIMMER_URL && glimmerEnv.GLIMMER_TOKEN && glimmerEnv.GLIMMER_MODEL)) {
    writeSync(2, 'GLIMMER_URL, GLIMMER_TOKEN and GLIMMER_MODEL are needed for --mode private\n');
    return 2;
  }
  try {
    const dir = new URL(`../datasets/${options.set}/`, import.meta.url);
    const labels = loadLabels(dir);
    let models: ModelPort;
    if (options.mode === 'live') models = liveModels(createMetaClient(env.META_API_KEY!));
    else if (options.mode === 'private') {
      const cfg = loadConfig({ ...glimmerEnv, ...(env.MODEL_TIMEOUT_MS ? { MODEL_TIMEOUT_MS: env.MODEL_TIMEOUT_MS } : {}) });
      models = glimmerModels(createGlimmerClient(cfg), cfg.GLIMMER_MODEL!);
    } else models = mockModels();
    const items = labels.items.slice(0, options.limit);
    const results = [];
    for (const item of items) {
      results.push(await evaluateItem(models, dir, item));
      writeSync(1, '.');
    }
    const summary = summarize(results);
    const out = pathToFileURL(resolve(options.out));
    mkdirSync(new URL('.', out), { recursive: true });
    writeFileSync(out, renderReport(`Eval (${options.mode})`, summary, results,
      { date: new Date().toISOString(), prompt: PARSE_PROMPT_ID, mode: options.mode }));
    writeSync(1, `\n${JSON.stringify(summary)}\n`);
    return 0;
  } catch {
    writeSync(2, 'Evaluation failed. Check the local dataset and model availability.\n');
    return 1;
  }
}

if (import.meta.main) process.exitCode = await main();
