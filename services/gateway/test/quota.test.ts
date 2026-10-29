import { expect, test } from 'vitest';
import { ChallengeStore } from '../src/auth/challenges.ts';
import { issueSessionToken, TOKEN_TTL_S, verifySessionToken } from '../src/auth/tokens.ts';
import { costMicros } from '../src/quota/cost.ts';
import { MemoryFlagStore, MemoryQuotaStore } from '../src/quota/ports.ts';
import { DEFAULT_QUOTA, QuotaService, utcDay } from '../src/quota/service.ts';
import { SPOKEN_ERRORS } from '../src/errors/spoken.ts';
import { ErrorCode } from '@fingerpost/protocol';

const secret = new TextEncoder().encode('x'.repeat(32));
const T0 = Date.UTC(2026, 9, 27, 10, 0, 0);

test('session token round-trips and expires after 15 minutes', async () => {
  const t = await issueSessionToken(secret, { uid: 'u1', keyId: 'k1', tier: 'hardware' }, T0);
  expect(await verifySessionToken(secret, t, T0 + 60_000)).toEqual({ uid: 'u1', keyId: 'k1', tier: 'hardware' });
  expect(await verifySessionToken(secret, t, T0 + (TOKEN_TTL_S + 1) * 1000)).toBeNull();
  expect(await verifySessionToken(new TextEncoder().encode('y'.repeat(32)), t, T0)).toBeNull();
  expect(await verifySessionToken(secret, 'garbage', T0)).toBeNull();
});

test('challenges are single use and expire after 5 minutes', () => {
  let now = T0;
  const s = new ChallengeStore(() => now);
  const a = s.issue()!, b = s.issue()!;
  expect(a.nonce).toHaveLength(32);
  expect(s.take(a.challengeId)).toEqual(a.nonce);
  expect(s.take(a.challengeId)).toBeNull();
  now += 5 * 60_000 + 1;
  expect(s.take(b.challengeId)).toBeNull();
});

test('costMicros matches the price table', () => {
  expect(costMicros({ kind: 'spark', inputTokens: 1600, outputTokens: 200 })).toBe(2850);
  expect(costMicros({ kind: 'sam_image', images: 2 })).toBe(5000);
  expect(costMicros({ kind: 'sam_video', frames: 10 })).toBe(10_000); // 50-frame minimum
  expect(costMicros({ kind: 'asr', seconds: 30.9 })).toBe(1500);
});

test('tasks: 30/day for hardware, 10 for software, reset at the UTC day boundary', async () => {
  let now = T0;
  const q = new QuotaService(new MemoryQuotaStore(), new MemoryFlagStore(), DEFAULT_QUOTA, () => now);
  for (let i = 29; i >= 0; i--) expect(await q.startTask('u', 'hardware')).toEqual({ ok: true, tasksLeft: i });
  expect(await q.startTask('u', 'hardware')).toEqual({ ok: false, code: 'quota_exhausted' });
  for (let i = 0; i < 10; i++) await q.startTask('s', 'software');
  expect(await q.startTask('s', 'software')).toEqual({ ok: false, code: 'quota_exhausted' });
  now = Date.UTC(2026, 9, 28, 0, 0, 1);
  expect(utcDay(now)).toBe('2026-10-28');
  expect(await q.startTask('u', 'hardware')).toEqual({ ok: true, tasksLeft: 29 });
});

test('reaching the daily spend cap flips the kill switch; new tasks get cloud_paused', async () => {
  const flags = new MemoryFlagStore();
  const q = new QuotaService(new MemoryQuotaStore(), flags, { ...DEFAULT_QUOTA, dailyCapMicros: 10_000 }, () => T0);
  await q.recordUsage({ kind: 'sam_image', images: 3 });
  expect(flags.enabled).toBe(true);
  await q.recordUsage({ kind: 'sam_image', images: 1 });
  expect(flags.enabled).toBe(false);
  expect(flags.reason).toMatch(/daily cap/);
  expect(await q.startTask('u', 'hardware')).toEqual({ ok: false, code: 'cloud_paused' });
});

test('the flag is cached for 30 s', async () => {
  let now = T0;
  const flags = new MemoryFlagStore();
  const q = new QuotaService(new MemoryQuotaStore(), flags, DEFAULT_QUOTA, () => now);
  await q.cloudEnabled(); await q.cloudEnabled();
  expect(flags.reads).toBe(1);
  flags.enabled = false; now += 29_999;
  expect(await q.cloudEnabled()).toBe(true);
  now += 2;
  expect(await q.cloudEnabled()).toBe(false);
});

test('every error code has a spoken message', () => {
  expect(Object.keys(SPOKEN_ERRORS).sort()).toEqual([...ErrorCode.options].sort());
});

import { FixedWindowLimiter } from '../src/auth/rate-limit.ts';
import { safeEqual } from '../src/util/safe-equal.ts';

test('fixed-window limiter allows N per window per key, then resets', () => {
  let now = T0;
  const l = new FixedWindowLimiter(2, 1000, () => now);
  expect([l.hit('a'), l.hit('a'), l.hit('a'), l.hit('b')]).toEqual([true, true, false, true]);
  now += 1000;
  expect(l.hit('a')).toBe(true);
});

test('safeEqual compares in constant time and handles missing values', () => {
  expect(safeEqual('secret-123', 'secret-123')).toBe(true);
  expect(safeEqual('secret-12', 'secret-123')).toBe(false);
  expect(safeEqual(undefined, 'secret-123')).toBe(false);
});

import { clientKey, overflowKey } from '../src/auth/rate-limit.ts';

test('limiter keys: IPv4 as is, IPv6 grouped by /56, mapped IPv4 unwrapped', () => {
  expect(clientKey('203.0.113.7')).toBe('203.0.113.7');
  expect(clientKey('::ffff:203.0.113.7')).toBe('203.0.113.7');
  expect(clientKey('2001:db8:abcd:12ff::1')).toBe(clientKey('2001:db8:abcd:1200:ffff::9'));
  expect(clientKey('2001:db8:abcd:12ff::1')).not.toBe(clientKey('2001:db8:abcd:1300::1'));
});

test('a full limiter table keeps every active window and counts new keys in a shared overflow bucket', () => {
  const l = new FixedWindowLimiter(2, 60_000, () => T0);
  for (let i = 0; i < 10_000; i++) l.hit(`k${i}`);
  expect([l.hit('k0'), l.hit('k0')]).toEqual([true, false]); // still counted, not evicted
  const shared = Array.from({ length: 41 }, (_, i) => l.hit(`new-${i}`, '10.1.0.0/16'));
  expect(shared.filter(Boolean)).toHaveLength(40); // a /16 bucket holds 20 × the per-client limit
  expect(shared.at(-1)).toBe(false);
  expect(l.hit('new-4', '10.2.0.0/16')).toBe(true); // other prefixes are unaffected
  expect(overflowKey('10.1.2.3')).toBe('10.1.0.0/16');
  expect(overflowKey('2001:db8:abcd::1')).toBe('2001:db8::/32');
});

test('challenges: at most 5 outstanding per client; the oldest of that client is replaced', () => {
  const s = new ChallengeStore(() => T0);
  const other = s.issue('b')!;
  const mine = Array.from({ length: 6 }, () => s.issue('a')!);
  expect(s.take(mine[0]!.challengeId)).toBeNull();
  expect(s.take(mine[5]!.challengeId)).toEqual(mine[5]!.nonce);
  expect(s.take(other.challengeId)).toEqual(other.nonce);
});
