import { createHash, timingSafeEqual } from 'node:crypto';

/** Constant-time string comparison (hashing first makes the lengths equal). */
export function safeEqual(a: string | undefined, b: string): boolean {
  if (a === undefined) return false;
  const h = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(h(a), h(b));
}
