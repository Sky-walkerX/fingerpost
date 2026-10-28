/** The surface the evals package may use. Keep it small: evals must exercise the same code the gateway runs. */
export { createMetaClient } from './models/meta-client.ts';
export { liveModels, type ModelPort } from './models/port.ts';
export { mockModels, MOCK_LAYOUT } from './models/mock/mock-models.ts';
export { resolveByText, tokenSetRatio } from './resolve/match.ts';
export { PARSE_PROMPT_ID } from './parse/spark-parse.ts';
