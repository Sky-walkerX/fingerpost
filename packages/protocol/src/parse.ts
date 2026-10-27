import { ClientMessage } from './client.ts';
import { ServerMessage } from './server.ts';

export type ClientParse = { ok: true; msg: ClientMessage } | { ok: false; error: string };
export type ServerParse = { kind: 'ok'; msg: ServerMessage } | { kind: 'unknown'; type: string } | { kind: 'invalid'; error: string };

export const CLIENT_TYPES: readonly string[] = ClientMessage.options.map((o) => o.shape.type.value);
export const SERVER_TYPES: readonly string[] = ServerMessage.options.map((o) => o.shape.type.value);

/** Server side: unknown client types are errors (the server answers bad_message). Extra fields are stripped. */
export function parseClientMessage(json: unknown): ClientParse {
  const result = ClientMessage.safeParse(json);
  return result.success ? { ok: true, msg: result.data } : { ok: false, error: result.error.message };
}

/** Client side: unknown server types are ignorable so newer servers don't break older apps. Extra fields are stripped. */
export function parseServerMessage(json: unknown): ServerParse {
  if (typeof json === 'object' && json !== null && !Array.isArray(json) && 'type' in json
      && typeof json.type === 'string' && !SERVER_TYPES.includes(json.type)) {
    return { kind: 'unknown', type: json.type };
  }
  const result = ServerMessage.safeParse(json);
  return result.success ? { kind: 'ok', msg: result.data } : { kind: 'invalid', error: result.error.message };
}
