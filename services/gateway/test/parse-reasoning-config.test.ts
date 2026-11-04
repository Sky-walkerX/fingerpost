import { expect, test } from 'vitest';
import { loadConfig } from '../src/config.ts';
import { phoneDevConfig } from '../scripts/phone-dev.ts';

test('guidance-spec §8: the screen parse defaults to low reasoning and accepts the model default explicitly', () => {
  expect(loadConfig({}).SPARK_PARSE_REASONING).toBe('low');
  for (const value of ['default', 'low', 'medium', 'high'] as const) expect(loadConfig({ SPARK_PARSE_REASONING: value }).SPARK_PARSE_REASONING).toBe(value);
  expect(() => loadConfig({ SPARK_PARSE_REASONING: 'minimal' })).toThrow(/SPARK_PARSE_REASONING/);
});

test('the local live phone gateway takes the parse reasoning setting from the private env', () => {
  const config = phoneDevConfig({ live: true, env: { META_API_KEY: 'synthetic-private-key', SPARK_PARSE_REASONING: 'default' } });
  expect(config.SPARK_PARSE_REASONING).toBe('default');
});
