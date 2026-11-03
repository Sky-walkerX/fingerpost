import { z } from 'zod';

const integer = '(0|[1-9][0-9]*)';
const identifier = '(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)';
const version = new RegExp(`^v?${integer}\\.${integer}\\.${integer}(?:-(${identifier}(?:\\.${identifier})*))?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$`);
/** fp.v1 appVersion is at most 32 chars; Android's version parser uses signed Int core components. */
export const AppVersion = z.string().min(1).max(32).regex(version).refine(value => {
  const match = version.exec(value);
  return value.length <= 32 && match !== null && match.slice(1, 4).every(n => BigInt(n!) <= 2_147_483_647n);
});

export function satisfiesMinimum(current: string, minimum: string): boolean {
  if (!AppVersion.safeParse(current).success || !AppVersion.safeParse(minimum).success) return false;
  const a = version.exec(current)!, b = version.exec(minimum)!;
  for (let i = 1; i <= 3; i++) if (BigInt(a[i]!) !== BigInt(b[i]!)) return BigInt(a[i]!) > BigInt(b[i]!);
  if (!a[4] || !b[4]) return !a[4] || !!b[4];
  const left = a[4].split('.'), right = b[4].split('.');
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const x = left[i], y = right[i];
    if (x === undefined || y === undefined) return y === undefined;
    if (x === y) continue;
    const xn = /^\d+$/.test(x), yn = /^\d+$/.test(y);
    return xn && yn ? BigInt(x) > BigInt(y) : xn !== yn ? !xn : x > y;
  }
  return true;
}
