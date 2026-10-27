import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { CLIENT_TYPES, parseClientMessage, parseServerMessage, SERVER_TYPES } from '@fingerpost/protocol';

const dir = new URL('../fixtures/', import.meta.url);
const load = (sub: 'valid' | 'invalid') =>
  readdirSync(new URL(`${sub}/`, dir)).sort().map((f) => [f, JSON.parse(readFileSync(new URL(`${sub}/${f}`, dir), 'utf8'))] as const);
/** "client.confirm.reply.json" → "confirm.reply" */
const typeOf = (file: string) => file.replace(/^(client|server)\./, '').replace(/\.json$/, '');

describe('valid fixtures', () => {
  test.each(load('valid'))('%s parses, keeps its type, and round-trips', (file, json) => {
    if (file.startsWith('client.')) {
      const r = parseClientMessage(json);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.msg.type).toBe(typeOf(file));
        expect(JSON.parse(JSON.stringify(r.msg))).toEqual(json);
      }
    } else {
      const r = parseServerMessage(json);
      expect(r.kind).toBe('ok');
      if (r.kind === 'ok') {
        expect(r.msg.type).toBe(typeOf(file));
        expect(JSON.parse(JSON.stringify(r.msg))).toEqual(json);
      }
    }
  });
});

describe('invalid fixtures', () => {
  test.each(load('invalid'))('%s is rejected', (file, json) => {
    if (file.startsWith('client.')) expect(parseClientMessage(json).ok).toBe(false);
    else expect(parseServerMessage(json).kind).toBe('invalid');
  });
});

test('every message type has exactly one valid fixture', () => {
  const files = load('valid').map(([f]) => f);
  expect(files.filter((f) => f.startsWith('client.')).map(typeOf).sort()).toEqual([...CLIENT_TYPES].sort());
  expect(files.filter((f) => f.startsWith('server.')).map(typeOf).sort()).toEqual([...SERVER_TYPES].sort());
});

test('an unknown server type is reported as ignorable, not invalid', () => {
  expect(parseServerMessage({ type: 'future.thing', id: 'x', ts: 1 })).toEqual({ kind: 'unknown', type: 'future.thing' });
});

test('extra fields on a server message are stripped, not rejected', () => {
  const r = parseServerMessage({ type: 'say', id: 'x', ts: 1, text: 'Hi', priority: 'info', zzz: 1 });
  expect(r.kind).toBe('ok');
  if (r.kind === 'ok') expect(r.msg).not.toHaveProperty('zzz');
});

test('non-object input never throws', () => {
  for (const bad of [null, 42, 'hello', [], undefined]) {
    expect(parseClientMessage(bad).ok).toBe(false);
    expect(parseServerMessage(bad).kind).toBe('invalid');
  }
});
