import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadLabels } from '../src/dataset.ts';

export function renderOutput(args: string[], datasets: string): string {
  if (args.length === 0) return join(datasets, 'pinpay');
  if (args.length !== 2 || args[0] !== '--out' || !/^private\/[a-z0-9][a-z0-9-]{0,63}$/.test(args[1] ?? ''))
    throw new Error('Use --out private/<new-name>');
  return join(datasets, args[1]!);
}

export async function renderDataset(destination: string, render: (staging: string) => Promise<void>): Promise<number> {
  const checkUnused = () => {
    if (existsSync(destination)) throw new Error('Dataset output already exists');
  };
  checkUnused();
  mkdirSync(dirname(destination), { recursive: true });
  const staging = mkdtempSync(join(dirname(destination), '.render-'));
  try {
    await render(staging);
    const labels = loadLabels(pathToFileURL(staging + '/'));
    checkUnused();
    renameSync(staging, destination);
    return labels.items.length;
  } finally { rmSync(staging, { recursive: true, force: true }); }
}
