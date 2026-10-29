import { defineConfig } from 'vitest/config';
export default defineConfig({
  build: { rolldownOptions: { input: { main: 'index.html', sim: 'sim/index.html', label: 'label/index.html' } } },
  test: { include: ['test/**/*.test.ts'] },
});
