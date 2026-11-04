/** The surface the evals package may use. Keep it small: evals must exercise the same code the gateway runs. */
export { createMetaClient } from './models/meta-client.ts';
export { liveModels, type ModelPort } from './models/port.ts';
export { mockModels, MOCK_LAYOUT } from './models/mock/mock-models.ts';
export { resolveByText, tokenSetRatio } from './resolve/match.ts';
export { PARSE_PROMPT_ID } from './parse/spark-parse.ts';
export { createGlimmerClient, glimmerModels } from './parse/glimmer-parse.ts';
export { loadConfig } from './config.ts';
export { buildApp } from './app.ts';
export type { ParsedLayout } from './parse/spark-parse.ts';
export { createRouter } from './models/router.ts';
export { SessionPipeline } from './session/pipeline.ts';
export { MODEL_TURN_TIMEOUT_MS } from './session/model-budget.ts';
export { jpegSize } from './debug/jpeg.ts';
