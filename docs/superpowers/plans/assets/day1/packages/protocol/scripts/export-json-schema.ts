import { mkdirSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { ClientMessage, ServerMessage } from '@fingerpost/protocol';

const out = new URL('../schema/', import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(new URL('client.json', out), JSON.stringify(z.toJSONSchema(ClientMessage), null, 2) + '\n');
writeFileSync(new URL('server.json', out), JSON.stringify(z.toJSONSchema(ServerMessage), null, 2) + '\n');
console.log('wrote schema/client.json and schema/server.json');
