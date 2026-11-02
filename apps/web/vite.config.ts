import { defineConfig } from 'vitest/config';
export default defineConfig({
  appType: 'mpa',
  resolve: { conditions: ['source'] },
  ssr: { resolve: { conditions: ['source'] } },
  build: { rolldownOptions: { input: { main: 'index.html', sim: 'sim/index.html', label: 'label/index.html',
    privacy: 'privacy/index.html', dataSafety: 'data-safety/index.html', install: 'install/index.html' } } },
  test: { include: ['test/**/*.test.ts'] },
});
