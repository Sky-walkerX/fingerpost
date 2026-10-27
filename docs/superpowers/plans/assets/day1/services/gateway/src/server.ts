import { loadConfig } from './config.ts';
import { buildApp } from './app.ts';

const cfg = loadConfig(process.env);
const app = await buildApp(cfg);
await app.listen({ port: cfg.PORT, host: '0.0.0.0' });
