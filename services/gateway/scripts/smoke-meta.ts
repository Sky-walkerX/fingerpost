// Live evaluation spends credits. Only the numeric report belongs in Git.
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createMetaClient } from '../src/models/meta-client.ts';
import { liveModels } from '../src/models/port.ts';
import { runSmoke } from './smoke-runner.ts';

export async function main(env: NodeJS.ProcessEnv = process.env): Promise<number> {
  if (!env.META_API_KEY) {
    console.error('META_API_KEY missing (configure the ignored local environment first)');
    return 2;
  }
  try {
    const runId = randomUUID();
    await runSmoke(liveModels(createMetaClient(env.META_API_KEY)), {
      dataset: fileURLToPath(new URL('../../../evals/datasets/day1/', import.meta.url)),
      privateOutput: fileURLToPath(new URL(`../../../evals/datasets/private/day1-smoke/${runId}/`, import.meta.url)),
      report: fileURLToPath(new URL('../../../docs/evals/day1-smoke.md', import.meta.url)),
    });
    console.log(`wrote docs/evals/day1-smoke.md; private overlays: evals/datasets/private/day1-smoke/${runId}/`);
    return 0;
  } catch {
    // SDK errors can contain response text, image data and credentials.
    console.error('Live smoke failed. Check the private dataset, credentials and model availability locally.');
    return 1;
  }
}

if (import.meta.main) process.exitCode = await main();
