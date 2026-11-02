import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { runLoadTest } from '../scripts/load.ts';

test('load test runs 3 sessions for 3 seconds with 0 errors and generates report', async () => {
  const outPath = join(tmpdir(), `load-test-${Date.now()}.md`);
  try {
    const result = await runLoadTest({
      sessions: 3,
      seconds: 3,
      out: outPath,
    });

    expect(result.errors).toBe(0);
    expect(result.pass).toBe(true);
    expect(result.sessions).toBe(3);
    expect(result.durationSeconds).toBe(3);
    expect(result.messageCount).toBeGreaterThan(0);
    expect(result.p50Ms).toBeGreaterThanOrEqual(0);
    expect(result.p95Ms).toBeGreaterThanOrEqual(0);
    expect(result.p95Ms).toBeLessThan(200);
    expect(result.maxMs).toBeGreaterThanOrEqual(0);
    expect(result.date).toBeDefined();
    expect(result.machine).toBeDefined();

    expect(existsSync(outPath)).toBe(true);
    const content = readFileSync(outPath, 'utf8');
    expect(content).toContain('Sessions');
    expect(content).toContain('3');
    expect(content).toContain('Duration');
    expect(content).toContain('Message count');
    expect(content).toContain('p50');
    expect(content).toContain('p95');
    expect(content).toContain('max');
    expect(content).toContain('Errors');
    expect(content).toContain('pass');
  } finally {
    try {
      if (existsSync(outPath)) unlinkSync(outPath);
    } catch {
      // Ignore cleanup error
    }
  }
}, 10000);

