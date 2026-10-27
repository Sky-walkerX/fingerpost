import { mkdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { createMetaClient, liveModels, mockModels, PARSE_PROMPT_ID } from '@fingerpost/gateway/eval-api';
import { loadLabels } from './dataset.ts';
import { evaluateItem } from './evaluate.ts';
import { renderReport, summarize } from './metrics.ts';

// pnpm --filter @fingerpost/evals eval --set mock-panel --mode mock --out ../docs/evals/report-mock.md
const { values } = parseArgs({ args: process.argv.slice(2).filter((a) => a !== '--'), options: { set: { type: 'string' }, mode: { type: 'string', default: 'mock' }, out: { type: 'string' }, limit: { type: 'string' } } });
if (!values.set || !values.out) { console.error('usage: --set <dataset dir name> --out <report.md> [--mode mock|live] [--limit N]'); process.exit(2); }
const dir = new URL(`../datasets/${values.set}/`, import.meta.url);
const labels = loadLabels(dir);
const models = values.mode === 'live'
  ? liveModels(createMetaClient(process.env.META_API_KEY ?? (console.error('META_API_KEY missing'), process.exit(2))))
  : mockModels();
const items = labels.items.slice(0, values.limit ? Number(values.limit) : undefined);
const results = [];
for (const item of items) { results.push(await evaluateItem(models, dir, item)); process.stdout.write('.'); }
const summary = summarize(results);
const out = new URL(values.out, `file://${process.cwd()}/`);
mkdirSync(new URL('.', out), { recursive: true });
writeFileSync(out, renderReport(`Eval: ${values.set} (${values.mode})`, summary, results, { date: new Date().toISOString(), prompt: PARSE_PROMPT_ID, mode: values.mode }));
console.log(`\n${JSON.stringify(summary)}`);
